const { open, overflowX } = require('./lib');
const S = process.argv[2];
const user = { id: 'u1', email: 'ana@exemplo.com', fullName: 'Ana Souza', plan: 'essencial', emailVerified: true,
  limits: { aiMonthly: 50, aiUsed: 2, maxRows: 1e5, canExport: true, shareLinks: false, removeBranding: false } };
(async () => {
  for (const width of [1440, 1024, 768, 375]) {
    for (const u of [null, user]) {
      const { browser, page, logs } = await open({ width, height: 900, user: u });
      const steps = [
        ['landing', async () => {}],
        ['auth', async () => page.evaluate(() => window.__dashOpenAuth('login'))],
        ['plans', async () => page.evaluate(() => window.__dashOpenPlans())],
        ['account', async () => page.evaluate(() => window.__dashOpenAccount('account'))],
        ['billing', async () => page.evaluate(() => window.__dashOpenAccount('billing'))],
        ['upload', async () => { await page.evaluate(() => window.__dashOpenLanding()); await page.waitForTimeout(200); await page.evaluate(() => window.__dashEnterApp()); }],
        ['demo', async () => { await page.evaluate(() => window.__dashOpenLanding()); await page.waitForTimeout(300); await page.getByText('Ver demonstração com dados de exemplo').click(); }],
      ];
      for (const [name, go] of steps) {
        if (!u && (name === 'billing' || name === 'upload')) continue;
        logs.length = 0;
        await go(); await page.waitForTimeout(900);
        await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } window.scrollTo(0, 0); });
        await page.waitForTimeout(300);
        const ov = await overflowX(page);
        const errs = logs.filter(l => !/Babel|ERR_FAILED/.test(l));
        if (ov.scrollW > ov.w || errs.length) {
          console.log(`!! ${width} ${u ? 'logged' : 'anon'} ${name}: scrollW=${ov.scrollW}/${ov.w} errs=${errs.length}`);
          ov.offenders.slice(0, 4).forEach(o => console.log('   OV', o)); errs.slice(0, 4).forEach(e => console.log('   ', e.slice(0, 200)));
        }
        if (width <= 768) await page.screenshot({ path: `${S}/shots/r-${name}-${width}-${u ? 'u' : 'a'}.png` });
      }
      await browser.close();
    }
    console.log('done', width);
  }
})().catch(e => { console.error(e); process.exit(1); });
