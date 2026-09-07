// LOCKSTEP - one input moves two bodies. The second one mirrors you.
// Nothing says so. You find out on move one.
import { parse, DIRS, MIRROR } from './common.js';
import { LEVELS as ALL } from '../levels.js';

const LEVELS = ALL['ls01'];


function build(li) {
  const g = parse(LEVELS[li]);
  let A = null, B = null, ta = null, tb = null;
  const wall = new Set();
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const c = g.at(x, y);
      if (c === '#') wall.add(x + ',' + y);
      else if (c === 'A') A = [x, y];
      else if (c === 'B') B = [x, y];
      else if (c === 'a') ta = [x, y];
      else if (c === 'b') tb = [x, y];
    }
  }
  return { g, wall, A, B, ta, tb };
}

const cache = LEVELS.map((_, i) => build(i));

export default {
  id: 'ls01',
  name: 'LOCKSTEP',
  blurb: 'Two bodies. One input.',
  actions: ['UP', 'DOWN', 'LEFT', 'RIGHT'],
  levelCount: LEVELS.length,

  init(li) {
    const b = cache[li];
    return { li, a: b.A.slice(), b: b.B.slice(), n: 0 };
  },

  step(s, act) {
    if (!DIRS[act]) return s;
    const b = cache[s.li];
    const mv = (p, d) => {
      const [dx, dy] = DIRS[d];
      const nx = p[0] + dx, ny = p[1] + dy;
      if (b.wall.has(nx + ',' + ny)) return p;
      if (nx < 0 || ny < 0 || nx >= b.g.w || ny >= b.g.h) return p;
      if (b.g.at(nx, ny) === ' ') return p;
      return [nx, ny];
    };
    return {
      li: s.li,
      a: mv(s.a, act),
      b: mv(s.b, MIRROR[act]),
      n: s.n + 1,
    };
  },

  win(s) {
    const b = cache[s.li];
    return s.a[0] === b.ta[0] && s.a[1] === b.ta[1]
        && s.b[0] === b.tb[0] && s.b[1] === b.tb[1];
  },

  dead() { return false; },

  draw(s) {
    const b = cache[s.li];
    const cells = [];
    for (let y = 0; y < b.g.h; y++) {
      for (let x = 0; x < b.g.w; x++) {
        const c = b.g.at(x, y);
        if (c === ' ') continue;
        let fill = 'F';
        if (c === '#') fill = 'W';
        cells.push({ x, y, fill });
      }
    }
    cells.push({ x: b.ta[0], y: b.ta[1], fill: 'F', ring: 1 });
    cells.push({ x: b.tb[0], y: b.tb[1], fill: 'F', ring: 2 });
    cells.push({ x: s.a[0], y: s.a[1], fill: 1, dot: true });
    cells.push({ x: s.b[0], y: s.b[1], fill: 2, dot: true });
    return { w: b.g.w, h: b.g.h, cells };
  },

  hash(s) { return s.a + '|' + s.b; },
};
