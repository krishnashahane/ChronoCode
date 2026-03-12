export const COLORS = {
  blue: '#3b82f6',
  purple: '#8b5cf6',
  emerald: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  pink: '#ec4899',
  cyan: '#06b6d4',
  indigo: '#6366f1',
  lime: '#84cc16',
  orange: '#f97316',
};

const PALETTE = Object.values(COLORS);

export function getColor(index) {
  return PALETTE[index % PALETTE.length];
}

export const CATEGORY_COLORS = {
  framework: COLORS.purple,
  testing: COLORS.emerald,
  build: COLORS.amber,
  styling: COLORS.pink,
  database: COLORS.cyan,
  utility: COLORS.blue,
  other: '#64748b',
};

export const IMPACT_COLORS = {
  critical: COLORS.red,
  major: COLORS.amber,
  moderate: COLORS.blue,
  minor: '#64748b',
};
