// Proves the browser build matches the solver. For every level it replays the
// solver's exact move sequence as real keyboard events and requires the page to
// declare a win on the last key and not before.
//
// Controls, because a harness that cannot fail proves nothing:
//   D  par+1 junk moves must score BELOW 1.0   - catches scoring that ignores actions
//   E  a deliberately wrong move sequence must NOT win - catches an always-win page
//
// Usage: node tools/qa.mjs [baseURL]   (default: local static server)
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const par = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'par.json'), 'utf8'));
const KEY = { UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight' };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

let base = process.argv[2];
let server = null;
if (!base) {
  server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('no'); return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'text/plain' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}/`;
}
console.log(`testing ${base}\n`);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.UNCUED, null, { timeout: 15000 });

const shots = path.join(ROOT, 'qa');
fs.rmSync(shots, { recursive: true, force: true });
fs.mkdirSync(shots, { recursive: true });

const openGame = async (id, li) => {
  await page.evaluate(([gid, l]) => {
    const g = window.UNCUED.GAMES.find((x) => x.id === gid);
    window.UNCUED.start(g);
    window.UNCUED.engine.startLevel(l);
  }, [id, li]);
};
const play = async (moves) => { for (const m of moves) await page.keyboard.press(KEY[m]); };
const stat = () => page.evaluate(() => ({
  won: window.UNCUED.engine.won,
  actions: window.UNCUED.engine.actions,
  score: window.UNCUED.engine.scores[window.UNCUED.engine.li],
}));

let fail = 0;
for (const [id, info] of Object.entries(par)) {
  for (let li = 0; li < info.par.length; li++) {
    const sol = info.solution[li], p = info.par[li];
    await openGame(id, li);

    // the win must not fire before the final move
    await play(sol.slice(0, -1));
    const early = await stat();
    if (early.won) { console.log(`${info.name} L${li + 1}  FAIL: won one move early`); fail++; continue; }
    // shoot the board here: after the win an overlay covers it
    await page.locator('.screen').screenshot({ path: path.join(shots, `${id}-L${li + 1}.png`) });

    await play(sol.slice(-1));
    const end = await stat();
    const ok = end.won && end.actions === p && Math.abs(end.score - 1) < 1e-9;
    if (!ok) fail++;
    console.log(`${info.name.padEnd(9)} L${li + 1}  ${ok ? 'ok  ' : 'FAIL'} won=${end.won} actions=${end.actions}/${p} score=${(end.score * 100).toFixed(1)}%`);
  }
}
console.log('');

/* control D: wasted moves must cost you. One move then an undo returns the
   board to the start state, so the solution still applies but two actions are
   already spent. TILT slides, so UP+DOWN is NOT a no-op there - that mistake
   cost this control a false failure first time round. */
await openGame('tl03', 0);
const solD = par.tl03.solution[0];
await play(solD.slice(0, 1));
await page.keyboard.press('z');
await play(solD);
const d = await stat();
const expectD = (par.tl03.par[0] / (par.tl03.par[0] + 2)) ** 2;
if (!d.won) { console.error('CONTROL D FAILED: undo did not restore the start state'); fail++; }
else if (Math.abs(d.score - expectD) > 1e-9) { console.error(`CONTROL D FAILED: scored ${d.score}, expected ${expectD}`); fail++; }
else console.log(`control D ok  par ${par.tl03.par[0]} played in ${d.actions} scores ${(d.score * 100).toFixed(1)}%`);

/* control E: a wrong sequence must not win */
await openGame('tl03', 0);
await play(new Array(solD.length).fill(solD[0] === 'UP' ? 'DOWN' : 'UP'));
const e = await stat();
if (e.won) { console.error('CONTROL E FAILED: a deliberately wrong sequence was accepted as a win'); fail++; }
else console.log(`control E ok  ${solD.length} wrong moves did not win`);

if (errors.length) { console.error(`\npage errors:\n  ${errors.join('\n  ')}`); fail++; }

await browser.close();
if (server) server.close();
console.log(fail ? `\nFAIL: ${fail} problem(s)` : `\nall ${Object.values(par).reduce((n, i) => n + i.par.length, 0)} levels play in the browser exactly as the solver says`);
process.exit(fail ? 1 : 0);
