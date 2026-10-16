const { open } = require('./lib');
const S = process.argv[2];
const mk = (plan) => ({ id: 'u1', email: 'ana@exemplo.com', fullName: 'Ana', plan, emailVerified: true,
  limits: { aiMonthly: plan==='free'?0:50, aiUsed: 2, maxRows: 1e5, canExport: plan!=='free', shareLinks: plan==='pro', removeBranding: plan==='pro' } });
(async () => {
  // Free: locked
  let t = await open({ user: mk('free') });
  await t.page.getByText('Ver demonstração com dados de exemplo').click(); await t.page.waitForTimeout(1500);
  await t.page.locator('.fab-bar button', { hasText: 'Exportar' }).click(); await t.page.waitForTimeout(400);
  await t.page.getByRole('button', { name: /Exportar nos planos pagos/ }).click(); await t.page.waitForTimeout(400);
  console.log('free ->', await t.page.evaluate(() => document.body.innerText.match(/Exportar é um recurso pago/)?.[0]));
  await t.browser.close();

  // Essencial: generate AI, export PNG
  t = await open({ user: mk('essencial'), width: 1440, height: 900 });
  const { page, logs } = t;
  await page.getByText('Ver demonstração com dados de exemplo').click(); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /Gerar análise/ }).last().click(); await page.waitForTimeout(1000);
  await page.locator('.fab-bar button', { hasText: 'Exportar' }).click(); await page.waitForTimeout(500);
  await page.screenshot({ path: `${S}/shots/export-modal.png` });
  await page.getByRole('button', { name: /^PNG/ }).click();
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByRole('button', { name: /Baixar PNG/ }).click()]);
  const out = `${S}/shots/${dl.suggestedFilename()}`; await dl.saveAs(out);
  console.log('png ->', dl.suggestedFilename(), 'exporting class left on body?', await page.evaluate(() => document.body.classList.contains('dash-exporting')));
  // PDF: stub print, capture with print media
  await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
  await page.locator('.fab-bar button', { hasText: 'Exportar' }).click(); await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Baixar PDF/ }).click();
  await page.waitForFunction(() => window.__printed === true, null, { timeout: 15000 });
  console.log('pdf -> title:', await page.evaluate(() => document.title), '| @page:', await page.evaluate(() => document.getElementById('dash-page-size')?.textContent));
  await page.pdf({ path: `${S}/shots/export.pdf`, preferCSSPageSize: true, printBackground: true });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  console.log('after print cleanup:', await page.evaluate(() => [document.title, !!document.getElementById('dash-page-size'), document.body.classList.contains('dash-exporting')]));
  console.log('errors:', logs.filter(l => !/Babel|ERR_FAILED/.test(l)));
  await t.browser.close();
})().catch(e => { console.error(e); process.exit(1); });
