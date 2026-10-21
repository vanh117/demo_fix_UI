// Runs every check: logic (no browser), parent app, moderator console, and the two apps together.
// Usage: node tests/run.js            all suites
//        node tests/run.js logic      one suite (logic | parent | console | bridge)
'use strict';
const SUITES = { logic: './logic', parent: './parent', console: './console', bridge: './bridge' };

(async () => {
  const pick = process.argv.slice(2).filter((a) => SUITES[a]);
  const names = pick.length ? pick : Object.keys(SUITES);
  const started = Date.now();
  let failed = 0;
  for (const name of names) {
    try { failed += await require(SUITES[name])(); }
    catch (e) { failed += 1; console.log(`\n${name}: could not run · ${e.message}`); }
  }
  console.log(`\n${failed ? `${failed} check(s) failed` : 'All checks passed'} · ${names.join(', ')} · ${Math.round((Date.now() - started) / 1000)} s`);
  console.log('Screenshots: tests/output/');
  process.exit(failed ? 1 : 0);
})();
