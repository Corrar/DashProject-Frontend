const { open } = require('./lib');
const S = process.argv[2];
const mkUser = (plan) => ({ id: 'u1', email: 'ana@exemplo.com', fullName: 'Ana Souza', plan, emailVerified: true,
  limits: { aiMonthly: plan==='pro'?300:plan==='essencial'?50:0, aiUsed: 2, maxRows: 1e5, canExport: true, shareLinks: false, removeBranding: false } });
(async () => {
  const { browser, page, logs, api } = await open({ width: 1440, height: 900, user: mkUser('essencial') });
  await page.getByText('Ver demonstração com dados de exemplo').click();
  await page.waitForTimeout(2000);
  const n0 = api.calls.filter(c => c.includes('analyze')).length;
  const idle = await page.evaluate(() => document.body.innerText.match(/Ao gerar, enviamos.*\n?.*/)?.[0]);
  const kpis = await page.evaluate(() => [...document.querySelectorAll('.kpi-card')].map(k => k.innerText.replace(/\s+/g, ' ').slice(0, 40)));
  console.log('analyze before click:', n0, '| consent:', idle, '\nkpis:', kpis);
  await page.getByRole('button', { name: /Gerar análise/ }).last().click();
  await page.waitForTimeout(1500);
  console.log('after click:', api.calls.filter(c => c.includes('analyze')).length, '| summary shown:', await page.evaluate(() => document.body.innerText.includes('Resumo de teste.')));
  await page.locator('.seg button', { hasText: /^7d$/ }).first().click(); await page.waitForTimeout(800);
  await page.evaluate(() => window.__dashOpenAccount('billing')); await page.waitForTimeout(800);
  const billing = await page.evaluate(() => document.body.innerText.match(/Análises da IA neste mês\s*\S+\s*\S+\s*\S+/)?.[0]);
  await page.getByRole('button', { name: /Voltar/ }).first().click(); await page.waitForTimeout(1500);
  console.log('after period+remount:', api.calls.filter(c => c.includes('analyze')).length, '| summary still shown:', await page.evaluate(() => document.body.innerText.includes('Resumo de teste.')), '| billing:', billing);
  console.log('errors:', logs.filter(l => !/Babel|ERR_FAILED/.test(l)));
  await browser.close();
  // Free: paywall modal copy
  const f = await open({ width: 1440, height: 900, user: mkUser('free') });
  await f.page.getByText('Ver demonstração com dados de exemplo').click();
  await f.page.waitForTimeout(1500);
  await f.page.getByRole('button', { name: /Editar/ }).first().click();
  await f.page.waitForTimeout(500);
  console.log('free paywall:', await f.page.evaluate(() => document.body.innerText.match(/Editar o layout[^\n]*\n[^\n]*/)?.[0]), '|', await f.page.evaluate(() => document.body.innerText.match(/A partir do Essencial[\s\S]{0,60}/)?.[0]?.replace(/\s+/g,' ')));
  await f.page.screenshot({ path: `${S}/shots/paywall-free.png` });
  await f.browser.close();
})().catch(e => { console.error(e); process.exit(1); });
