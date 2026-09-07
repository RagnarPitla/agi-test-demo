// TILT - you do not take a step. You slide until something stops you.
// Sliding across the exit is not arriving at it.
import { parse, DIRS } from './common.js';
import { LEVELS as ALL } from '../levels.js';

const LEVELS = ALL['tl03'];


function build(li) {
  const g = parse(LEVELS[li]);
  let P = null, X = null;
  const solid = new Set();
  const stopper = new Set();
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const c = g.at(x, y), k = x + ',' + y;
      if (c === '#' || c === ' ') solid.add(k);
      else if (c === 'o') { solid.add(k); stopper.add(k); }
      else if (c === 'P') P = [x, y];
      else if (c === 'X') X = [x, y];
    }
  }
  return { g, solid, stopper, P, X };
}

const cache = LEVELS.map((_, i) => build(i));

export default {
  id: 'tl03',
  name: 'TILT',
  blurb: 'Nothing here takes one step.',
  actions: ['UP', 'DOWN', 'LEFT', 'RIGHT'],
  levelCount: LEVELS.length,

  init(li) {
    const b = cache[li];
    return { li, p: b.P.slice(), n: 0 };
  },

  step(s, act) {
    if (!DIRS[act]) return s;
    const b = cache[s.li];
    const [dx, dy] = DIRS[act];
    let [x, y] = s.p;
    while (!b.solid.has((x + dx) + ',' + (y + dy))) { x += dx; y += dy; }
    return { li: s.li, p: [x, y], n: s.n + 1 };
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
        if (c === '#') cells.push({ x, y, fill: 'W' });
        else if (b.stopper.has(k)) cells.push({ x, y, fill: 'F', pip: true });
        else if (b.X[0] === x && b.X[1] === y) cells.push({ x, y, fill: 'F', exit: true });
        else cells.push({ x, y, fill: 'F' });
      }
    }
    cells.push({ x: s.p[0], y: s.p[1], fill: 8, dot: true });
    return { w: b.g.w, h: b.g.h, cells };
  },

  hash(s) { return String(s.p); },
};
