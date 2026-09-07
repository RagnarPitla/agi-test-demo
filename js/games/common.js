// Shared level parsing + palette. Pure logic, no DOM: the browser and the
// Node solver both import this file.

export const PALETTE = {
  0: '#0b0b0d', // void / empty
  1: '#3b82f6', // blue
  2: '#ef4444', // red
  3: '#22c55e', // green
  4: '#eab308', // yellow
  5: '#6b7280', // grey
  6: '#d946ef', // magenta
  7: '#f97316', // orange
  8: '#06b6d4', // cyan
  9: '#7f1d1d', // maroon
  W: '#2e2e3a', // wall
  F: '#17171c', // floor
};

export function parse(rows) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const at = (x, y) => (rows[y] || '')[x] || ' ';
  return { w, h, at, rows };
}

export const DIRS = {
  UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0],
};

export const MIRROR = { UP: 'UP', DOWN: 'DOWN', LEFT: 'RIGHT', RIGHT: 'LEFT' };

export function key(o) { return JSON.stringify(o); }
