const { open } = require('./lib');
const S = process.argv[2];
const mk = (plan, bm) => ({ id: 'u1', email: 'ana@exemplo.com', fullName: 'Ana', plan, emailVerified: true, billingMethod: bm, currentPeriodEnd: '2026-11-10T12:00:00Z',
  limits: { aiMonthly: 50, aiUsed: 2, maxRows: 1e5, canExport: true, shareLinks: plan==='pro', removeBranding: plan==='pro' } });
(async () => {
  for (const [plan, bm] of [['essencial', 'card'], ['pro', 'card'], ['essencial', 'pix']]) {
    const calls = [];
    const t = await open({ user: mk(plan, bm), dialogs: 'accept', handle: (m, p, body) => { if (p === '/billing/change-plan') { calls.push(body); return { body: { ok: true, plan: JSON.parse(body).plan === 'pro' ? 'pro' : plan, effective: JSON.parse(body).plan === 'pro' ? 'now' : 'next_cycle' } }; } return null; } });
    await t.page.evaluate(() => window.__dashOpenPlans()); await t.page.waitForTimeout(800);
    const btns = await t.page.evaluate(() => [...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(x => /Mudar para|Assinar no cartão|Pagar no Pix|Plano atual|Incluído/.test(x)));
    console.log(`${plan}/${bm}:`, JSON.stringify(btns));
    const target = plan === 'pro' ? 'Mudar para o Essencial' : 'Mudar para o Pro';
    if (bm === 'card') {
      await t.page.getByRole('button', { name: target }).click(); await t.page.waitForTimeout(800);
      console.log('   change call:', calls, '| dialogs:', t.logs.filter(l => l.startsWith('[dialog')).map(l => l.slice(0, 110)));
    }
    await t.page.evaluate(() => window.__dashOpenAccount('billing')); await t.page.waitForTimeout(600);
    console.log('   billing:', await t.page.evaluate(() => (document.body.innerText.match(/(Assinatura no cartão[^\n]*|Pagamento via Pix[^\n]*)/) || [])[0]), '| cancel btn:', await t.page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Cancelar')));
    await t.browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
