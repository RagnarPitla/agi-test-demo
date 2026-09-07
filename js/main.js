// Wiring only. PAR comes from js/levels.js, which tools/gen.mjs writes and
// tools/solve.mjs re-derives independently, so the number on the score card is
// the same number two separate searches agreed on.
import { Engine, gameScore } from './engine.js';
import { PAR } from './levels.js';

import lockstep from './games/lockstep.js';
import chroma from './games/chroma.js';
import tilt from './games/tilt.js';
import echo from './games/echo.js';

const GAMES = [lockstep, chroma, tilt, echo];
const $ = (id) => document.getElementById(id);
const pct = (v) => `${(v * 100).toFixed(1)}%`;

const picker = $('picker');
const box = $('console');
const ov = $('ov');
const engine = new Engine($('cv'));

/* ---------- picker ---------- */
for (const g of GAMES) {
  const b = document.createElement('button');
  b.className = 'card';
  b.dataset.game = g.id;
  b.innerHTML = `<div class="id">${g.id}</div>
    <div class="nm">${g.name}</div>
    <div class="bl">${g.blurb}</div>
    <div class="mini">${'<i></i>'.repeat(g.levelCount)}</div>`;
  b.onclick = () => start(g);
  picker.appendChild(b);
}

function start(g) {
  engine.par = PAR[g.id];
  // Unhide BEFORE loading. render() measures the canvas, and a hidden element
  // measures 0x0, which drew nothing and left the first board blank until the
  // player pressed a key.
  picker.hidden = true;
  box.hidden = false;
  ov.hidden = true;
  engine.load(g);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function quit() {
  box.hidden = true;
  picker.hidden = false;
  ov.hidden = true;
}

/* ---------- engine events ---------- */
engine.on('game', (g) => { $('gid').textContent = g.id; $('gname').textContent = g.name; });

engine.on('level', ({ li, actions }) => {
  $('lvl').textContent = `LEVEL ${li + 1} / ${engine.game.levelCount}`;
  $('acts').textContent = actions;
  ov.hidden = true;
});

engine.on('win', ({ li, actions, par, score, last }) => {
  ov.hidden = false;
  if (!last) {
    ov.innerHTML = `<div class="big">LEVEL ${li + 1} CLEAR</div>
      <div class="row">you <b>${actions}</b> &nbsp; par <b>${par}</b> &nbsp; score <b>${pct(score)}</b></div>
      <button id="go">NEXT LEVEL</button>`;
    $('go').onclick = () => engine.next();
    $('go').focus();
    return;
  }
  const total = gameScore(engine.scores, engine.game.levelCount);
  const rows = engine.scores.map((s, i) =>
    `<tr><td>level ${i + 1}</td><td class="n">weight ${i + 1}</td><td class="n">${pct(s)}</td></tr>`).join('');
  ov.innerHTML = `<div class="big">${pct(total)}</div>
    <div class="row">${engine.game.name} complete</div>
    <table>${rows}</table>
    <button id="go">ALL GAMES</button>`;
  $('go').onclick = quit;
  $('go').focus();
});

/* ---------- input ---------- */
const KEYS = {
  ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
  w: 'UP', s: 'DOWN', a: 'LEFT', d: 'RIGHT',
};

addEventListener('keydown', (e) => {
  if (box.hidden) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (KEYS[k]) { e.preventDefault(); engine.act(KEYS[k]); return; }
  if (k === 'z') { e.preventDefault(); engine.undo(); }
  if (k === 'r') { e.preventDefault(); engine.reset(); }
  if (k === 'Escape') quit();
});

document.querySelectorAll('.dpad button').forEach((b) => {
  b.onclick = () => engine.act(b.dataset.act);
});
$('undo').onclick = () => engine.undo();
$('reset').onclick = () => engine.reset();
$('quit').onclick = quit;

addEventListener('resize', () => { if (!box.hidden) engine.render(); });

// hooks for tools/qa.mjs, which replays the solver's exact solutions
window.UNCUED = { engine, GAMES, PAR, start, gameScore };
