// Proves every shipped level is solvable and that its par is exact.
// Par drives the score every player sees, so a wrong number here is a wrong
// score for everyone. Three controls guard this, and they have to be able to
// fail in different directions to be worth anything:
//
//   A  synthetic, known answer   - a corridor of length n must solve in n
//   B  synthetic, no win state   - must be reported UNSOLVABLE, not solved
//   C  cross-validation          - this BFS walks the real game modules the
//                                  browser runs; tools/gen.mjs derived par with
//                                  separate code. They must agree on all levels.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { PAR } = await import(`${ROOT}/js/levels.js`);

const GAMES = [];
for (const f of ['lockstep', 'chroma', 'tilt', 'echo']) {
  GAMES.push((await import(`${ROOT}/js/games/${f}.js`)).default);
}

function bfs(game, li, { forceNoWin = false, cap = 4_000_000 } = {}) {
  const start = game.init(li);
  if (!forceNoWin && game.win(start)) return { ok: true, par: 0, path: [], visited: 1 };
  const seen = new Set([game.hash(start)]);
  let frontier = [{ s: start, path: [] }];
  let depth = 0, visited = 1;
  while (frontier.length && visited < cap) {
    const next = [];
    depth++;
    for (const node of frontier) {
      for (const act of game.actions) {
        const ns = game.step(node.s, act);
        const h = game.hash(ns);
        if (seen.has(h)) continue;
        seen.add(h); visited++;
        const p = node.path.concat(act);
        if (!forceNoWin && game.win(ns)) return { ok: true, par: p.length, path: p, visited };
        next.push({ s: ns, path: p });
      }
    }
    frontier = next;
    if (depth > 400) break;
  }
  return { ok: false, visited, depth };
}

/* synthetic control game: corridor of length n, only RIGHT makes progress */
function corridor(n) {
  return {
    actions: ['LEFT', 'RIGHT'],
    levelCount: 1,
    init: () => ({ x: 0 }),
    step: (s, a) => ({ x: a === 'RIGHT' ? Math.min(n, s.x + 1) : Math.max(0, s.x - 1) }),
    win: (s) => s.x === n,
    hash: (s) => String(s.x),
  };
}

let fail = 0;
const A = bfs(corridor(7), 0);
if (!A.ok || A.par !== 7) { console.error(`CONTROL A FAILED: corridor(7) -> ok=${A.ok} par=${A.par}, expected 7`); fail++; }
const B = bfs(corridor(7), 0, { forceNoWin: true });
if (B.ok) { console.error('CONTROL B FAILED: a game with no reachable win state was reported solved'); fail++; }
if (B.visited < 8) { console.error(`CONTROL B FAILED: only ${B.visited} states explored, the search is not running`); fail++; }
if (fail) process.exit(1);
console.log(`control A ok  corridor(7) par=${A.par}`);
console.log(`control B ok  unwinnable variant exhausted ${B.visited} states and reported unsolvable\n`);

const out = {};
let bad = 0, mismatch = 0;
for (const g of GAMES) {
  out[g.id] = { name: g.name, blurb: g.blurb, par: [], solution: [] };
  for (let li = 0; li < g.levelCount; li++) {
    const r = bfs(g, li);
    const claimed = PAR[g.id][li];
    if (!r.ok) {
      console.log(`${g.name.padEnd(9)} L${li + 1}  UNSOLVABLE (${r.visited} states)`);
      bad++; out[g.id].par.push(null); out[g.id].solution.push(null);
      continue;
    }
    if (r.par === 0) { console.log(`${g.name.padEnd(9)} L${li + 1}  TRIVIAL - won at start`); bad++; }
    const agree = r.par === claimed;
    if (!agree) mismatch++;
    console.log(`${g.name.padEnd(9)} L${li + 1}  par ${String(r.par).padStart(3)}  states ${String(r.visited).padStart(6)}  ${agree ? 'matches generator' : `MISMATCH: generator said ${claimed}`}`);
    out[g.id].par.push(r.par);
    out[g.id].solution.push(r.path);
  }
  console.log('');
}

fs.writeFileSync(path.join(ROOT, 'tools', 'par.json'), JSON.stringify(out, null, 1));
if (bad) console.log(`FAIL: ${bad} bad level(s)`);
if (mismatch) console.log(`FAIL: control C - ${mismatch} level(s) where the two implementations disagree on par`);
if (!bad && !mismatch) console.log('control C ok  all levels solvable, par agrees across both implementations');
process.exit(bad || mismatch ? 1 : 0);
