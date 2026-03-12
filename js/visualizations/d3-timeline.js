import { getColor, COLORS } from '../utils/color-scale.js';
import { formatDate, formatNumber } from '../utils/date-utils.js';

const EVENT_COLORS = {
  tooling: COLORS.purple,
  restructure: COLORS.amber,
  refactor: COLORS.blue,
  milestone: COLORS.emerald,
};

export function renderTimeline(container, data) {
  const { timeline, events } = data;
  if (!timeline.length) {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:300px;color:#64748b">No timeline data available</div>';
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

  // Scales
  const x = d3.scaleTime()
    .domain([new Date(timeline[0].startDate), new Date(timeline[timeline.length - 1].endDate)])
    .range([0, width]);

  const maxCommits = d3.max(timeline, d => d.commitCount) || 1;
  const y = d3.scaleLinear()
    .domain([0, maxCommits])
    .range([height, 0]);

  // Axes
  g.append('g')
    .attr('class', 'timeline-axis')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(Math.min(timeline.length, 12)).tickFormat(d3.timeFormat('%b %Y')))
    .selectAll('text')
    .attr('transform', 'rotate(-40)')
    .style('text-anchor', 'end');

  g.append('g')
    .attr('class', 'timeline-axis')
    .call(d3.axisLeft(y).ticks(5));

  // Y-axis label
  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', -45)
    .attr('x', -height / 2)
    .attr('text-anchor', 'middle')
    .attr('fill', '#64748b')
    .attr('font-size', '11px')
    .text('Commits');

  // Bars
  const barWidth = Math.max(2, (width / timeline.length) - 2);

  // Tooltip
  const tooltip = d3.select(container)
    .append('div')
    .attr('class', 'timeline-tooltip')
    .style('display', 'none');

  g.selectAll('.timeline-bar')
    .data(timeline)
    .join('rect')
    .attr('class', 'timeline-bar')
    .attr('x', d => x(new Date(d.startDate)))
    .attr('y', d => y(d.commitCount))
    .attr('width', barWidth)
    .attr('height', d => height - y(d.commitCount))
    .attr('rx', 2)
    .attr('fill', (d, i) => {
      const hasNewDirs = d.newDirs.length > 0;
      return hasNewDirs ? COLORS.purple : COLORS.blue;
    })
    .on('mouseenter', (event, d) => {
      tooltip
        .style('display', 'block')
        .style('left', `${event.offsetX + 10}px`)
        .style('top', `${event.offsetY - 10}px`)
        .html(`
          <div class="tip-title">${formatDate(d.startDate)} - ${formatDate(d.endDate)}</div>
          <div class="tip-meta">
            ${d.commitCount} commits | +${formatNumber(d.totalAdditions)} / -${formatNumber(d.totalDeletions)}<br>
            ${d.fileCount} files | ${d.topDirCount} directories
            ${d.newDirs.length ? '<br>New: ' + d.newDirs.join(', ') : ''}
          </div>
        `);
    })
    .on('mouseleave', () => tooltip.style('display', 'none'));

  // LOC line overlay (secondary y-axis)
  const maxLoc = d3.max(timeline, d => d.totalAdditions + d.totalDeletions) || 1;
  const yLoc = d3.scaleLinear().domain([0, maxLoc]).range([height, 0]);

  const line = d3.line()
    .x(d => x(new Date(d.startDate)) + barWidth / 2)
    .y(d => yLoc(d.totalAdditions + d.totalDeletions))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(timeline)
    .attr('fill', 'none')
    .attr('stroke', COLORS.cyan)
    .attr('stroke-width', 2)
    .attr('stroke-opacity', 0.6)
    .attr('d', line);

  // Event markers
  const filteredEvents = events.filter(e => e.severity >= 3);
  const eventMarkers = g.selectAll('.timeline-event-marker')
    .data(filteredEvents)
    .join('g')
    .attr('class', 'timeline-event-marker')
    .attr('transform', d => `translate(${x(new Date(d.date))},${-8})`);

  eventMarkers.append('polygon')
    .attr('points', '0,-8 5,0 -5,0')
    .attr('fill', d => EVENT_COLORS[d.type] || COLORS.blue);

  eventMarkers.append('line')
    .attr('y1', 0)
    .attr('y2', height + 8)
    .attr('stroke', d => EVENT_COLORS[d.type] || COLORS.blue)
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '3 3')
    .attr('stroke-opacity', 0.4);

  eventMarkers
    .on('mouseenter', (event, d) => {
      tooltip
        .style('display', 'block')
        .style('left', `${event.offsetX + 10}px`)
        .style('top', `${event.offsetY - 10}px`)
        .html(`
          <div class="tip-title">${d.title}</div>
          <div class="tip-meta">${d.description}<br>${formatDate(d.date)}</div>
        `);
    })
    .on('mouseleave', () => tooltip.style('display', 'none'));

  // Legend
  const legend = d3.select(container).append('div').attr('class', 'chart-legend');
  [
    { color: COLORS.blue, label: 'Commits' },
    { color: COLORS.purple, label: 'Commits (new dirs)' },
    { color: COLORS.cyan, label: 'Lines changed' },
    ...Object.entries(EVENT_COLORS).map(([k, v]) => ({ color: v, label: k })),
  ].forEach(({ color, label }) => {
    legend.append('div')
      .attr('class', 'legend-item')
      .html(`<div class="legend-swatch" style="background:${color}"></div>${label}`);
  });
}
