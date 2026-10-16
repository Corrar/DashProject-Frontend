const { open } = require('./lib');
const S = process.argv[2]; const OUT = process.argv[3] || 'd2';
const user = { id: 'u1', email: 'ana@exemplo.com', fullName: 'Ana Souza', plan: 'free', emailVerified: true,
  limits: { aiMonthly: 1, aiUsed: 0, maxRows: 5000, canExport: false, shareLinks: false, removeBranding: false } };
(async () => {
  const a = await open({ width: 1440, height: 900 });
  await a.page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 80)); } window.scrollTo(0, 0); });
  await a.page.waitForTimeout(800);
  await a.page.screenshot({ path: `${S}/shots/${OUT}/landing-full.png`, fullPage: true });
  await a.page.evaluate(() => window.__dashOpenAuth('signup')); await a.page.waitForTimeout(700);
  await a.page.screenshot({ path: `${S}/shots/${OUT}/auth.png` });
  console.log('anon errs', a.logs.filter(l => !/Babel|ERR_FAILED|401/.test(l)));
  await a.browser.close();
  const b = await open({ width: 1440, height: 900, user });
  await b.page.evaluate(() => window.__dashOpenAccount('billing')); await b.page.waitForTimeout(800);
  await b.page.screenshot({ path: `${S}/shots/${OUT}/account.png` });
  console.log('user errs', b.logs.filter(l => !/Babel|ERR_FAILED/.test(l)));
  await b.browser.close();
})();
