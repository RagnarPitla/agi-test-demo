// ECHO - something else is copying you, one move late.
// Both of you have somewhere to be, and you only get one set of controls.
import { parse, DIRS } from './common.js';
import { LEVELS as ALL } from '../levels.js';

const LEVELS = ALL['ec04'];


function build(li) {
  const g = parse(LEVELS[li]);
  let P = null, S = null, tx = null, ty = null;
  const wall = new Set();
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const c = g.at(x, y), k = x + ',' + y;
      if (c === '#' || c === ' ') wall.add(k);
      else if (c === 'P') P = [x, y];
      else if (c === 'S') S = [x, y];
      else if (c === 'x') tx = [x, y];
      else if (c === 'y') ty = [x, y];
    }
  }
  return { g, wall, P, S, tx, ty };
}

const cache = LEVELS.map((_, i) => build(i));

export default {
  id: 'ec04',
  name: 'ECHO',
  blurb: 'It is one move behind you.',
  actions: ['UP', 'DOWN', 'LEFT', 'RIGHT'],
  levelCount: LEVELS.length,

  init(li) {
    const b = cache[li];
    return { li, p: b.P.slice(), s: b.S.slice(), last: null, n: 0 };
  },

  step(st, act) {
    if (!DIRS[act]) return st;
    const b = cache[st.li];
    const mv = (pos, d) => {
      if (!d) return pos;
      const [dx, dy] = DIRS[d];
      const nx = pos[0] + dx, ny = pos[1] + dy;
      return b.wall.has(nx + ',' + ny) ? pos : [nx, ny];
    };
    return {
      li: st.li,
      p: mv(st.p, act),
      s: mv(st.s, st.last),
      last: act,
      n: st.n + 1,
    };
  },

  win(st) {
    const b = cache[st.li];
    return st.p[0] === b.tx[0] && st.p[1] === b.tx[1]
        && st.s[0] === b.ty[0] && st.s[1] === b.ty[1];
  },

  dead() { return false; },

  draw(st) {
    const b = cache[st.li];
    const cells = [];
    for (let y = 0; y < b.g.h; y++) {
      for (let x = 0; x < b.g.w; x++) {
        const c = b.g.at(x, y);
        if (c === ' ') continue;
        cells.push({ x, y, fill: c === '#' ? 'W' : 'F' });
      }
    }
    cells.push({ x: b.tx[0], y: b.tx[1], fill: 'F', ring: 3 });
    cells.push({ x: b.ty[0], y: b.ty[1], fill: 'F', ring: 6 });
    cells.push({ x: st.s[0], y: st.s[1], fill: 6, dot: true, ghost: true });
    cells.push({ x: st.p[0], y: st.p[1], fill: 3, dot: true });
    return { w: b.g.w, h: b.g.h, cells };
  },

  hash(st) { return st.p + '|' + st.s + '|' + st.last; },
};
