const API_BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { Accept: 'application/json', 'X-ChronoCode-Client': '1', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({ error: `Request failed: ${res.status}` }));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  analyzeRepo: (path) => request('/repo/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  }),
  getStatus: (sessionId) => request(`/repo/status/${encodeURIComponent(sessionId)}`),
  getTimeline: (sessionId) => request(`/timeline/${encodeURIComponent(sessionId)}`),
  getCommits: (sessionId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/commits/${encodeURIComponent(sessionId)}${qs ? '?' + qs : ''}`);
  },
  getDependencies: (sessionId) => request(`/dependencies/${encodeURIComponent(sessionId)}`),
  getCommitImpact: (sessionId, hash) => request(`/impact/${encodeURIComponent(sessionId)}/${encodeURIComponent(hash)}`),
  explain: (sessionId, commitHash) => request('/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, commitHash }),
  }),
};