// Tiny Chrome DevTools Protocol driver for the prototype's browser tests. No npm packages: Node 22+ (global fetch and
// WebSocket) and an installed Edge or Chrome. Set BROWSER=/path/to/browser to choose one.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'output');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findBrowser() {
  const local = process.env.LOCALAPPDATA || '';
  const candidates = [
    process.env.BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(local, 'Google/Chrome/Application/chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
  ].filter(Boolean);
  const hit = candidates.find((p) => fs.existsSync(p));
  if (!hit) throw new Error('No Edge or Chrome found. Set BROWSER=/path/to/chrome and run again.');
  return hit;
}

const pageUrl = (file, suffix = '') => pathToFileURL(path.join(ROOT, file)).href + suffix;

async function launch() {
  fs.mkdirSync(OUT, { recursive: true });
  const port = 9300 + Math.floor(Math.random() * 600);
  const profile = path.join(OUT, `.profile-${port}`);
  const proc = spawn(findBrowser(), ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let first;
  for (let i = 0; i < 80 && !first; i++) {
    try { first = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch (e) { /* starting */ }
    if (!first) await sleep(250);
  }
  if (!first) { proc.kill(); throw new Error('Browser did not start'); }
  const tabs = [];
  const browser = {
    async tab() {
      const target = tabs.length === 0 ? first : await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
      const t = await connect(target.webSocketDebuggerUrl);
      tabs.push(t);
      return t;
    },
    async close() {
      tabs.forEach((t) => t.ws.close());
      proc.kill();
      await sleep(400);
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* still locked; harmless */ }
    },
  };
  return browser;
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); if (msg.error) rej(new Error(msg.error.message)); else res(msg.result); }
    if (msg.method === 'Runtime.exceptionThrown') errors.push('EXCEPTION ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      const text = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
      if (!/Tracking Prevention/i.test(text)) errors.push(('CONSOLE ' + text).slice(0, 400));
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable');
  await send('Page.enable');

  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('in page: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).split('\n')[0]);
    return r.result.value;
  };
  /* page-side helpers: find by visible text, click, and set React-controlled inputs */
  const helpers = `window.__t = {
    visible: (e) => !!(e.offsetParent || e.getClientRects().length),
    byText(t, sel = 'button, a, [role=switch], label, summary', root = document) {
      return [...root.querySelectorAll(sel)].filter((e) => this.visible(e)).find((e) => e.textContent.replace(/\\s+/g, ' ').trim().includes(t)); },
    click(t, sel, root) { const e = typeof t === 'string' ? this.byText(t, sel, root) : t; if (!e) throw new Error('no element: ' + t); e.click(); return true; },
    set(target, v) { const el = typeof target === 'string' ? document.querySelector(target) : target; if (!el) throw new Error('no input: ' + target);
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; },
    has: (t) => document.body.innerText.includes(t),
    overflow: () => document.documentElement.scrollWidth - window.innerWidth,
    scriptError: () => (document.getElementById('proto-error') || {}).textContent || '',
  }; true`;
  const t = {
    ws, errors, evaluate,
    async open(url, { width = 1440, height = 1000 } = {}) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });
      /* a URL that only differs after # would not reload, and the parent app reads its hash once at boot */
      await send('Page.navigate', { url: 'about:blank' });
      await sleep(150);
      await send('Page.navigate', { url });
      await sleep(500);
      for (let i = 0; i < 80; i++) { try { if (await evaluate(`document.readyState === 'complete' && !!document.querySelector('#app > *')`)) break; } catch (e) { /* navigating */ } await sleep(200); }
      await evaluate(helpers);
      await sleep(700);
    },
    async reload() { await send('Page.reload'); await sleep(500); for (let i = 0; i < 80; i++) { try { if (await evaluate(`!!document.querySelector('#app > *')`)) break; } catch (e) { /* loading */ } await sleep(200); } await evaluate(helpers); await sleep(700); },
    async waitText(text, ms = 8000) {
      for (let i = 0; i < ms / 150; i++) { if (await evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`)) return true; await sleep(150); }
      throw new Error('never appeared: ' + text);
    },
    async waitGone(text, ms = 8000) {
      for (let i = 0; i < ms / 150; i++) { if (!(await evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`))) return true; await sleep(150); }
      throw new Error('never went away: ' + text);
    },
    async shot(name, full = false) {
      let clip;
      if (full) { const m = await send('Page.getLayoutMetrics'); const s = m.cssContentSize || m.contentSize; clip = { x: 0, y: 0, width: s.width, height: Math.min(s.height, 8000), scale: 1 }; }
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, ...(clip ? { clip } : {}) });
      fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
    },
    sleep,
  };
  return t;
}

/* collects PASS/FAIL lines; a failing step records the error and the run goes on */
function suite(title) {
  const lines = [];
  let failed = 0;
  return {
    async step(name, fn) {
      try { const note = await fn(); lines.push(`  PASS  ${name}${note ? `  · ${note}` : ''}`); }
      catch (e) { failed += 1; lines.push(`  FAIL  ${name}  · ${e.message}`); }
    },
    check(name, ok, note = '') { if (!ok) failed += 1; lines.push(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${note ? `  · ${note}` : ''}`); },
    report(errors = []) {
      console.log(`\n${title}`);
      console.log(lines.join('\n'));
      if (errors.length) { failed += errors.length; console.log('  runtime errors:\n    ' + errors.join('\n    ')); }
      return failed;
    },
  };
}

module.exports = { launch, pageUrl, suite, sleep, OUT };
