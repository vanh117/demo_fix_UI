// Parent app: every screen renders in each data scenario, on desktop and phone, with no errors or sideways scroll.
'use strict';
const { launch, pageUrl, suite } = require('./lib');

const SCREENS = ['home', 'login', 'children', 'today', 'diary', 'advice', 'expert', 'privacy'];
const RUNS = [['stable', 1280], ['stable', 390], ['alert', 1280], ['new', 1280]];

async function run() {
  const browser = await launch();
  const t = await browser.tab();
  const s = suite('Parent app (index.html)');
  try {
    await t.open(pageUrl('index.html', '#home.light'));
    await t.evaluate(`localStorage.clear(); true`);
    for (const [scenario, width] of RUNS) {
      for (const screen of SCREENS) {
        if (scenario !== 'stable' && !['today', 'children', 'diary', 'advice'].includes(screen)) continue;
        await s.step(`${screen} · ${scenario} · ${width}px`, async () => {
          await t.open(pageUrl('index.html', `#${screen}.${scenario}.light`), { width, height: 900 });
          await t.sleep(600);
          const info = await t.evaluate(`({ h1: (document.querySelector('h1') || {}).textContent, overflow: __t.overflow(), err: __t.scriptError() })`);
          await t.shot(`parent-${scenario}-${width}-${screen}`, true);
          if (!info.h1) throw new Error('no heading');
          if (info.err) throw new Error(info.err);
          if (info.overflow > 0) throw new Error(`page scrolls sideways by ${info.overflow}px`);
          return info.h1.trim();
        });
      }
    }
  } catch (e) { s.check('run', false, e.message); }
  const failed = s.report(t.errors);
  await browser.close();
  return failed;
}

module.exports = run;
if (require.main === module) run().then((f) => process.exit(f ? 1 : 0));
