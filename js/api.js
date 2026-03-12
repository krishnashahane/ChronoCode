const API_BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  analyzeRepo: (path) => request('/repo/analyze', {
    method: 'POST',
    body: JSON.stringify({ path }),
  }),

  getStatus: (sessionId) => request(`/repo/status/${sessionId}`),
  getSummary: (sessionId) => request(`/repo/summary/${sessionId}`),
  getTimeline: (sessionId) => request(`/timeline/${sessionId}`),
  getCommits: (sessionId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/commits/${sessionId}${qs ? '?' + qs : ''}`);
  },
  getDependencies: (sessionId) => request(`/dependencies/${sessionId}`),
  getImpact: (sessionId) => request(`/impact/${sessionId}`),
  getCommitImpact: (sessionId, hash) => request(`/impact/${sessionId}/${hash}`),
  explain: (sessionId, commitHash) => request('/explain', {
    method: 'POST',
    body: JSON.stringify({ sessionId, commitHash }),
  }),
};
