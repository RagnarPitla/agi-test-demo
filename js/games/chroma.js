// CHROMA - you carry a colour. Doors only let their own colour through.
// Standing on a swatch repaints you. Picking up the wrong one costs you.
import { parse, DIRS } from './common.js';
import { LEVELS as ALL } from '../levels.js';

const LEVELS = ALL['ch02'];


const DOOR = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 };

function build(li) {
  const g = parse(LEVELS[li]);
  let P = null, X = null;
  const wall = new Set(), paint = new Map(), door = new Map();
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const c = g.at(x, y), k = x + ',' + y;
      if (c === '#' || c === ' ') { wall.add(k); continue; }
      if (c === 'P') P = [x, y];
      else if (c === 'X') X = [x, y];
      else if (/[1-6]/.test(c)) paint.set(k, +c);
      else if (DOOR[c]) door.set(k, DOOR[c]);
    }
  }
  return { g, wall, paint, door, P, X };
}

const cache = LEVELS.map((_, i) => build(i));

export default {
  id: 'ch02',
  name: 'CHROMA',
  blurb: 'You are a colour.',
  actions: ['UP', 'DOWN', 'LEFT', 'RIGHT'],
  levelCount: LEVELS.length,

  init(li) {
    const b = cache[li];
    return { li, p: b.P.slice(), c: 0, n: 0 };
  },

  step(s, act) {
    if (!DIRS[act]) return s;
    const b = cache[s.li];
    const [dx, dy] = DIRS[act];
    const nx = s.p[0] + dx, ny = s.p[1] + dy, k = nx + ',' + ny;
    if (b.wall.has(k)) return s;
    const d = b.door.get(k);
    if (d !== undefined && d !== s.c) return { ...s, n: s.n + 1 };
    const paint = b.paint.get(k);
    return { li: s.li, p: [nx, ny], c: paint !== undefined ? paint : s.c, n: s.n + 1 };
  },

  win(s) {
    const b = cache[s.li];
    return s.p[0] === b.X[0] && s.p[1] === b.X[1];
  },

  dead() { return false; },

  draw(s) {
    const b = cache[s.li];
    const cells = [];
    for (let y = 0; y < b.g.h; y++) {
      for (let x = 0; x < b.g.w; x++) {
        const c = b.g.at(x, y), k = x + ',' + y;
        if (c === ' ') continue;
        if (c === '#') { cells.push({ x, y, fill: 'W' }); continue; }
        const paint = b.paint.get(k), door = b.door.get(k);
        if (paint !== undefined) cells.push({ x, y, fill: paint, swatch: true });
        else if (door !== undefined) cells.push({ x, y, fill: door, door: true, open: door === s.c });
        else if (b.X[0] === x && b.X[1] === y) cells.push({ x, y, fill: 'F', exit: true });
        else cells.push({ x, y, fill: 'F' });
      }
    }
    cells.push({ x: s.p[0], y: s.p[1], fill: s.c || 5, dot: true });
    return { w: b.g.w, h: b.g.h, cells, carry: s.c };
  },

  hash(s) { return s.p + '|' + s.c; },
};
