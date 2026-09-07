import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2 });
await p.goto('https://ragnarpitla.github.io/uncued/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.UNCUED);
await p.screenshot({ path: 'qa/live-landing.png', fullPage: true });
await p.click('[data-game="ec04"]');
await p.waitForTimeout(400);
for (const k of ['ArrowRight','ArrowRight','ArrowDown']) { await p.keyboard.press(k); await p.waitForTimeout(120); }
await p.screenshot({ path: 'qa/live-playing.png' });
console.log('picker hidden while playing:', await p.evaluate(() => document.getElementById('picker').getBoundingClientRect().height === 0));
await b.close();
