const STORAGE_KEY = 'chronocode-analysis-v1';

function getStoredAnalysis() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

export const api = {
  async analyzeRepo(path) {
    const cleaned = String(path || '').trim();
    if (!cleaned) throw new Error('Please enter a repository path or URL.');
    return {
      sessionId: crypto.randomUUID(),
      repoName: cleaned.split('/').filter(Boolean).pop() || cleaned,
      path: cleaned,
    };
  },

  async getStatus() {
    return { status: 'complete', progress: 100 };
  },

  async getTimeline() {
    const data = getStoredAnalysis();
    if (!data) throw new Error('No analysis is loaded. Import a local Git analysis snapshot first.');
    return data.timeline;
  },

  async getCommits(_sessionId, params = {}) {
    const data = getStoredAnalysis();
    if (!data) throw new Error('No analysis is loaded. Import a local Git analysis snapshot first.');
    let commits = [...(data.commits || [])];
    if (params.sort === 'impact') commits.sort((a, b) => b.impactScore - a.impactScore);
    else commits.sort((a, b) => b.timestamp - a.timestamp);
    const limit = Math.min(Math.max(Number(params.limit) || 100, 1), 500);
    return { commits: commits.slice(0, limit) };
  },

  async getDependencies() {
    const data = getStoredAnalysis();
    if (!data) throw new Error('No analysis is loaded. Import a local Git analysis snapshot first.');
    return data.deps;
  },

  async explain(_sessionId, commitHash) {
    const data = getStoredAnalysis();
    const commit = data?.commits?.find((item) => item.hash === commitHash);
    if (!commit) throw new Error('Commit not found.');
    const files = commit.files?.length || 0;
    const added = commit.metrics?.totalAdditions || 0;
    const removed = commit.metrics?.totalDeletions || 0;
    const category = commit.category || 'maintenance';
    return {
      source: 'heuristic',
      explanation: 'This ' + category + ' commit changed ' + files + ' file' + (files === 1 ? '' : 's') +
        ' with ' + added + ' additions and ' + removed + ' deletions. Its impact score is ' +
        commit.impactScore + '/100. The explanation is heuristic because no AI service is configured.',
    };
  },
};