const { open } = require('./lib');
(async () => {
  const { browser, page, logs } = await open({ width: 1280, height: 800 });
  const out = [];
  page.on('console', m => out.push(m.text()));
  await page.addScriptTag({ url: 'http://127.0.0.1:8099/components/dashboard-tests.js' });
  await page.waitForTimeout(1500);
  const fails = out.filter(l => /^FAIL/.test(l));
  console.log(out.filter(l => /pass|fail|PASS|FAIL/.test(l)).slice(-3).join('\n'));
  console.log('FAILS:\n' + fails.join('\n'));
  console.log('page errors:', logs.filter(l => /pageerror/.test(l)));
  await browser.close();
})();
