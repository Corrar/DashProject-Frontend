const { open } = require('./lib');
const fs = require('fs');
const S = process.argv[2];
const csp = JSON.parse(fs.readFileSync('/home/user/DashProject-Frontend/vercel.json', 'utf8')).headers[0].headers.find(h => h.key === 'Content-Security-Policy').value;
const mk = (plan) => ({ id: 'u1', email: 'ana@exemplo.com', fullName: 'Ana', plan, emailVerified: true,
  limits: { aiMonthly: 300, aiUsed: 2, maxRows: 1e6, canExport: true, shareLinks: true, removeBranding: true } });
const handle = (m, p) => (p === '/share' && m === 'GET') ? { body: { links: [] } } : null;
(async () => {
  const t = await open({ user: mk('pro'), csp, handle });
  const { page, logs } = t;
  await page.getByText('Ver demonstração com dados de exemplo').click(); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /Gerar análise/ }).last().click(); await page.waitForTimeout(800);
  await page.locator('.fab-bar button', { hasText: 'Exportar' }).click(); await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^PNG/ }).click();
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByRole('button', { name: /Baixar PNG/ }).click()]);
  console.log('png under CSP:', dl.suggestedFilename());
  // Excel lazy-load (cdn.sheetjs.com) under CSP
  await page.evaluate(() => window.__dashEnterApp()); await page.waitForTimeout(400);
  await page.setInputFiles('input[type=file]', `${S}/files/datas.xlsx`);
  await page.getByRole('button', { name: /^Gerar dashboard/ }).waitFor({ timeout: 20000 });
  console.log('xlsx under CSP: ok');
  const csps = logs.filter(l => /CSP|Content Security Policy|Refused/.test(l));
  console.log('CSP violations:', csps.length ? csps : 'none');
  console.log('other errors:', logs.filter(l => !/Babel|ERR_FAILED|CSP|Refused|cssRules|html-to-image|fonts.googleapis/.test(l)).slice(0, 5));
  await t.browser.close();
})().catch(e => { console.error(e); process.exit(1); });
