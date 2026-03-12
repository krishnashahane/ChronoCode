import { getColor, COLORS } from '../utils/color-scale.js';
import { formatDate, formatNumber } from '../utils/date-utils.js';

export function renderFileGrowth(container, timeline) {
  if (!timeline.length) {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:300px;color:#64748b">No growth data available</div>';
    return;
  }

  container.innerHTML = '';

  const margin = { top: 30, right: 30, bottom: 60, left: 60 };
  const width = container.clientWidth - margin.left - margin.right;
  const height = 340 - margin.top - margin.bottom;

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom);

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Tooltip
  const tooltip = d3.select(container)
    .append('div')
    .attr('class', 'timeline-tooltip')
    .style('display', 'none');

  const x = d3.scaleTime()
    .domain([new Date(timeline[0].startDate), new Date(timeline[timeline.length - 1].endDate)])
    .range([0, width]);

  // File count area
  const maxFiles = d3.max(timeline, d => d.fileCount) || 1;
  const yFiles = d3.scaleLinear().domain([0, maxFiles]).range([height, 0]);

  const area = d3.area()
    .x(d => x(new Date(d.startDate)))
    .y0(height)
    .y1(d => yFiles(d.fileCount))
    .curve(d3.curveMonotoneX);

  const gradient = svg.append('defs')
    .append('linearGradient')
    .attr('id', 'growthGradient')
    .attr('x1', '0%').attr('y1', '0%')
    .attr('x2', '0%').attr('y2', '100%');

  gradient.append('stop').attr('offset', '0%').attr('stop-color', COLORS.purple).attr('stop-opacity', 0.4);
  gradient.append('stop').attr('offset', '100%').attr('stop-color', COLORS.purple).attr('stop-opacity', 0.05);

  g.append('path')
    .datum(timeline)
    .attr('fill', 'url(#growthGradient)')
    .attr('d', area);

  g.append('path')
    .datum(timeline)
    .attr('fill', 'none')
    .attr('stroke', COLORS.purple)
    .attr('stroke-width', 2)
    .attr('d', d3.line()
      .x(d => x(new Date(d.startDate)))
      .y(d => yFiles(d.fileCount))
      .curve(d3.curveMonotoneX));

  // LOC delta bars (secondary)
  const maxDelta = d3.max(timeline, d => Math.abs(d.locDelta)) || 1;
  const yDelta = d3.scaleLinear()
    .domain([-maxDelta, maxDelta])
    .range([height, 0]);

  const barWidth = Math.max(2, (width / timeline.length) - 2);

  g.selectAll('.delta-bar')
    .data(timeline)
    .join('rect')
    .attr('x', d => x(new Date(d.startDate)))
    .attr('y', d => d.locDelta >= 0 ? yDelta(d.locDelta) : yDelta(0))
    .attr('width', barWidth)
    .attr('height', d => Math.abs(yDelta(d.locDelta) - yDelta(0)))
    .attr('rx', 1)
    .attr('fill', d => d.locDelta >= 0 ? COLORS.emerald : COLORS.red)
    .attr('opacity', 0.25);

  // Axes
  g.append('g')
    .attr('class', 'timeline-axis')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(Math.min(timeline.length, 10)).tickFormat(d3.timeFormat('%b %Y')))
    .selectAll('text')
    .attr('transform', 'rotate(-40)')
    .style('text-anchor', 'end');

  g.append('g')
    .attr('class', 'timeline-axis')
    .call(d3.axisLeft(yFiles).ticks(5));

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', -45)
    .attr('x', -height / 2)
    .attr('text-anchor', 'middle')
    .attr('fill', '#64748b')
    .attr('font-size', '11px')
    .text('File count');

  // Interactive dots
  g.selectAll('.growth-dot')
    .data(timeline)
    .join('circle')
    .attr('cx', d => x(new Date(d.startDate)))
    .attr('cy', d => yFiles(d.fileCount))
    .attr('r', 4)
    .attr('fill', COLORS.purple)
    .attr('stroke', '#06080f')
    .attr('stroke-width', 2)
    .style('cursor', 'pointer')
    .on('mouseenter', (event, d) => {
      tooltip
        .style('display', 'block')
        .style('left', `${event.offsetX + 10}px`)
        .style('top', `${event.offsetY - 10}px`)
        .html(`
          <div class="tip-title">${formatDate(d.startDate)}</div>
          <div class="tip-meta">
            Files: ${formatNumber(d.fileCount)}<br>
            LOC delta: ${d.locDelta >= 0 ? '+' : ''}${formatNumber(d.locDelta)}<br>
            Commits: ${d.commitCount}<br>
            Dirs: ${d.topDirCount}
          </div>
        `);
    })
    .on('mouseleave', () => tooltip.style('display', 'none'));

  // Legend
  const legend = d3.select(container).append('div').attr('class', 'chart-legend');
  [
    { color: COLORS.purple, label: 'File count' },
    { color: COLORS.emerald, label: 'Lines added' },
    { color: COLORS.red, label: 'Lines removed' },
  ].forEach(({ color, label }) => {
    legend.append('div')
      .attr('class', 'legend-item')
      .html(`<div class="legend-swatch" style="background:${color}"></div>${label}`);
  });
}
