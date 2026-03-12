import { api } from './api.js';
import { renderTimeline } from './visualizations/d3-timeline.js';
import { renderDependencyGraph } from './visualizations/d3-dependency.js';
import { renderFileGrowth } from './visualizations/d3-file-growth.js';
import { initHeroScene } from './visualizations/three-scene.js';
import { formatDate, formatNumber, timeAgo } from './utils/date-utils.js';

// ===== State =====
const state = {
  sessionId: null,
  repoName: null,
  analysisData: null,
  selectedCommit: null,
};

// ===== DOM Refs =====
const $landing = document.getElementById('landing');
const $progress = document.getElementById('progress-section');
const $dashboard = document.getElementById('dashboard');
const $repoPath = document.getElementById('repo-path');
const $analyzeBtn = document.getElementById('analyze-btn');
const $inputError = document.getElementById('input-error');
const $progressTitle = document.getElementById('progress-title');
const $progressFill = document.getElementById('progress-fill');
const $progressStatus = document.getElementById('progress-status');
const $headerMeta = document.getElementById('header-meta');
const $statsBar = document.getElementById('stats-bar');

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  initHeroScene(document.getElementById('hero-canvas'));
  setupEventListeners();
});

function setupEventListeners() {
  $analyzeBtn.addEventListener('click', handleAnalyze);
  $repoPath.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAnalyze();
  });

  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

// ===== Analyze Flow =====
async function handleAnalyze() {
  const path = $repoPath.value.trim();
  if (!path) {
    $inputError.textContent = 'Please enter a repository path';
    return;
  }
  $inputError.textContent = '';

  setButtonLoading(true);

  try {
    const { sessionId, repoName } = await api.analyzeRepo(path);
    state.sessionId = sessionId;
    state.repoName = repoName;

    showSection('progress');
    $progressTitle.textContent = `Analyzing ${repoName}...`;

    await pollProgress(sessionId);

    // Fetch all data in parallel
    const [timelineData, commitsData, depsData] = await Promise.all([
      api.getTimeline(sessionId),
      api.getCommits(sessionId, { limit: 100, sort: 'impact', order: 'desc' }),
      api.getDependencies(sessionId),
    ]);

    state.analysisData = { timeline: timelineData, commits: commitsData, deps: depsData };

    showSection('dashboard');
    renderDashboard();
  } catch (err) {
    $inputError.textContent = err.message;
    showSection('landing');
  } finally {
    setButtonLoading(false);
  }
}

async function pollProgress(sessionId) {
  const STATUS_LABELS = {
    parsing: 'Parsing git history...',
    building_timeline: 'Building architecture timeline...',
    detecting_architecture: 'Detecting architectural shifts...',
    tracking_dependencies: 'Tracking dependency evolution...',
    analyzing_impact: 'Analyzing commit impact...',
    complete: 'Analysis complete!',
    error: 'Analysis failed',
  };

  while (true) {
    const progress = await api.getStatus(sessionId);

    $progressFill.style.width = `${progress.progress}%`;
    $progressStatus.textContent = STATUS_LABELS[progress.status] || progress.status;

    if (progress.status === 'complete') break;
    if (progress.status === 'error') throw new Error(progress.error || 'Analysis failed');

    await new Promise(r => setTimeout(r, 500));
  }
}

// ===== Dashboard =====
function renderDashboard() {
  const { timeline, commits, deps } = state.analysisData;

  // Header meta
  $headerMeta.innerHTML = `
    <span class="meta-badge">${state.repoName}</span>
    <span class="meta-badge">${timeline.totalCommits.toLocaleString()} commits</span>
  `;

  // Stats bar
  const dateRange = timeline.dateRange;
  const daySpan = dateRange ? Math.round((new Date(dateRange.last) - new Date(dateRange.first)) / 86400000) : 0;

  $statsBar.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${formatNumber(timeline.totalCommits)}</div>
      <div class="stat-label">Total Commits</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatNumber(timeline.events.length)}</div>
      <div class="stat-label">Architectural Events</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${deps.graph.nodes.length}</div>
      <div class="stat-label">Dependencies</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${daySpan}</div>
      <div class="stat-label">Days of History</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${dateRange ? formatDate(dateRange.first) : 'N/A'}</div>
      <div class="stat-label">First Commit</div>
    </div>
  `;

  // Render default tab (timeline)
  renderTimelineTab();
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.style.display = 'none';
    panel.classList.remove('active');
  });
  const activePanel = document.getElementById(`tab-${tabName}`);
  activePanel.style.display = 'block';
  activePanel.classList.add('active');

  // Lazy render
  switch (tabName) {
    case 'timeline': renderTimelineTab(); break;
    case 'dependencies': renderDependenciesTab(); break;
    case 'commits': renderCommitsTab(); break;
    case 'filegrowth': renderFileGrowthTab(); break;
  }
}

// ===== Tab Renderers =====
let renderedTabs = new Set();

function renderTimelineTab() {
  if (renderedTabs.has('timeline')) return;
  renderedTabs.add('timeline');

  const { timeline } = state.analysisData;
  renderTimeline(document.getElementById('timeline-chart'), timeline);
  renderEventCards(timeline.events);
}

function renderDependenciesTab() {
  if (renderedTabs.has('dependencies')) return;
  renderedTabs.add('dependencies');

  const { deps } = state.analysisData;
  renderDependencyGraph(document.getElementById('dep-graph'), deps.graph);
  renderDepTimeline(deps.snapshots);
}

function renderCommitsTab() {
  if (renderedTabs.has('commits')) return;
  renderedTabs.add('commits');

  const { commits } = state.analysisData;
  renderCommitList(commits.commits);
}

function renderFileGrowthTab() {
  if (renderedTabs.has('filegrowth')) return;
  renderedTabs.add('filegrowth');

  const { timeline } = state.analysisData;
  renderFileGrowth(document.getElementById('growth-chart'), timeline.timeline);
}

// ===== Event Cards =====
function renderEventCards(events) {
  const container = document.getElementById('events-list');
  const sorted = [...events].sort((a, b) => b.severity - a.severity);

  container.innerHTML = sorted.map(event => `
    <div class="event-card">
      <div>
        <span class="event-type-badge ${event.type}">${event.type}</span>
        <span class="severity-dots">
          ${Array.from({ length: 5 }, (_, i) =>
            `<span class="severity-dot ${i < event.severity ? 'active' : ''}"></span>`
          ).join('')}
        </span>
      </div>
      <div class="event-title">${event.title}</div>
      <div class="event-description">${event.description}</div>
      <div class="event-date">${formatDate(event.date)}</div>
    </div>
  `).join('');
}

// ===== Commit List =====
function renderCommitList(commits) {
  const container = document.getElementById('commit-list');

  let sortByImpact = true;

  const header = `
    <div class="commit-list-header">
      <span style="font-size:0.8rem;font-weight:600">Commits</span>
      <button class="sort-btn" id="sort-toggle">Sort by: Impact</button>
    </div>
  `;

  function renderList(sorted) {
    container.innerHTML = header + sorted.map(c => `
      <div class="commit-item" data-hash="${c.hash}">
        <div class="commit-impact-dot ${c.category}"></div>
        <div class="commit-info">
          <div class="commit-subject">${escapeHtml(c.subject)}</div>
          <div class="commit-meta">
            <span>${c.hash.slice(0, 7)}</span>
            <span>${c.author.name}</span>
            <span>${timeAgo(c.date)}</span>
          </div>
        </div>
        <div class="commit-score">${c.impactScore}</div>
      </div>
    `).join('');

    // Bind click handlers
    container.querySelectorAll('.commit-item').forEach(el => {
      el.addEventListener('click', () => selectCommit(el.dataset.hash, commits));
    });

    container.querySelector('#sort-toggle')?.addEventListener('click', () => {
      sortByImpact = !sortByImpact;
      const resorted = [...commits].sort((a, b) =>
        sortByImpact ? b.impactScore - a.impactScore : b.timestamp - a.timestamp
      );
      container.querySelector('#sort-toggle').textContent = `Sort by: ${sortByImpact ? 'Impact' : 'Date'}`;
      renderList(resorted);
    });
  }

  renderList([...commits].sort((a, b) => b.impactScore - a.impactScore));
}

async function selectCommit(hash, commits) {
  const commit = commits.find(c => c.hash === hash);
  if (!commit) return;

  state.selectedCommit = commit;

  // Highlight selected
  document.querySelectorAll('.commit-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.hash === hash);
  });

  const detail = document.getElementById('commit-detail');
  detail.innerHTML = `
    <div class="detail-header">
      <div class="detail-subject">${escapeHtml(commit.subject)}</div>
      <div class="detail-meta-row">
        <span class="detail-badge impact-${commit.category}">${commit.category} (${commit.impactScore})</span>
        <span class="detail-badge additions">+${commit.metrics.totalAdditions}</span>
        <span class="detail-badge deletions">-${commit.metrics.totalDeletions}</span>
      </div>
      <div style="margin-top:8px;font-size:0.8rem;color:#94a3b8;font-family:var(--font-mono)">
        ${commit.hash.slice(0, 7)} by ${commit.author.name} &middot; ${formatDate(commit.date)}
      </div>
    </div>

    <div class="impact-meter">
      <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:#64748b">
        <span>Impact</span>
        <span>${commit.impactScore}/100</span>
      </div>
      <div class="impact-meter-bar">
        <div class="impact-meter-fill ${commit.category}" style="width:${commit.impactScore}%"></div>
      </div>
    </div>

    <div class="detail-files">
      <div class="detail-files-title">Files Changed (${commit.files.length})</div>
      ${commit.files.slice(0, 25).map(f => `
        <div class="detail-file-item">
          <span class="detail-file-path">${f.path}</span>
          <div class="detail-file-changes">
            <span class="detail-file-add">+${f.additions}</span>
            <span class="detail-file-del">-${f.deletions}</span>
          </div>
        </div>
      `).join('')}
      ${commit.files.length > 25 ? `<div style="padding:8px 0;font-size:0.75rem;color:#64748b">...and ${commit.files.length - 25} more files</div>` : ''}
    </div>

    <div class="explanation-card" id="explanation-area">
      <div class="explanation-loading">
        <svg class="spinner" viewBox="0 0 24 24" width="16" height="16">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="60 30"/>
        </svg>
        Generating explanation...
      </div>
    </div>
  `;

  // Fetch explanation
  try {
    const explanation = await api.explain(state.sessionId, hash);
    const area = document.getElementById('explanation-area');
    if (area && explanation?.explanation) {
      area.innerHTML = `
        <div class="explanation-header">
          <span class="explanation-title">Analysis</span>
          <span class="explanation-source ${explanation.source || 'heuristic'}">${explanation.source || 'heuristic'}</span>
        </div>
        <div class="explanation-text">${explanation.explanation}</div>
      `;
    }
  } catch (err) {
    const area = document.getElementById('explanation-area');
    if (area) {
      area.innerHTML = `<div class="explanation-text" style="color:#64748b">Could not generate explanation.</div>`;
    }
  }
}

// ===== Dependency Timeline =====
function renderDepTimeline(snapshots) {
  const container = document.getElementById('dep-timeline');
  if (!snapshots.length) {
    container.innerHTML = '<p style="color:#64748b;font-size:0.85rem">No dependency changes detected</p>';
    return;
  }

  const meaningful = snapshots.filter(s => s.added.length || s.removed.length || s.changed.length);

  container.innerHTML = meaningful.slice(0, 30).map(s => `
    <div class="dep-snapshot">
      <div class="dep-snapshot-date">${formatDate(s.date)}</div>
      <div class="dep-changes">
        ${s.added.map(d => `<span class="dep-change added">+ ${d.name}</span>`).join('')}
        ${s.removed.map(d => `<span class="dep-change removed">- ${d.name}</span>`).join('')}
        ${s.changed.map(d => `<span class="dep-change changed">${d.name} ${d.from} → ${d.to}</span>`).join('')}
      </div>
    </div>
  `).join('');
}

// ===== Helpers =====
function showSection(name) {
  $landing.style.display = name === 'landing' ? 'flex' : 'none';
  $progress.style.display = name === 'progress' ? 'flex' : 'none';
  $dashboard.style.display = name === 'dashboard' ? 'block' : 'none';
}

function setButtonLoading(loading) {
  $analyzeBtn.disabled = loading;
  $analyzeBtn.querySelector('.btn-text').style.display = loading ? 'none' : 'inline';
  $analyzeBtn.querySelector('.btn-loader').style.display = loading ? 'inline-flex' : 'none';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
