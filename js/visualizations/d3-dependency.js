import { CATEGORY_COLORS } from '../utils/color-scale.js';

const NS = 'http://www.w3.org/2000/svg';

function svgEl(name, attrs = {}) {
  const el = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}

export function renderDependencyGraph(container, graph) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  if (!nodes.length) {
    container.textContent = 'No dependency data available';
    return;
  }

  container.replaceChildren();
  const width = Math.max(320, container.clientWidth || 760);
  const height = 400;
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-label': 'Dependency graph' });

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.36;
  const root = nodes.find(n => n.id === 'root') || nodes[0];
  const positions = new Map();
  positions.set(root.id, { x: centerX, y: centerY });

  const others = nodes.filter(n => n.id !== root.id);
  others.forEach((node, index) => {
    const angle = (index / Math.max(1, others.length)) * Math.PI * 2;
    positions.set(node.id, { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius });
  });

  const links = Array.isArray(graph.links) ? graph.links : [];
  for (const link of links) {
    const sourceId = typeof link.source === 'string' ? link.source : link.source?.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target?.id;
    const source = positions.get(sourceId);
    const target = positions.get(targetId);
    if (!source || !target || sourceId === targetId) continue;
    svg.appendChild(svgEl('line', {
      x1: source.x, y1: source.y, x2: target.x, y2: target.y,
      stroke: CATEGORY_COLORS[link.category] || CATEGORY_COLORS.other,
      'stroke-opacity': 0.35,
    }));
  }

  for (const node of nodes) {
    const position = positions.get(node.id);
    if (!position) continue;
    const group = svgEl('g', { transform: `translate(${position.x},${position.y})` });
    group.appendChild(svgEl('circle', {
      r: node.id === 'root' ? 12 : 7,
      fill: CATEGORY_COLORS[node.category] || CATEGORY_COLORS.other,
      'fill-opacity': 0.8,
      stroke: '#0f172a',
      'stroke-width': 1.5,
    }));
    const label = svgEl('text', { x: node.id === 'root' ? 16 : 11, y: 4, fill: '#cbd5e1', 'font-size': 11 });
    label.textContent = node.id === 'root' ? 'package.json' : (node.id.length > 18 ? node.id.slice(0, 16) + '…' : node.id);
    group.appendChild(label);
    group.addEventListener('mouseenter', () => {
      group.setAttribute('opacity', '0.85');
      group.appendChild(svgEl('title'));
      group.lastChild.textContent = `${node.id} ${node.version || ''}${node.isDev ? ' (dev)' : ''}`;
    });
    group.addEventListener('mouseleave', () => group.setAttribute('opacity', '1'));
    svg.appendChild(group);
  }

  container.appendChild(svg);
}
