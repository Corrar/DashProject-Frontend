const { open, overflowX } = require('./lib');
const S = process.argv[2];
const mkUser = (plan) => ({ id: 'u1', email: 'ana@exemplo.com', fullName: 'Ana Souza', plan, emailVerified: true,
  limits: { aiMonthly: plan==='pro'?300:plan==='essencial'?50:3, aiUsed: 2, maxRows: plan==='pro'?1e6:plan==='essencial'?1e5:5000, canExport: plan!=='free', shareLinks: plan==='pro', removeBranding: plan==='pro' } });
async function go(page, v) {
  await page.evaluate(() => window.postMessage({ type: '__activate_edit_mode' }, '*'));
  await page.waitForTimeout(200);
  const ok = await page.evaluate((v) => {
    const sel = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'dashboard'));
    if (!sel) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(sel, v); sel.dispatchEvent(new Event('change', { bubbles: true })); return true;
  }, v);
  return ok;
}
(async () => {
  for (const plan of [null, 'free', 'essencial', 'pro']) {
    const width = 1440;
    const { browser, page, logs, api } = await open({ width, height: 900, user: plan ? mkUser(plan) : null });
    console.log(`##### plan=${plan} api=${api.calls.join(', ')}`);
    // Demo dashboard via hero button
    logs.length = 0;
    await page.getByText('Ver demonstração com dados de exemplo').click();
    await page.waitForTimeout(2500);
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 80)); } window.scrollTo(0, 0); });
    await page.waitForTimeout(600);
    let txt = await page.evaluate(() => document.body.innerText);
    console.log(`== demo dashboard: errs=${logs.length} bad=${JSON.stringify(txt.match(/\b(undefined|NaN|\[object Object\]|Infinity)\b/g)||[])}`);
    logs.slice(0, 10).forEach(l => console.log('   ', l.slice(0, 400)));
    await page.screenshot({ path: `${S}/shots/demo-${plan}.png`, fullPage: true });
    for (const v of ['upload', 'account', 'plans']) {
      logs.length = 0;
      if (!(await go(page, v))) { console.log('no select'); continue; }
      await page.waitForTimeout(1000);
      txt = await page.evaluate(() => document.body.innerText);
      console.log(`== ${v}: errs=${logs.length} bad=${JSON.stringify(txt.match(/\b(undefined|NaN|\[object Object\]|Infinity)\b/g)||[])}`);
      logs.slice(0, 10).forEach(l => console.log('   ', l.slice(0, 400)));
      await page.screenshot({ path: `${S}/shots/${v}-${plan}.png`, fullPage: true });
    }
    // account sections
    if (plan) for (const sec of ['workspace', 'billing', 'history', 'referral']) {
      logs.length = 0;
      await page.evaluate((s) => window.__dashOpenAccount?.(s), sec);
      await page.waitForTimeout(700);
      txt = await page.evaluate(() => document.body.innerText);
      console.log(`== account/${sec}: errs=${logs.length} bad=${JSON.stringify(txt.match(/\b(undefined|NaN|\[object Object\]|Infinity)\b/g)||[])}`);
      logs.slice(0, 6).forEach(l => console.log('   ', l.slice(0, 400)));
      await page.screenshot({ path: `${S}/shots/account-${sec}-${plan}.png`, fullPage: true });
    }
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
