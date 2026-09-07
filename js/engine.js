// Canvas renderer + input + scoring. Knows nothing about any specific game:
// it only calls the contract every module in js/games/ exports.
import { PALETTE } from './games/common.js';

const CAP = 1.15; // ARC-AGI-3 caps each level at 1.15x the baseline

export function levelScore(par, actions) {
  if (!actions) return 0;
  return Math.min(CAP, (par / actions) ** 2);
}

// Weighted by 1-indexed level number, so the last level is worth five times
// the first. Levels you never finished score zero and still count.
export function gameScore(scores, levelCount) {
  let num = 0, den = 0;
  for (let i = 0; i < levelCount; i++) {
    const w = i + 1;
    den += w;
    num += w * (scores[i] || 0);
  }
  return den ? num / den : 0;
}

export class Engine {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.listeners = {};
  }

  on(evt, fn) { (this.listeners[evt] ||= []).push(fn); return this; }
  emit(evt, arg) { (this.listeners[evt] || []).forEach((f) => f(arg)); }

  load(game) {
    this.game = game;
    this.scores = new Array(game.levelCount).fill(0);
    this.startLevel(0);
    this.emit('game', game);
  }

  startLevel(li) {
    this.li = li;
    this.state = this.game.init(li);
    this.stack = [];
    this.actions = 0;
    this.won = false;
    this.render();
    this.emit('level', { li, actions: 0 });
  }

  act(a) {
    if (this.won || !this.game.actions.includes(a)) return;
    this.stack.push(this.state);
    this.state = this.game.step(this.state, a);
    this.actions++;
    this.render();
    this.emit('level', { li: this.li, actions: this.actions });
    if (this.game.win(this.state)) this.finish();
  }

  undo() {
    if (this.won || !this.stack.length) return;
    this.state = this.stack.pop();
    this.actions++; // an undo is an action; the real thing counts it too
    this.render();
    this.emit('level', { li: this.li, actions: this.actions });
  }

  reset() { this.startLevel(this.li); }

  finish() {
    this.won = true;
    const par = this.par ? this.par[this.li] : null;
    this.scores[this.li] = par ? levelScore(par, this.actions) : 0;
    this.render();
    this.emit('win', {
      li: this.li, actions: this.actions, par,
      score: this.scores[this.li],
      last: this.li === this.game.levelCount - 1,
    });
  }

  next() {
    if (this.li + 1 < this.game.levelCount) this.startLevel(this.li + 1);
  }

  render() {
    const d = this.game.draw(this.state);
    const { ctx, cv } = this;
    const dpr = window.devicePixelRatio || 1;
    const box = cv.getBoundingClientRect();
    const cell = Math.floor(Math.min(box.width / d.w, box.height / d.h));
    const gw = cell * d.w, gh = cell * d.h;
    const ox = Math.floor((box.width - gw) / 2), oy = Math.floor((box.height - gh) / 2);

    cv.width = Math.round(box.width * dpr);
    cv.height = Math.round(box.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, box.width, box.height);
    ctx.fillStyle = '#0b0b0d';
    ctx.fillRect(0, 0, box.width, box.height);

    for (const c of d.cells) {
      const x = ox + c.x * cell, y = oy + c.y * cell;
      ctx.fillStyle = PALETTE[c.fill] || '#141419';

      if (c.dot) {
        const cx = x + cell / 2, cy = y + cell / 2;
        // A dark collar first. Without it the player vanishes the moment it
        // stands on a cell of its own colour, which is exactly what CHROMA
        // asks you to do at every door.
        ctx.beginPath();
        ctx.arc(cx, cy, cell * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#0b0b0d';
        ctx.fill();

        ctx.fillStyle = PALETTE[c.fill] || '#e5e7eb';
        ctx.globalAlpha = c.ghost ? 0.4 : 1;
        ctx.beginPath();
        ctx.arc(cx, cy, cell * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (c.ghost) {
          ctx.strokeStyle = PALETTE[c.fill];
          ctx.lineWidth = Math.max(1, cell * 0.07);
          ctx.stroke();
        }
        continue;
      }

      const pad = c.pip ? cell * 0.18 : 0;
      ctx.fillRect(x + pad + 0.5, y + pad + 0.5, cell - pad * 2 - 1, cell - pad * 2 - 1);

      if (c.pip) {
        // In TILT the pips are the mechanic: they are the only thing that stops
        // a slide. They have to read as solid blocks, not as texture.
        ctx.fillStyle = '#4a4a5c';
        ctx.fillRect(x + cell * 0.16, y + cell * 0.16, cell * 0.68, cell * 0.68);
      }
      if (c.swatch) {
        ctx.strokeStyle = '#0b0b0d';
        ctx.lineWidth = Math.max(1, cell * 0.08);
        ctx.strokeRect(x + cell * 0.2, y + cell * 0.2, cell * 0.6, cell * 0.6);
      }
      if (c.door) {
        ctx.globalAlpha = c.open ? 1 : 0.35;
        ctx.fillStyle = PALETTE[c.fill];
        ctx.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#0b0b0d';
        ctx.lineWidth = Math.max(1, cell * 0.1);
        ctx.beginPath();
        ctx.moveTo(x + cell * 0.5, y); ctx.lineTo(x + cell * 0.5, y + cell);
        ctx.stroke();
      }
      if (c.ring) {
        ctx.strokeStyle = PALETTE[c.ring];
        ctx.lineWidth = Math.max(1.5, cell * 0.11);
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, cell * 0.3, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (c.exit) {
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = Math.max(1.5, cell * 0.1);
        ctx.strokeRect(x + cell * 0.22, y + cell * 0.22, cell * 0.56, cell * 0.56);
      }
    }
  }
}
