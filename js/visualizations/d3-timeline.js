import { COLORS } from '../utils/color-scale.js';
import { formatDate, formatNumber } from '../utils/date-utils.js';

const EVENT_COLORS = {
  tooling: COLORS.purple,
  restructure: COLORS.amber,
  refactor: COLORS.blue,
  milestone: COLORS.emerald,
};

const NS = 'http://www.w3.org/2000/svg';

function svgEl(name, attrs = {}) {
  const el = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}

function showTooltip(container, content, x, y) {
  let tooltip = container.querySelector('.timeline-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'timeline-tooltip';
    container.appendChild(tooltip);
  }
  tooltip.textContent = content;
  tooltip.style.display = 'block';
  tooltip.style.left = `${x + 10}px`;
  tooltip.style.top = `${y - 10}px`;
}

function hideTooltip(container) {
  const tooltip = container.querySelector('.timeline-tooltip');
  if (tooltip) tooltip.style.display = 'none';
}

export function renderTimeline(container, data) {
  const timeline = Array.isArray(data.timeline) ? data.timeline : [];
  const events = Array.isArray(data.events) ? data.events : [];
  if (!timeline.length) {
    container.textContent = 'No timeline data available';
    return;
  }

  container.replaceChildren();
  const margin = { top: 24, right: 20, bottom: 58, left: 56 };
  const width = Math.max(320, container.clientWidth || 760);
  const chartWidth = width - margin.left - margin.right;
  const height = 320;
  const chartHeight = height - margin.top - margin.bottom;
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-label': 'Commit timeline' });
  const g = svgEl('g', { transform: `translate(${margin.left},${margin.top})` });
  svg.appendChild(g);

  const times = timeline.map(d => Date.parse(d.startDate));
  const minT = Math.min(...times);
  const maxT = Math.max(...times, minT + 1);
  const maxCommits = Math.max(1, ...timeline.map(d => Number(d.commitCount) || 0));
  const x = (value) => ((value - minT) / (maxT - minT)) * chartWidth;
  const y = (value) => chartHeight - (value / maxCommits) * chartHeight;
  const barWidth = Math.max(3, chartWidth / timeline.length - 2);

  const axis = svgEl('line', { x1: 0, y1: chartHeight, x2: chartWidth, y2: chartHeight, stroke: '#334155' });
  g.appendChild(axis);

  for (let i = 0; i < 5; i += 1) {
    const value = (maxCommits / 4) * i;
    const yy = y(value);
    g.appendChild(svgEl('line', { x1: 0, y1: yy, x2: chartWidth, y2: yy, stroke: '#1e293b' }));
    const label = svgEl('text', { x: -8, y: yy + 4, 'text-anchor': 'end', fill: '#64748b', 'font-size': 11 });
    label.textContent = formatNumber(Math.round(value));
    g.appendChild(label);
  }

  timeline.forEach((item) => {
    const px = x(Date.parse(item.startDate));
    const py = y(Number(item.commitCount) || 0);
    const rect = svgEl('rect', {
      x: px, y: py, width: barWidth, height: Math.max(0, chartHeight - py), rx: 2,
      fill: item.newDirs?.length ? COLORS.purple : COLORS.blue,
    });
    rect.addEventListener('mouseenter', (event) => {
      showTooltip(
        container,
        `${formatDate(item.startDate)} - ${formatDate(item.endDate)} | ${item.commitCount} commits | +${formatNumber(item.totalAdditions)} / -${formatNumber(item.totalDeletions)} | ${item.fileCount} files`,
        event.offsetX, event.offsetY
      );
    });
    rect.addEventListener('mouseleave', () => hideTooltip(container));
    g.appendChild(rect);
  });

  const maxLoc = Math.max(1, ...timeline.map(d => (Number(d.totalAdditions) || 0) + (Number(d.totalDeletions) || 0)));
  let pathData = '';
  timeline.forEach((item, index) => {
    const px = x(Date.parse(item.startDate)) + barWidth / 2;
    const py = chartHeight - (((Number(item.totalAdditions) || 0) + (Number(item.totalDeletions) || 0)) / maxLoc) * chartHeight;
    pathData += (index ? ' L ' : 'M ') + px + ' ' + py;
  });
  g.appendChild(svgEl('path', { d: pathData, fill: 'none', stroke: COLORS.cyan, 'stroke-width': 2, 'stroke-opacity': 0.7 }));

  events.filter(e => Number(e.severity) >= 3).forEach((eventData) => {
    const px = x(Date.parse(eventData.date));
    const group = svgEl('g', { transform: `translate(${px},0)` });
    group.appendChild(svgEl('line', { x1: 0, y1: 0, x2: 0, y2: chartHeight, stroke: EVENT_COLORS[eventData.type] || COLORS.blue, 'stroke-dasharray': '3 3', 'stroke-opacity': 0.35 }));
    group.appendChild(svgEl('circle', { cx: 0, cy: 4, r: 4, fill: EVENT_COLORS[eventData.type] || COLORS.blue }));
    group.addEventListener('mouseenter', (event) => showTooltip(container, `${eventData.title}: ${eventData.description}`, event.offsetX, event.offsetY));
    group.addEventListener('mouseleave', () => hideTooltip(container));
    g.appendChild(group);
  });

  timeline.forEach((item, index) => {
    if (index % Math.max(1, Math.ceil(timeline.length / 8)) !== 0) return;
    const px = x(Date.parse(item.startDate));
    const label = svgEl('text', { x: px, y: chartHeight + 42, 'text-anchor': 'end', fill: '#64748b', 'font-size': 10, transform: `rotate(-40 ${px} ${chartHeight + 42})` });
    label.textContent = formatDate(item.startDate);
    g.appendChild(label);
  });

  const yLabel = svgEl('text', { transform: 'rotate(-90)', x: -chartHeight / 2, y: -40, 'text-anchor': 'middle', fill: '#64748b', 'font-size': 11 });
  yLabel.textContent = 'Commits';
  g.appendChild(yLabel);

  container.appendChild(svg);
}
