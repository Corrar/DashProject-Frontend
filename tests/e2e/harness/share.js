const { open } = require('./lib');
const S = process.argv[2];
const mk = (plan) => ({ id: 'u1', email: 'ana@exemplo.com', fullName: 'Ana', plan, emailVerified: true,
  limits: { aiMonthly: plan==='free'?0:300, aiUsed: 2, maxRows: 1e6, canExport: plan!=='free', shareLinks: plan==='pro', removeBranding: plan==='pro' } });
const store = {};
const handle = (m, p, body) => {
  if (m === 'POST' && p === '/share') { const b = JSON.parse(body); store['AbCdEf123456'] = { title: b.title, payload: b.payload, createdAt: new Date().toISOString() }; return { status: 201, body: { slug: 'AbCdEf123456', url: 'http://127.0.0.1:8099/?s=AbCdEf123456' } }; }
  if (m === 'GET' && p === '/share') return { body: { links: Object.entries(store).map(([slug, v]) => ({ slug, title: v.title, createdAt: v.createdAt, url: 'http://127.0.0.1:8099/?s=' + slug })) } };
  if (m === 'GET' && p.startsWith('/share/')) { const v = store[p.slice(7)]; return v ? { body: v } : { status: 404, body: { error: 'link_nao_encontrado' } }; }
  return null;
};
(async () => {
  // Essencial → paywall Pro
  let t = await open({ user: mk('essencial'), handle });
  await t.page.getByText('Ver demonstração com dados de exemplo').click(); await t.page.waitForTimeout(1500);
  await t.page.locator('.fab-bar button', { hasText: 'Compartilhar' }).click(); await t.page.waitForTimeout(400);
  console.log('essencial ->', await t.page.evaluate(() => document.body.innerText.match(/Link público é do plano Pro/)?.[0]), '|', await t.page.evaluate(() => document.body.innerText.match(/R\$ 49,90/)?.[0]));
  await t.browser.close();
  // Pro → create link
  t = await open({ user: mk('pro'), handle });
  let { page, logs } = t;
  await page.getByText('Ver demonstração com dados de exemplo').click(); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /Gerar análise/ }).last().click(); await page.waitForTimeout(800);
  await page.locator('.fab-bar button', { hasText: 'Compartilhar' }).click(); await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Criar link/ }).click(); await page.waitForTimeout(800);
  console.log('pro link ->', await page.evaluate(() => document.querySelector('input[readonly].mono')?.value), '| links listed:', await page.evaluate(() => document.body.innerText.includes('criado em')));
  await page.screenshot({ path: `${S}/shots/share-modal.png` });
  const snap = store['AbCdEf123456'].payload;
  console.log('snapshot: blocks', snap.blocks.length, 'kinds', [...new Set(snap.blocks.map(b => b.kind))].join(','), 'ai', !!snap.aiSummary, 'size', JSON.stringify(snap).length, 'has raw rows?', JSON.stringify(snap).includes('Carla L.'));
  console.log('errors:', logs.filter(l => !/Babel|ERR_FAILED/.test(l)));
  await t.browser.close();
  // Public page (anonymous)
  t = await open({ query: '?s=AbCdEf123456', handle, width: 1280 });
  await t.page.waitForTimeout(2500);
  await t.page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 80)); } window.scrollTo(0, 0); });
  await t.page.waitForTimeout(1200);
  console.log('public ->', await t.page.evaluate(() => document.body.innerText.slice(0, 200).replace(/\n/g, ' | ')), '| kpis', await t.page.evaluate(() => document.querySelectorAll('.kpi-card').length), 'charts', await t.page.evaluate(() => document.querySelectorAll('.chart-card').length), '| errs', t.logs.filter(l => !/Babel|ERR_FAILED/.test(l)));
  await t.page.screenshot({ path: `${S}/shots/share-public.png`, fullPage: true });
  await t.page.getByRole('button', { name: /Crie o seu grátis/ }).first().click(); await t.page.waitForTimeout(500);
  console.log('cta ->', await t.page.evaluate(() => [location.search, document.body.innerText.match(/Criar conta|Comece grátis/)?.[0]]));
  await t.browser.close();
  t = await open({ query: '?s=naoexiste1234', handle });
  await t.page.waitForTimeout(1500);
  console.log('gone ->', await t.page.evaluate(() => document.body.innerText.match(/Este link não está mais disponível/)?.[0]));
  await t.browser.close();
})().catch(e => { console.error(e); process.exit(1); });
