import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY = 32 * 1024;
const MAX_COMMITS = 5000;
const MAX_FILES_PER_COMMIT = 200;
const SESSION_TTL_MS = 30 * 60 * 1000;
const sessions = new Map();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
  const payload = Buffer.isBuffer(body) ? body : (typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
  });
  res.end(payload);
}

async function readJson(req) {
  if (Number(req.headers['content-length'] || 0) > MAX_BODY) {
    throw new Error('Request body is too large.');
  }
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Request body must contain valid JSON.');
  }
}

async function git(cwd, args, timeout = 30000) {
  const { stdout } = await execFileAsync('git', ['-C', cwd, ...args], {
    timeout,
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
  });
  return stdout;
}

async function validateRepo(repoPath) {
  if (typeof repoPath !== 'string' || repoPath.length > 4096) {
    throw new Error('Invalid repository path.');
  }
  const resolved = path.resolve(repoPath);
  const stat = await fs.promises.stat(resolved).catch(() => null);
  if (!stat?.isDirectory()) throw new Error('Repository path must be an existing directory.');
  const inside = await git(resolved, ['rev-parse', '--is-inside-work-tree']).catch(() => '');
  if (inside.trim() !== 'true') throw new Error('The selected directory is not a Git working tree.');
  return resolved;
}

function parseLog(output) {
  const commits = [];
  for (const record of output.split('\x1e').filter(Boolean)) {
    const lines = record.split('\n');
    const header = lines.shift()?.split('\x1f');
    if (!header || header.length < 4) continue;
    const [hash, date, author, subject] = header;
    const files = [];
    let additions = 0;
    let deletions = 0;
    for (const line of lines) {
      if (!line) continue;
      const m = line.match(/^(\d+|-)[\t ]+(\d+|-)[\t ]+(.+)$/);
      if (!m) continue;
      const add = m[1] === '-' ? 0 : Number(m[1]);
      const del = m[2] === '-' ? 0 : Number(m[2]);
      additions += add;
      deletions += del;
      if (files.length < MAX_FILES_PER_COMMIT) {
        files.push({ path: m[3], additions: add, deletions: del });
      }
    }
    commits.push({
      hash,
      timestamp: Date.parse(date),
      date,
      author: { name: author || 'Unknown' },
      subject: subject || '(no subject)',
      files,
      metrics: {
        totalAdditions: additions,
        totalDeletions: deletions,
        fileCount: Math.min(files.length, MAX_FILES_PER_COMMIT),
      },
    });
    if (commits.length >= MAX_COMMITS) break;
  }
  return commits;
}

function scoreCommit(commit, seenDirs) {
  const changed = commit.files.length;
  const lines = commit.metrics.totalAdditions + commit.metrics.totalDeletions;
  const critical = commit.files.filter((f) =>
    /(^|\/)(package\.json|package-lock\.json|Dockerfile|\.github\/|\.gitlab-ci|tsconfig\.json)/i.test(f.path)
  ).length;
  const dirs = new Set(commit.files.map((f) => path.posix.dirname(f.path)));
  const newDirs = [...dirs].filter((dir) => !seenDirs.has(dir)).length;
  return Math.min(100, Math.round(
    Math.min(changed * 1.8, 35) +
    Math.min(lines / 120, 30) +
    Math.min(dirs.size * 2, 15) +
    Math.min(critical * 8, 15) +
    Math.min(newDirs * 2, 10)
  ));
}

function buildTimeline(commits) {
  const chronological = [...commits].sort((a, b) => a.timestamp - b.timestamp);
  const buckets = new Map();
  const seenFiles = new Set();
  const seenDirs = new Set();
  const events = [];
  let nextMilestone = 100;

  for (let index = 0; index < chronological.length; index += 1) {
    const commit = chronological[index];
    const d = new Date(commit.timestamp);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        startDate: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString(),
        endDate: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59)).toISOString(),
        commitCount: 0,
        totalAdditions: 0,
        totalDeletions: 0,
        fileCount: seenFiles.size,
        topDirCount: seenDirs.size,
        newDirs: [],
        locDelta: 0,
      });
    }
    const bucket = buckets.get(key);
    bucket.commitCount += 1;
    bucket.totalAdditions += commit.metrics.totalAdditions;
    bucket.totalDeletions += commit.metrics.totalDeletions;

    for (const dir of new Set(commit.files.map((f) => path.posix.dirname(f.path)))) {
      if (!seenDirs.has(dir)) {
        seenDirs.add(dir);
        bucket.newDirs.push(dir);
      }
    }
    for (const file of commit.files) seenFiles.add(file.path);
    bucket.fileCount = seenFiles.size;
    bucket.topDirCount = seenDirs.size;
    bucket.locDelta = bucket.totalAdditions - bucket.totalDeletions;

    const commitNumber = index + 1;
    if (commitNumber >= nextMilestone) {
      events.push({
        type: 'milestone',
        title: `${nextMilestone} commits reached`,
        description: `The repository crossed ${nextMilestone} commits.`,
        date: commit.date,
        severity: 3,
      });
      nextMilestone += nextMilestone < 1000 ? 100 : 500;
    }

    const names = commit.files.map((f) => f.path);
    if (names.some((f) =>
      /(^|\/)(Dockerfile|docker-compose|\.github\/workflows|\.gitlab-ci|pytest|jest|vitest|mocha|tsconfig\.json)/i.test(f)
    )) {
      events.push({
        type: 'tooling',
        title: 'Tooling or infrastructure change',
        description: commit.subject,
        date: commit.date,
        severity: 3,
      });
    }

    if (commit.files.length >= 25) {
      const ratio = Math.min(commit.metrics.totalAdditions, commit.metrics.totalDeletions) /
        Math.max(1, Math.max(commit.metrics.totalAdditions, commit.metrics.totalDeletions));
      events.push({
        type: ratio > 0.45 ? 'refactor' : 'restructure',
        title: ratio > 0.45 ? 'Large refactor detected' : 'Large structural change detected',
        description: commit.subject,
        date: commit.date,
        severity: ratio > 0.45 ? 4 : 5,
      });
    }
  }

  const timeline = [...buckets.values()].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  return {
    totalCommits: chronological.length,
    dateRange: chronological.length ? {
      first: chronological[0].date,
      last: chronological.at(-1).date,
    } : null,
    timeline,
    events: events.sort((a, b) => new Date(a.date) - new Date(b.date)),
  };
}

function parsePackageJson(text) {
  try {
    const pkg = JSON.parse(text);
    const deps = [];
    for (const [name, version] of Object.entries(pkg.dependencies || {})) {
      deps.push({ name, version: String(version), category: 'runtime', isDev: false });
    }
    for (const [name, version] of Object.entries(pkg.devDependencies || {})) {
      deps.push({ name, version: String(version), category: 'development', isDev: true });
    }
    return deps;
  } catch {
    return [];
  }
}

async function buildDependencies(repoPath, commits) {
  const packageCommits = await git(
    repoPath,
    ['log', '--all', '--format=%H%x09%aI', '--', 'package.json']
  ).catch(() => '');

  const refs = packageCommits
    .split('\n')
    .filter(Boolean)
    .slice(0, 30)
    .map((line) => line.split('\t')[0]);

  const snapshots = [];
  let previous = new Map();

  for (let i = refs.length - 1; i >= 0; i -= 1) {
    const hash = refs[i];
    const date = commits.find((c) => c.hash === hash)?.date || new Date().toISOString();
    const content = await git(repoPath, ['show', `${hash}:package.json`], 10000).catch(() => null);
    if (!content) continue;

    const deps = parsePackageJson(content);
    const current = new Map(deps.map((d) => [d.name, d]));
    const added = deps.filter((d) => !previous.has(d.name));
    const removed = [...previous.values()].filter((d) => !current.has(d.name));
    const changed = deps
      .filter((d) => previous.has(d.name) && previous.get(d.name).version !== d.version)
      .map((d) => ({
        name: d.name,
        from: previous.get(d.name).version,
        to: d.version,
      }));

    snapshots.push({ date, added, removed, changed });
    previous = current;
  }

  let currentDeps = [];
  if (commits[0]) {
    const head = await git(repoPath, ['show', `${commits[0].hash}:package.json`], 10000).catch(() => null);
    currentDeps = head ? parsePackageJson(head) : [];
  }

  const graph = {
    nodes: [{ id: 'root', version: '', category: 'framework', isDev: false, ageDays: 0 }],
    links: [],
  };

  for (const dep of currentDeps) {
    graph.nodes.push({
      id: dep.name,
      version: dep.version,
      category: dep.category,
      isDev: dep.isDev,
      ageDays: 0,
    });
    graph.links.push({ source: 'root', target: dep.name, category: dep.category });
  }

  return { snapshots, graph };
}

function buildImpact(commits) {
  const seenDirs = new Set();
  const ordered = [...commits].sort((a, b) => a.timestamp - b.timestamp);
  for (const commit of ordered) {
    commit.impactScore = scoreCommit(commit, seenDirs);
    commit.category = commit.impactScore >= 75
      ? 'critical'
      : commit.impactScore >= 50
        ? 'major'
        : commit.impactScore >= 25
          ? 'moderate'
          : 'minor';
    commit.files.forEach((file) => seenDirs.add(path.posix.dirname(file.path)));
  }
  return commits;
}

async function analyze(repoPath) {
  const log = await git(repoPath, [
    'log',
    '--all',
    '--date=iso-strict',
    '--pretty=format:%x1e%H%x1f%aI%x1f%an%x1f%s',
    '--numstat',
  ], 60000);

  const commits = parseLog(log);
  if (!commits.length) throw new Error('No commits were found in the repository.');

  buildImpact(commits);
  const timeline = buildTimeline(commits);
  const deps = await buildDependencies(repoPath, commits);
  return { commits, timeline, deps };
}

function cleanupSessions() {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, session] of sessions) {
    if (session.createdAt < cutoff) sessions.delete(id);
  }
}
setInterval(cleanupSessions, 5 * 60 * 1000).unref();

async function handle(req, res) {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  if (url.pathname.startsWith('/api/') && req.headers['x-chronocode-client'] !== '1') {
    return send(res, 403, { error: 'Missing client header.' });
  }

  if (req.method === 'POST' && url.pathname === '/api/repo/analyze') {
    try {
      const body = await readJson(req);
      const repoPath = await validateRepo(body.path);
      const sessionId = crypto.randomUUID();

      sessions.set(sessionId, {
        createdAt: Date.now(),
        status: 'parsing',
        progress: 10,
        repoName: path.basename(repoPath),
      });

      setImmediate(async () => {
        try {
          sessions.set(sessionId, { ...sessions.get(sessionId), status: 'parsing', progress: 20 });
          const data = await analyze(repoPath);
          sessions.set(sessionId, {
            createdAt: Date.now(),
            status: 'complete',
            progress: 100,
            repoName: path.basename(repoPath),
            repoPath,
            data,
          });
        } catch (error) {
          sessions.set(sessionId, {
            createdAt: Date.now(),
            status: 'error',
            progress: 100,
            error: error.message || 'Analysis failed.',
          });
        }
      });

      return send(res, 202, { sessionId, repoName: path.basename(repoPath) });
    } catch (error) {
      return send(res, 400, { error: error.message || 'Unable to start analysis.' });
    }
  }

  let match = url.pathname.match(/^\/api\/repo\/status\/([0-9a-f-]{36})$/);
  if (req.method === 'GET' && match) {
    const session = sessions.get(match[1]);
    return session
      ? send(res, 200, { status: session.status, progress: session.progress, error: session.error || null })
      : send(res, 404, { error: 'Session not found.' });
  }

  match = url.pathname.match(/^\/api\/(timeline|dependencies|commits)\/([0-9a-f-]{36})$/);
  if (req.method === 'GET' && match) {
    const session = sessions.get(match[2]);
    if (!session?.data) return send(res, 404, { error: 'Analysis session not ready.' });

    if (match[1] === 'timeline') return send(res, 200, session.data.timeline);
    if (match[1] === 'dependencies') return send(res, 200, session.data.deps);

    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 100), 1), 500);
    const sort = url.searchParams.get('sort');
    const commits = [...session.data.commits].sort((a, b) =>
      sort === 'impact' ? b.impactScore - a.impactScore : b.timestamp - a.timestamp
    );
    return send(res, 200, { commits: commits.slice(0, limit) });
  }

  match = url.pathname.match(/^\/api\/impact\/([0-9a-f-]{36})\/([0-9a-f]{7,64})$/);
  if (req.method === 'GET' && match) {
    const session = sessions.get(match[1]);
    const commit = session?.data?.commits?.find((item) => item.hash === match[2] || item.hash.startsWith(match[2]));
    return commit
      ? send(res, 200, commit)
      : send(res, 404, { error: 'Commit not found.' });
  }

  if (req.method === 'POST' && url.pathname === '/api/explain') {
    try {
      const body = await readJson(req);
      if (!validSession(body.sessionId) || typeof body.commitHash !== 'string') {
        return send(res, 400, { error: 'Invalid session or commit ID.' });
      }
      const session = sessions.get(body.sessionId);
      const commit = session?.data?.commits?.find((c) => c.hash === body.commitHash);
      if (!commit) return send(res, 404, { error: 'Commit not found.' });

      return send(res, 200, {
        source: 'heuristic',
        explanation: `This ${commit.category} commit changed ${commit.files.length} file${commit.files.length === 1 ? '' : 's'}, with ${commit.metrics.totalAdditions} additions and ${commit.metrics.totalDeletions} deletions. Its impact score is ${commit.impactScore}/100.`,
      });
    } catch (error) {
      return send(res, 400, { error: error.message || 'Invalid request.' });
    }
  }

  if (req.method === 'GET') {
    let safe;
    try {
      safe = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    } catch {
      return send(res, 400, { error: 'Invalid path.' });
    }

    const requested = path.resolve(ROOT, safe || 'index.html');
    if (requested !== ROOT && !requested.startsWith(ROOT + path.sep)) {
      return send(res, 400, { error: 'Invalid path.' });
    }
    const stat = await fs.promises.stat(requested).catch(() => null);
    if (!stat?.isFile()) return send(res, 404, 'Not found.', 'text/plain; charset=utf-8');

    const ext = path.extname(requested).toLowerCase();
    const data = await fs.promises.readFile(requested);
    return send(res, 200, data, MIME[ext] || 'application/octet-stream');
  }

  return send(res, 405, { error: 'Method not allowed.' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error(error);
    if (!res.headersSent) send(res, 500, { error: 'Internal server error.' });
    else res.end();
  });
});

server.listen(PORT, HOST, () => {
  console.log(`ChronoCode running at http://${HOST}:${PORT}`);
});
