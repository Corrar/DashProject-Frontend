const { open } = require('./lib');
const S = process.argv[2];
const mkUser = (plan) => ({ id: 'u1', email: 'ana@exemplo.com', fullName: 'Ana Souza', plan, emailVerified: true,
  limits: { aiMonthly: plan==='pro'?300:plan==='essencial'?50:0, aiUsed: 2, maxRows: plan==='pro'?1e6:plan==='essencial'?1e5:5000, canExport: plan!=='free', shareLinks: plan==='pro', removeBranding: plan==='pro' } });
const cases = [
  ['vendas_cp1252.csv', 'essencial'], ['dados.json', 'essencial'], ['datas.xlsx', 'essencial'], ['pesquisa.csv', 'essencial'],
  ['grande_6k.csv', 'free'], ['um_mes.csv', 'pro'], ['enorme_150k.csv', 'pro'],
];
(async () => {
  for (const [file, plan] of cases) {
    const { browser, page, logs, api } = await open({ width: 1440, height: 900, user: mkUser(plan) });
    await page.evaluate(() => window.__dashEnterApp());
    await page.waitForTimeout(500);
    await page.setInputFiles('input[type=file]', `${S}/files/${file}`);
    try {
      await page.getByRole('button', { name: /^Gerar dashboard/ }).waitFor({ timeout: 20000 });
    } catch (e) {
      const err = await page.evaluate(() => document.body.innerText.match(/.*(linhas e o seu plano|Não consegui|Erro).*/)?.[0]);
      console.log(`== ${file} [${plan}] no prompt view. msg: ${err}`); logs.forEach(l => console.log('   ', l.slice(0, 300)));
      await browser.close(); continue;
    }
    await page.getByRole('button', { name: /^Gerar dashboard/ }).click();
    await page.waitForTimeout(2500);
    // switch to 7d to exercise period filter
    const info = await page.evaluate(() => {
      const t = document.body.innerText;
      const kpis = [...document.querySelectorAll('.kpi-card')].map(k => k.innerText.replace(/\s+/g, ' ').slice(0, 60));
      const pills = [...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(x => /^(Visão geral|Por região|Por produto|Por canal|Avançado|Descoberta)/.test(x));
      const charts = [...document.querySelectorAll('.chart-card')].map(c => c.innerText.split('\n')[0]);
      return { title: t.match(/(Visão geral de vendas|Painel de descoberta)/)?.[0], kpis, pills, charts, bad: t.match(/\b(undefined|NaN|Infinity|\[object Object\])\b/g), mock: t.match(/Mesa Ajust|Marketplace|Loja Física|Móveis|Ana P\.|Retenção média|Anomalias/g) };
    });
    console.log(`== ${file} [${plan}]`, JSON.stringify(info));
    for (const p of ['7d', 'Tudo']) {
      const btn = page.locator('.seg button', { hasText: new RegExp('^' + p + '$') }).first();
      if (await btn.count()) { await btn.click(); await page.waitForTimeout(800); }
    }
    for (const v of info.pills) { await page.locator('button', { hasText: v.split('\n')[0] }).first().click(); await page.waitForTimeout(700); }
    const t2 = await page.evaluate(() => document.body.innerText);
    const ai = api.calls.filter(c => c.includes('analyze')).length;
    console.log(`   after period/view switches: errs=${logs.length} bad=${JSON.stringify(t2.match(/\b(undefined|NaN|Infinity)\b/g))} analyzeCalls=${ai}`);
    logs.slice(0, 6).forEach(l => console.log('   ', l.slice(0, 300)));
    await page.screenshot({ path: `${S}/shots/up-${file}.png`, fullPage: true });
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
