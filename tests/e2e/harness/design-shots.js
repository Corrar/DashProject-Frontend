const { open } = require('./lib');
const S = process.argv[2]; const OUT = process.argv[3] || 'd0';
const user = { id: 'u1', email: 'ana@exemplo.com', fullName: 'Ana Souza', plan: 'essencial', emailVerified: true, billingMethod:'card', billingCycle:'monthly', autoRenew:true, currentPeriodEnd:'2026-11-14T12:00:00.000Z',
  limits: { aiMonthly: 50, aiUsed: 2, maxRows: 1e5, canExport: true, shareLinks: false, removeBranding: false } };
(async () => {
  for (const width of [1440, 768]) {
    const { browser, page, logs } = await open({ width, height: 900, user });
    const shot = (n) => page.screenshot({ path: `${S}/shots/${OUT}/${n}-${width}.png` });
    await page.evaluate(() => window.__dashEnterApp()); await page.waitForTimeout(900);
    await shot('1-upload');
    await page.screenshot({ path: `${S}/shots/${OUT}/1b-upload-full-${width}.png`, fullPage: true });
    await page.setInputFiles('input[type=file]', `${S}/files/vendas_cp1252.csv`);
    await page.waitForTimeout(350); await shot('2-processing');
    await page.getByRole('button', { name: /^Gerar dashboard/ }).waitFor({ timeout: 20000 });
    await page.waitForTimeout(600); await shot('3-prompt');
    await page.screenshot({ path: `${S}/shots/${OUT}/3b-prompt-full-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: /^Gerar dashboard/ }).click();
    await page.waitForTimeout(250); await shot('4-generating');
    await page.waitForTimeout(2500); await shot('5-dashboard');
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } window.scrollTo(0, 0); });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${S}/shots/${OUT}/5b-dashboard-full-${width}.png`, fullPage: true });
    console.log(width, 'errs', logs.filter(l => !/Babel|ERR_FAILED/.test(l)));
    await browser.close();
  }
})();
