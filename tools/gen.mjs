// Level generator. Levels are not hand-drawn: for each candidate layout we
// search the real state space from the real start, then pick the goal FROM a
// reachable state at the depth we want. Solvability is structural, and par is
// exact rather than estimated.
//
// Seeded, so `node tools/gen.mjs` reproduces the same levels byte for byte.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

const DIRS = { UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0] };
const MIRROR = { UP: 'UP', DOWN: 'DOWN', LEFT: 'RIGHT', RIGHT: 'LEFT' };
const ACTS = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

function blank(w, h, r, density) {
  const g = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      row.push(x === 0 || y === 0 || x === w - 1 || y === h - 1 ? '#'
        : (r() < density ? '#' : '.'));
    }
    g.push(row);
  }
  return g;
}
const free = (g) => {
  const o = [];
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) if (g[y][x] === '.') o.push([x, y]);
  return o;
};
const pick = (a, r) => a[Math.floor(r() * a.length)];

// A level's par is the shortest route to a WINNING state, and win() is often
// coarser than the search key. CHROMA keys on position+colour but wins on
// position alone; ECHO keys on player+shadow+last-move but wins on the two
// bodies. Taking the depth of any one winning state overstates par - it did,
// by 6 moves on CHROMA L1 - and par feeds the score, so an overstated par
// hands out points nobody earned. Collapse to the shortest per win-group.
function bestPerWinGroup(seen, groupOf) {
  const best = new Map();
  for (const v of seen.values()) {
    const k = groupOf(v.st);
    const cur = best.get(k);
    if (!cur || v.depth < cur.depth) best.set(k, v);
  }
  return [...best.values()];
}

// Plain flood fill over floor, with `blocked` cells treated as wall. Used to
// prove a door is load-bearing: if the exit is still reachable with every door
// sealed, the door is scenery and the level teaches nothing.
function reachable(from, solid, blocked) {
  const seen = new Set([String(from)]);
  const q = [from];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (solid(nx, ny) || blocked.has(k) || seen.has(String([nx, ny]))) continue;
      seen.add(String([nx, ny])); q.push([nx, ny]);
    }
  }
  return seen;
}

/* generic BFS over an arbitrary transition function -> map of stateKey -> {depth, path, st} */
function explore(start, keyOf, stepFns, limit = 60000) {
  const seen = new Map([[keyOf(start), { depth: 0, path: [], st: start }]]);
  let frontier = [start];
  let d = 0;
  while (frontier.length && seen.size < limit) {
    const next = [];
    d++;
    for (const s of frontier) {
      const base = seen.get(keyOf(s));
      for (const act of ACTS) {
        const ns = stepFns(s, act);
        const k = keyOf(ns);
        if (seen.has(k)) continue;
        seen.set(k, { depth: d, path: base.path.concat(act), st: ns });
        next.push(ns);
      }
    }
    frontier = next;
    if (d > 60) break;
  }
  return seen;
}

/* ---------------- LOCKSTEP ---------------- */
function genLockstep(r, { w, h, density, parMin, parMax }) {
  for (let attempt = 0; attempt < 900; attempt++) {
    const g = blank(w, h, r, density);
    const f = free(g);
    if (f.length < 12) continue;
    const A = pick(f, r), B = pick(f, r);
    if (A[0] === B[0] && A[1] === B[1]) continue;
    const solid = (x, y) => g[y] === undefined || g[y][x] === undefined || g[y][x] === '#';
    const mv = (p, d) => {
      const [dx, dy] = DIRS[d]; const nx = p[0] + dx, ny = p[1] + dy;
      return solid(nx, ny) ? p : [nx, ny];
    };
    const start = { a: A, b: B };
    const seen = explore(start, (s) => s.a + '|' + s.b,
      (s, act) => ({ a: mv(s.a, act), b: mv(s.b, MIRROR[act]) }));
    const cands = [...seen.values()].filter((v) => {
      if (v.depth < parMin || v.depth > parMax) return false;
      const { a, b } = v.st;
      if (a[0] === b[0] && a[1] === b[1]) return false;
      // reject mirror-symmetric goals: those never teach the desync
      return !(b[0] === w - 1 - a[0] && b[1] === a[1]);
    });
    if (!cands.length) continue;
    const goal = pick(cands, r);
    const out = g.map((row) => row.slice());
    out[A[1]][A[0]] = 'A'; out[B[1]][B[0]] = 'B';
    out[goal.st.a[1]][goal.st.a[0]] = 'a'; out[goal.st.b[1]][goal.st.b[0]] = 'b';
    return { rows: out.map((r2) => r2.join('')), par: goal.depth };
  }
  return null;
}

/* ---------------- TILT ---------------- */
function genTilt(r, { w, h, pips, parMin, parMax }) {
  for (let attempt = 0; attempt < 900; attempt++) {
    const g = blank(w, h, r, 0);
    const f = free(g);
    for (let i = 0; i < pips; i++) { const p = pick(f, r); g[p[1]][p[0]] = 'o'; }
    const f2 = free(g);
    if (f2.length < 10) continue;
    const P = pick(f2, r);
    const solid = (x, y) => g[y] === undefined || g[y][x] === undefined || g[y][x] === '#' || g[y][x] === 'o';
    const slide = (p, d) => {
      const [dx, dy] = DIRS[d]; let [x, y] = p;
      while (!solid(x + dx, y + dy)) { x += dx; y += dy; }
      return [x, y];
    };
    const seen = explore(P, (p) => String(p), (p, act) => slide(p, act));
    const cands = [...seen.values()].filter((v) => v.depth >= parMin && v.depth <= parMax);
    if (!cands.length) continue;
    const goal = pick(cands, r);
    const out = g.map((row) => row.slice());
    out[P[1]][P[0]] = 'P'; out[goal.st[1]][goal.st[0]] = 'X';
    return { rows: out.map((r2) => r2.join('')), par: goal.depth };
  }
  return null;
}

/* ---------------- CHROMA ---------------- */
function genChroma(r, { w, h, density, colours, doors, parMin, parMax }) {
  const DOORCH = ['a', 'b', 'c', 'd', 'e', 'f'];
  for (let attempt = 0; attempt < 1400; attempt++) {
    const g = blank(w, h, r, density);
    let f = free(g);
    if (f.length < 18) continue;
    const paint = new Map(), door = new Map();
    for (let i = 0; i < colours; i++) {
      const p = pick(f, r); const c = 1 + (i % 6);
      g[p[1]][p[0]] = String(c); paint.set(p[0] + ',' + p[1], c);
      f = free(g);
    }
    for (let i = 0; i < doors; i++) {
      const p = pick(f, r); const c = 1 + Math.floor(r() * colours);
      g[p[1]][p[0]] = DOORCH[c - 1]; door.set(p[0] + ',' + p[1], c);
      f = free(g);
    }
    if (!f.length) continue;
    const P = pick(f, r);
    const solid = (x, y) => g[y] === undefined || g[y][x] === undefined || g[y][x] === '#';
    const step = (s, act) => {
      const [dx, dy] = DIRS[act]; const nx = s.p[0] + dx, ny = s.p[1] + dy, k = nx + ',' + ny;
      if (solid(nx, ny)) return s;
      const d = door.get(k);
      if (d !== undefined && d !== s.c) return s;
      const pa = paint.get(k);
      return { p: [nx, ny], c: pa !== undefined ? pa : s.c, doors: d !== undefined ? s.doors + 1 : s.doors };
    };
    const seen = explore({ p: P, c: 0, doors: 0 }, (s) => s.p + '|' + s.c, step);
    // win() checks position only, so par is the shortest route to the cell
    // whatever colour you arrive carrying.
    const noDoor = reachable(P, solid, new Set(door.keys()));
    const cands = bestPerWinGroup(seen, (st) => String(st.p)).filter((v) => {
      const k = v.st.p[0] + ',' + v.st.p[1];
      if (v.depth < parMin || v.depth > parMax) return false;
      if (paint.has(k) || door.has(k)) return false;
      // the door has to be the only way through, or it is decoration
      return !noDoor.has(String(v.st.p));
    });
    if (!cands.length) continue;
    const goal = pick(cands, r);
    const out = g.map((row) => row.slice());
    out[P[1]][P[0]] = 'P'; out[goal.st.p[1]][goal.st.p[0]] = 'X';
    return { rows: out.map((r2) => r2.join('')), par: goal.depth };
  }
  return null;
}

/* ---------------- ECHO ---------------- */
function genEcho(r, { w, h, density, parMin, parMax }) {
  for (let attempt = 0; attempt < 900; attempt++) {
    const g = blank(w, h, r, density);
    const f = free(g);
    if (f.length < 12) continue;
    const P = pick(f, r), S = pick(f, r);
    if (String(P) === String(S)) continue;
    const solid = (x, y) => g[y] === undefined || g[y][x] === undefined || g[y][x] === '#';
    const mv = (p, d) => {
      if (!d) return p;
      const [dx, dy] = DIRS[d]; const nx = p[0] + dx, ny = p[1] + dy;
      return solid(nx, ny) ? p : [nx, ny];
    };
    const step = (s, act) => ({ p: mv(s.p, act), s: mv(s.s, s.last), last: act });
    const seen = explore({ p: P, s: S, last: null }, (s) => s.p + '|' + s.s + '|' + s.last, step);
    // win() checks the two bodies, not which move you last made, so par is the
    // shortest route to that pair of positions.
    const cands = bestPerWinGroup(seen, (st) => st.p + '|' + st.s)
      .filter((v) => v.depth >= parMin && v.depth <= parMax && String(v.st.p) !== String(v.st.s));
    if (!cands.length) continue;
    const goal = pick(cands, r);
    const out = g.map((row) => row.slice());
    out[P[1]][P[0]] = 'P'; out[S[1]][S[0]] = 'S';
    out[goal.st.p[1]][goal.st.p[0]] = 'x'; out[goal.st.s[1]][goal.st.s[0]] = 'y';
    return { rows: out.map((r2) => r2.join('')), par: goal.depth };
  }
  return null;
}

/* ---------------- drive ---------------- */
const PLAN = {
  ls01: { fn: genLockstep, specs: [
    { w: 10, h: 5, density: 0.00, parMin: 4, parMax: 6 },
    { w: 11, h: 6, density: 0.08, parMin: 7, parMax: 10 },
    { w: 12, h: 7, density: 0.12, parMin: 11, parMax: 15 },
    { w: 13, h: 8, density: 0.14, parMin: 16, parMax: 22 },
    { w: 14, h: 9, density: 0.16, parMin: 23, parMax: 34 },
  ] },
  ch02: { fn: genChroma, specs: [
    { w: 10, h: 6, density: 0.10, colours: 2, doors: 1, parMin: 6, parMax: 10 },
    { w: 11, h: 7, density: 0.14, colours: 2, doors: 2, parMin: 11, parMax: 16 },
    { w: 12, h: 8, density: 0.16, colours: 3, doors: 3, parMin: 17, parMax: 24 },
    { w: 13, h: 9, density: 0.18, colours: 3, doors: 4, parMin: 25, parMax: 34 },
    { w: 14, h: 10, density: 0.20, colours: 4, doors: 5, parMin: 35, parMax: 48 },
  ] },
  tl03: { fn: genTilt, specs: [
    { w: 8, h: 6, pips: 3, parMin: 3, parMax: 4 },
    { w: 10, h: 7, pips: 6, parMin: 5, parMax: 7 },
    { w: 11, h: 8, pips: 9, parMin: 8, parMax: 10 },
    { w: 12, h: 9, pips: 13, parMin: 11, parMax: 14 },
    { w: 13, h: 10, pips: 17, parMin: 15, parMax: 20 },
  ] },
  ec04: { fn: genEcho, specs: [
    { w: 8, h: 5, density: 0.00, parMin: 5, parMax: 8 },
    { w: 9, h: 6, density: 0.08, parMin: 9, parMax: 13 },
    { w: 10, h: 7, density: 0.12, parMin: 14, parMax: 19 },
    { w: 11, h: 8, density: 0.14, parMin: 20, parMax: 27 },
    { w: 12, h: 9, density: 0.16, parMin: 28, parMax: 38 },
  ] },
};

const out = {};
let seedBase = 20260907;
for (const [id, { fn, specs }] of Object.entries(PLAN)) {
  out[id] = [];
  specs.forEach((spec, i) => {
    let got = null, tries = 0;
    while (!got && tries < 60) { got = fn(rng(seedBase + i * 7919 + tries * 104729), spec); tries++; }
    if (!got) { console.error(`FAILED to generate ${id} L${i + 1}`); process.exit(1); }
    out[id].push(got);
    console.log(`${id} L${i + 1}  par ${String(got.par).padStart(3)}  ${got.rows[0].length}x${got.rows.length}  (${tries} tries)`);
  });
  seedBase += 131071;
}

const js = `// GENERATED by tools/gen.mjs - do not edit by hand.
// Every level's goal was taken from a state proven reachable from its start,
// so each one is solvable and its par is exact.
export const LEVELS = ${JSON.stringify(
  Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.map((l) => l.rows)])), null, 1)};

export const PAR = ${JSON.stringify(
  Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.map((l) => l.par)])), null, 1)};
`;
fs.writeFileSync(path.join(ROOT, 'js', 'levels.js'), js);
console.log('\nwrote js/levels.js');
