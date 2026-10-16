const { open, overflowX } = require('./lib');
const S = process.argv[2];
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const user = { id: 'u1', email: 'ana@exemplo.com', fullName: 'Ana', plan: 'essencial', emailVerified: true,
  limits: { aiMonthly: 50, aiUsed: 0, maxRows: 1e5, canExport: true, shareLinks: false, removeBranding: false } };
const errs = (logs) => logs.filter((l) => !/Babel|ERR_FAILED/.test(l) && !/^\[dialog/.test(l));
(async () => {
  // Base de vendas: desmarca as quebras → abre em "Sua seleção" só com KPIs + tendência; foco vai para a IA.
  let analyzeBody = null;
  const handle = (m, p, body) => { if (p === '/tools/analyze') { analyzeBody = JSON.parse(body); return { status: 200, body: { narrative: 'Resumo com foco.' } }; } return null; };
  {
    const { browser, page, logs } = await open({ user, handle });
    await page.evaluate(() => window.__dashEnterApp()); await page.waitForTimeout(500);
    ok((await page.locator('.flow-steps li.on').innerText()).includes('Enviar dados'), 'stepper etapa 1');
    await page.setInputFiles('input[type=file]', `${S}/files/vendas_cp1252.csv`);
    await page.getByRole('button', { name: /^Gerar dashboard/ }).waitFor({ timeout: 20000 });
    ok((await page.locator('.flow-steps li.on').innerText()).includes('Escolher métricas'), 'stepper etapa 2');
    await page.getByRole('button', { name: 'Desmarcar grupo' }).last().click();
    await page.getByLabel('Foco da análise por IA').fill('compare as regiões');
    const bar = await page.locator('.flow-actionbar').innerText();
    ok(/4 de 10 métricas/.test(bar) && /3 KPIs · 1 tendência/.test(bar), 'barra de ação resume a seleção: ' + bar.replace(/\s+/g, ' '));
    await page.getByRole('button', { name: /^Gerar dashboard/ }).click();
    await page.waitForTimeout(2200);
    const active = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => /Sua seleção/.test(b.innerText)).map(b => getComputedStyle(b).backgroundColor));
    ok(active.length === 1, 'pill "Sua seleção" presente');
    const charts = await page.evaluate(() => [...document.querySelectorAll('.chart-card')].map(c => c.innerText.split('\n')[0]));
    const kpis = await page.locator('.kpi-card').count();
    ok(kpis === 3 && charts.length === 1 && /Evolução/.test(charts[0]), 'dashboard só com o que foi marcado: kpis=' + kpis + ' charts=' + JSON.stringify(charts));
    ok(/com foco em “compare as regiões”/.test(await page.evaluate(() => document.body.innerText)), 'foco aparece no card da IA');
    await page.getByRole('button', { name: /Gerar análise/ }).last().click();
    await page.waitForTimeout(1200);
    ok(analyzeBody && /Foco pedido pelo usuario: compare as regiões/.test(analyzeBody.question || '') && analyzeBody.question.length <= 500, 'foco enviado na pergunta: ' + (analyzeBody && analyzeBody.question || '').slice(0, 80));
    // outras visões continuam
    await page.locator('button', { hasText: 'Visão geral' }).first().click(); await page.waitForTimeout(700);
    ok((await page.locator('.chart-card').count()) >= 3, 'visão geral continua disponível');
    // donut tem legenda
    const legend = await page.evaluate(() => [...document.querySelectorAll('.chart-card li')].map(l => l.innerText.replace(/\s+/g, ' ')).slice(0, 3));
    ok(legend.length >= 2 && /%/.test(legend[0]), 'donut com legenda ' + JSON.stringify(legend));
    // eixo Y sem rótulos repetidos
    const dupes = await page.evaluate(() => [...document.querySelectorAll('.chart-card svg')].map(svg => [...svg.querySelectorAll('text[text-anchor="end"]')].map(t => t.textContent)).filter(a => new Set(a).size !== a.length));
    ok(dupes.length === 0, 'eixos sem rótulos repetidos ' + JSON.stringify(dupes));
    // ranking sem SKU inventado
    const rank = await page.evaluate(() => document.body.innerText);
    ok(!/SKU-/.test(rank), 'ranking sem SKU inventado');
    // tooltip ao passar o mouse
    const svg = page.locator('.chart-card svg[aria-label="Gráfico de linha"]').first();
    const box = await svg.boundingBox();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5); await page.waitForTimeout(200);
    ok(await svg.locator('rect[rx="8"]').count() === 1, 'tooltip no gráfico de linha');
    ok(errs(logs).length === 0, 'sem erros ' + JSON.stringify(errs(logs)));
    await browser.close();
  }
  // Exemplos: só bases reais (sem nomes de outro assunto)
  {
    const { browser, page, logs } = await open({ user });
    await page.evaluate(() => window.__dashEnterApp()); await page.waitForTimeout(500);
    await page.getByRole('tab', { name: /Exemplo/ }).click();
    const t = await page.evaluate(() => document.body.innerText);
    ok(/vendas_exemplo\.csv/.test(t) && !/churn_saas|funil_marketing|financeiro_q3/.test(t), 'exemplos honestos');
    await page.getByText('vendas_exemplo.csv').click();
    await page.getByRole('button', { name: /^Gerar dashboard/ }).waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: /^Gerar dashboard/ }).click(); await page.waitForTimeout(1500);
    await page.evaluate(() => window.__dashEnterApp()); await page.waitForTimeout(800);
    ok(!/Continuar de onde parou/.test(await page.evaluate(() => document.body.innerText)), 'exemplo não vira dashboard salvo');
    ok(errs(logs).length === 0, 'sem erros (exemplo)');
    await browser.close();
  }
  // Mobile: sem rolagem horizontal no fluxo e no dashboard
  for (const w of [375, 768]) {
    const { browser, page } = await open({ width: w, user });
    await page.evaluate(() => window.__dashEnterApp()); await page.waitForTimeout(500);
    let ov = await overflowX(page); const up = ov.scrollW <= ov.w;
    await page.setInputFiles('input[type=file]', `${S}/files/vendas_cp1252.csv`);
    await page.getByRole('button', { name: /^Gerar dashboard/ }).waitFor({ timeout: 20000 }); await page.waitForTimeout(500);
    ov = await overflowX(page); const pr = ov.scrollW <= ov.w;
    await page.getByRole('button', { name: /^Gerar dashboard/ }).click(); await page.waitForTimeout(2000);
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 50)); } });
    ov = await overflowX(page); const da = ov.scrollW <= ov.w;
    ok(up && pr && da, `sem overflow em ${w}px (upload ${up}, métricas ${pr}, dashboard ${da}) ${JSON.stringify(ov.offenders.slice(0,2))}`);
    await page.screenshot({ path: `${S}/shots/d2/flow-dash-${w}.png` });
    await browser.close();
  }
  console.log(fails ? fails + ' FALHAS' : 'TUDO OK');
})();
