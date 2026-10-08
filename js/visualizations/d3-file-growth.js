import { COLORS } from '../utils/color-scale.js';
import { formatDate, formatNumber } from '../utils/date-utils.js';

const NS = 'http://www.w3.org/2000/svg';

function svgEl(name, attrs = {}) {
  const el = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}

export function renderFileGrowth(container, timeline) {
  if (!Array.isArray(timeline) || !timeline.length) {
    container.textContent = 'No growth data available';
    return;
  }

  container.replaceChildren();
  const margin = { top: 20, right: 20, bottom: 58, left: 58 };
  const width = Math.max(320, container.clientWidth || 760);
  const height = 320;
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const times = timeline.map(d => Date.parse(d.startDate));
  const minT = Math.min(...times);
  const maxT = Math.max(...times, minT + 1);
  const maxFiles = Math.max(1, ...timeline.map(d => Number(d.fileCount) || 0));
  const x = (v) => ((v - minT) / (maxT - minT)) * chartWidth;
  const y = (v) => chartHeight - (v / maxFiles) * chartHeight;

  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-label': 'Codebase growth' });
  const g = svgEl('g', { transform: `translate(${margin.left},${margin.top})` });
  svg.appendChild(g);

  const points = timeline.map(d => [x(Date.parse(d.startDate)), y(Number(d.fileCount) || 0)]);
  let area = `M 0 ${chartHeight}`;
  let line = '';
  points.forEach(([px, py], i) => {
    area += ` L ${px} ${py}`;
    line += (i ? ' L ' : 'M ') + px + ' ' + py;
  });
  area += ` L ${chartWidth} ${chartHeight} Z`;
  g.appendChild(svgEl('path', { d: area, fill: COLORS.purple, 'fill-opacity': 0.12 }));
  g.appendChild(svgEl('path', { d: line, fill: 'none', stroke: COLORS.purple, 'stroke-width': 2 }));

  const maxDelta = Math.max(1, ...timeline.map(d => Math.abs(Number(d.locDelta) || 0)));
  timeline.forEach((item) => {
    const px = x(Date.parse(item.startDate));
    const delta = Number(item.locDelta) || 0;
    const zeroY = chartHeight;
    const barY = delta >= 0 ? chartHeight - (delta / maxDelta) * (chartHeight / 3) : zeroY;
    const barH = Math.abs(delta / maxDelta) * (chartHeight / 3);
    g.appendChild(svgEl('rect', { x: px, y: barY, width: Math.max(2, chartWidth / timeline.length - 2), height: barH, fill: delta >= 0 ? COLORS.emerald : COLORS.red, 'fill-opacity': 0.25 }));
  });

  for (let i = 0; i < 5; i += 1) {
    const value = (maxFiles / 4) * i;
    const yy = y(value);
    g.appendChild(svgEl('line', { x1: 0, y1: yy, x2: chartWidth, y2: yy, stroke: '#1e293b' }));
    const label = svgEl('text', { x: -8, y: yy + 4, 'text-anchor': 'end', fill: '#64748b', 'font-size': 11 });
    label.textContent = formatNumber(Math.round(value));
    g.appendChild(label);
  }

  timeline.forEach((item, index) => {
    if (index % Math.max(1, Math.ceil(timeline.length / 8)) !== 0) return;
    const px = x(Date.parse(item.startDate));
    const label = svgEl('text', { x: px, y: chartHeight + 42, 'text-anchor': 'end', fill: '#64748b', 'font-size': 10, transform: `rotate(-40 ${px} ${chartHeight + 42})` });
    label.textContent = formatDate(item.startDate);
    g.appendChild(label);
  });

  const yLabel = svgEl('text', { transform: 'rotate(-90)', x: -chartHeight / 2, y: -40, 'text-anchor': 'middle', fill: '#64748b', 'font-size': 11 });
  yLabel.textContent = 'File count';
  g.appendChild(yLabel);

  container.appendChild(svg);
}
