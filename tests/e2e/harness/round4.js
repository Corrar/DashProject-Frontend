// Round 4: free AI (1/mês), annual plan, saved dashboards (IndexedDB), analytics queue.
const { open } = require('./lib');
const S = process.argv[2];
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const mkUser = (plan, extra = {}) => ({ id: 'u1', email: 'ana@exemplo.com', fullName: 'Ana Souza', plan, emailVerified: true,
  billingMethod: plan === 'free' ? null : 'card', currentPeriodEnd: plan === 'free' ? null : '2026-11-14T12:00:00.000Z',
  billingCycle: plan === 'free' ? null : 'monthly', autoRenew: plan === 'free' ? null : true,
  limits: { aiMonthly: plan === 'pro' ? 300 : plan === 'essencial' ? 50 : 1, aiUsed: 0, maxRows: plan === 'free' ? 5000 : 1e5, canExport: plan !== 'free', shareLinks: plan === 'pro', removeBranding: plan === 'pro' },
  ...extra });
const text = (page) => page.evaluate(() => document.body.innerText);
const errs = (logs) => logs.filter((l) => !/Babel|ERR_FAILED|blocked-external.*fonts/.test(l) && !/^\[dialog/.test(l));

async function uploadAndGenerate(page, file) {
  await page.setInputFiles('input[type=file]', `${S}/files/${file}`);
  await page.getByRole('button', { name: /^Gerar dashboard/ }).waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: /^Gerar dashboard/ }).click();
  await page.waitForTimeout(2200);
}

(async () => {
  // 1) Anônimo: demo → bloco de IA convida a criar conta, sem chamar a API.
  {
    const { browser, page, logs, api } = await open();
    await page.getByText('Ver demonstração com dados de exemplo').click();
    await page.waitForTimeout(2000);
    const t = await text(page);
    ok(/Crie uma conta grátis e gere 1 análise por mês/.test(t), 'anon: convite de conta no bloco de IA');
    ok(!/Desbloqueie a análise por IA/.test(t), 'anon: sem paywall borrado na demo');
    await page.getByRole('button', { name: 'Criar conta grátis' }).click();
    await page.waitForTimeout(800);
    ok(/Criar conta/i.test(await text(page)) && api.calls.filter((c) => c.includes('analyze')).length === 0, 'anon: CTA abre cadastro e nao chama analyze');
    const q = await page.evaluate(() => (window.vaq || []).map((a) => a[0] + ':' + (a[1] && (a[1].route || a[1].name))));
    ok(q.includes('pageview:/landing') && q.includes('pageview:/dashboard') && q.includes('pageview:/auth') && q.includes('event:demo_aberta'), 'analytics: fila ' + JSON.stringify(q));
    const vaReq = await page.evaluate(() => !!document.querySelector('script[src*="_vercel/insights"]'));
    ok(!vaReq, 'analytics: script nao carrega em localhost');
    ok(errs(logs).length === 0, 'anon: sem erros ' + JSON.stringify(errs(logs)));
    await browser.close();
  }

  // 2) Free logado: 1 análise grátis; com a cota gasta mostra o card sem chamar.
  {
    const { browser, page, logs, api } = await open({ user: mkUser('free') });
    await page.getByText('Ver demonstração com dados de exemplo').click();
    await page.waitForTimeout(2000);
    let t = await text(page);
    ok(/1 análise grátis por mês · 0 de 1 usada/.test(t), 'free: aviso de 1 analise/mes');
    await page.getByRole('button', { name: /Gerar análise/ }).last().click();
    await page.waitForTimeout(1500);
    t = await text(page);
    ok(api.calls.filter((c) => c.includes('analyze')).length === 1 && t.includes('Resumo de teste.'), 'free: analise gerada');
    const q = await page.evaluate(() => (window.vaq || []).filter((a) => a[0] === 'event').map((a) => a[1].name));
    ok(q.includes('analise_ia'), 'analytics: evento analise_ia');
    ok(errs(logs).length === 0, 'free: sem erros ' + JSON.stringify(errs(logs)));
    await browser.close();
    const u = mkUser('free'); u.limits.aiUsed = 1;
    const b = await open({ user: u });
    await b.page.getByText('Ver demonstração com dados de exemplo').click();
    await b.page.waitForTimeout(2000);
    t = await text(b.page);
    ok(/Você já usou a análise grátis deste mês/.test(t) && b.api.calls.filter((c) => c.includes('analyze')).length === 0, 'free: cota gasta mostra card sem chamar');
    await b.page.screenshot({ path: `${S}/shots/r4-free-quota.png`, fullPage: false });
    await b.browser.close();
  }

  // 3) Dashboards salvos: upload → mexe no período → reabre com layout + narrativa.
  {
    const { browser, page, logs, api } = await open({ user: mkUser('essencial') });
    await page.evaluate(() => window.__dashEnterApp());
    await page.waitForTimeout(500);
    ok(!/Continuar de onde parou/.test(await text(page)), 'saved: lista some quando vazia');
    await uploadAndGenerate(page, 'pesquisa.csv');
    await page.getByRole('button', { name: /Gerar análise/ }).last().click();
    await page.waitForTimeout(1500);
    await page.locator('.seg button', { hasText: /^7d$/ }).first().click();
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__dashEnterApp()); // sai antes do debounce: o flush do unmount grava
    await page.waitForTimeout(900);
    let t = await text(page);
    ok(/Continuar de onde parou/.test(t) && /pesquisa\.csv/.test(t), 'saved: lista mostra a base');
    await page.screenshot({ path: `${S}/shots/r4-saved-list.png` });
    const before = api.calls.filter((c) => c.includes('analyze')).length;
    await page.getByTitle('Abrir pesquisa.csv').click();
    await page.waitForTimeout(2000);
    t = await text(page);
    const active = await page.evaluate(() => [...document.querySelectorAll('.seg button.on')].map((b) => b.innerText));
    ok(active.includes('7d'), 'saved: periodo restaurado ' + JSON.stringify(active));
    ok(t.includes('Resumo de teste.') && api.calls.filter((c) => c.includes('analyze')).length === before, 'saved: narrativa restaurada sem nova chamada');
    // 4 uploads no Free → guarda 3
    await browser.close();
    const f = await open({ user: mkUser('free') });
    for (const file of ['pesquisa.csv', 'um_mes.csv', 'vendas_cp1252.csv', 'dados.json']) {
      await f.page.evaluate(() => window.__dashEnterApp());
      await f.page.waitForTimeout(500);
      await uploadAndGenerate(f.page, file);
    }
    await f.page.evaluate(() => window.__dashEnterApp());
    await f.page.waitForTimeout(900);
    const names = await f.page.evaluate(() => [...document.querySelectorAll('section[aria-label="Dashboards salvos"] button[title^="Abrir"]')].map((b) => b.title));
    ok(names.length === 3 && !names.includes('Abrir pesquisa.csv'), 'saved: free guarda os 3 mais recentes ' + JSON.stringify(names));
    // apagar
    f.page.on('dialog', () => {});
    await f.page.evaluate(() => { window.confirm = () => true; });
    await f.page.getByRole('button', { name: 'Apagar dados.json' }).click();
    await f.page.waitForTimeout(600);
    const after = await f.page.evaluate(() => document.querySelectorAll('section[aria-label="Dashboards salvos"] button[title^="Abrir"]').length);
    ok(after === 2, 'saved: apagar remove da lista');
    // desligar salvamento: novo upload não entra
    await f.page.getByLabel('Salvar neste navegador').uncheck();
    await uploadAndGenerate(f.page, 'grande_6k.csv').catch(() => {});
    await f.page.evaluate(() => window.__dashEnterApp());
    await f.page.waitForTimeout(800);
    const off = await f.page.evaluate(() => document.querySelectorAll('section[aria-label="Dashboards salvos"] button[title^="Abrir"]').length);
    ok(off === 2, 'saved: com salvamento desligado nada novo entra (' + off + ')');
    ok(errs(f.logs).length === 0 && errs(logs).length === 0, 'saved: sem erros ' + JSON.stringify(errs(f.logs).concat(errs(logs))));
    await f.browser.close();
  }

  // 4) Plano anual: toggle, checkout com cycle, troca de ciclo do assinante, cancelado.
  {
    const bodies = [];
    const handle = (m, p, body) => { if (m === 'POST' && p.startsWith('/billing/')) { bodies.push([p, JSON.parse(body || '{}')]); return { status: 200, body: p === '/billing/checkout' ? { url: 'http://127.0.0.1:8099/?upgrade=cancel' } : { ok: true, effective: 'next_cycle' } }; } return null; };
    const { browser, page, logs } = await open({ user: mkUser('free'), handle });
    await page.evaluate(() => window.__dashOpenPlans());
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: /Anual/ }).first().click();
    await page.waitForTimeout(300);
    let t = await text(page);
    ok(/R\$ 299\s*\/ano/.test(t) && /R\$ 499\s*\/ano/.test(t) && /equivale a R\$ 41,58\/mês/.test(t), 'anual: precos no toggle');
    ok(/1 análise da IA por mês/.test(t), 'planos: Free com 1 analise');
    await page.screenshot({ path: `${S}/shots/r4-plans-annual.png` });
    await page.getByRole('button', { name: /Assinar no cartão/ }).last().click();
    await page.waitForTimeout(800);
    ok(bodies.some(([p, b]) => p === '/billing/checkout' && b.plan === 'pro' && b.cycle === 'yearly' && b.method === 'card'), 'anual: checkout manda cycle ' + JSON.stringify(bodies));
    await browser.close();

    bodies.length = 0;
    const c = await open({ user: mkUser('pro'), handle, dialogs: 'accept' });
    await c.page.evaluate(() => window.__dashOpenPlans());
    await c.page.waitForTimeout(700);
    await c.page.getByRole('button', { name: /Anual/ }).first().click();
    await c.page.waitForTimeout(300);
    await c.page.getByRole('button', { name: 'Mudar para o anual' }).click();
    await c.page.waitForTimeout(800);
    ok(bodies.some(([p, b]) => p === '/billing/change-plan' && b.plan === 'pro' && b.cycle === 'yearly'), 'anual: troca de ciclo na assinatura ' + JSON.stringify(bodies));
    const dlg = c.logs.find((l) => l.startsWith('[dialog:confirm]'));
    ok(/Mudar o Pro para o plano anual\? .* R\$ 499,00 por ano/.test(dlg || ''), 'anual: confirmacao clara ' + dlg);
    await c.browser.close();

    const x = await open({ user: mkUser('pro', { autoRenew: false }) });
    await x.page.evaluate(() => window.__dashOpenAccount('billing'));
    await x.page.waitForTimeout(800);
    t = await text(x.page);
    ok(/Plano Pro · Cancelado/.test(t) && /acesso até 14\/11\/2026/.test(t) && /Reativar assinatura/.test(t) && !/\bCancelar\b/.test(t.split('Uso e limites')[0]), 'cancelado: faturamento mostra acesso ate a data');
    await x.page.evaluate(() => window.__dashOpenPlans());
    await x.page.waitForTimeout(700);
    t = await text(x.page);
    ok(/Sua assinatura foi cancelada/.test(t) && /Reativar no cartão/.test(t), 'cancelado: planos oferece reativar');
    ok(errs(x.logs).length === 0, 'cancelado: sem erros');
    await x.browser.close();

    const y = await open({ user: mkUser('essencial', { billingCycle: 'yearly' }) });
    await y.page.evaluate(() => window.__dashOpenAccount('billing'));
    await y.page.waitForTimeout(800);
    t = await text(y.page);
    ok(/R\$ 299,00\s*\/ano/.test(t) && /Plano Essencial anual · Ativo/.test(t) && /cartão \(anual\)/.test(t), 'anual: faturamento mostra ciclo');
    await y.browser.close();
  }

  // 5) Landing: toggle anual na seção de preços.
  {
    const { browser, page, logs } = await open();
    await page.locator('#planos').scrollIntoViewIfNeeded();
    await page.locator('#planos').getByRole('button', { name: /Anual/ }).click();
    await page.waitForTimeout(400);
    const t = await page.locator('#planos').innerText();
    ok(/R\$ 499\s*\/ano/.test(t) && /equivale a R\$ 24,92\/mês/.test(t) && /1 análise da IA por mês/.test(t), 'landing: toggle anual');
    await page.locator('#planos').screenshot({ path: `${S}/shots/r4-landing-pricing.png` });
    ok(errs(logs).length === 0, 'landing: sem erros');
    await browser.close();
  }
  console.log(fails ? fails + ' FALHAS' : 'TUDO OK');
})();
