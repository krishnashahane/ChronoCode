import { CATEGORY_COLORS } from '../utils/color-scale.js';

export function renderDependencyGraph(container, graph) {
  if (!graph.nodes.length) {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:300px;color:#64748b">No dependency data available</div>';
    return;
  }

  container.innerHTML = '';

  const width = container.clientWidth;
  const height = 400;

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  // Tooltip
  const tooltip = d3.select(container)
    .append('div')
    .attr('class', 'timeline-tooltip')
    .style('display', 'none');

  const simulation = d3.forceSimulation(graph.nodes)
    .force('link', d3.forceLink(graph.links).id(d => d.id).distance(80))
    .force('charge', d3.forceManyBody().strength(-120))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(30));

  const link = svg.append('g')
    .selectAll('line')
    .data(graph.links)
    .join('line')
    .attr('class', 'dep-link')
    .attr('stroke', d => CATEGORY_COLORS[d.category] || '#1e293b')
    .attr('stroke-opacity', 0.2);

  const node = svg.append('g')
    .selectAll('g')
    .data(graph.nodes)
    .join('g')
    .attr('class', 'dep-node')
    .call(d3.drag()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }));

  const nodeRadius = (d) => {
    const base = 6;
    const ageBonus = Math.min(10, d.ageDays / 60);
    return base + ageBonus;
  };

  node.append('circle')
    .attr('r', nodeRadius)
    .attr('fill', d => CATEGORY_COLORS[d.category] || '#64748b')
    .attr('stroke', d => d.isDev ? '#1e293b' : CATEGORY_COLORS[d.category] || '#64748b')
    .attr('stroke-dasharray', d => d.isDev ? '3 2' : 'none')
    .attr('fill-opacity', 0.7);

  node.append('text')
    .text(d => d.id.length > 14 ? d.id.slice(0, 12) + '..' : d.id)
    .attr('dx', d => nodeRadius(d) + 4)
    .attr('dy', 3);

  node
    .on('mouseenter', (event, d) => {
      tooltip
        .style('display', 'block')
        .style('left', `${event.offsetX + 10}px`)
        .style('top', `${event.offsetY - 10}px`)
        .html(`
          <div class="tip-title">${d.id}</div>
          <div class="tip-meta">
            ${d.version}<br>
            Category: ${d.category}<br>
            ${d.isDev ? 'devDependency' : 'dependency'}<br>
            Age: ${d.ageDays} days
          </div>
        `);
    })
    .on('mouseleave', () => tooltip.style('display', 'none'));

  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);
    node.attr('transform', d => `translate(${d.x},${d.y})`);
  });

  // Legend
  const legend = d3.select(container).append('div').attr('class', 'chart-legend');
  Object.entries(CATEGORY_COLORS).forEach(([cat, color]) => {
    legend.append('div')
      .attr('class', 'legend-item')
      .html(`<div class="legend-swatch" style="background:${color}"></div>${cat}`);
  });
}
