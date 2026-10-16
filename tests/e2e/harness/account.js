const { open, overflowX } = require('./lib');
const S = process.argv[2];
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const errs = (logs) => logs.filter((l) => !/Babel|ERR_FAILED/.test(l) && !/^\[dialog/.test(l) && !/401/.test(l));
const user = { id: 'u1', email: 'ana@exemplo.com', fullName: 'Ana Souza', plan: 'pro', emailVerified: false, createdAt: '2026-03-02T10:00:00Z', waitlist: [],
  billingMethod: 'card', billingCycle: 'monthly', autoRenew: true, currentPeriodEnd: '2026-11-14T12:00:00Z',
  limits: { aiMonthly: 300, aiUsed: 4, maxRows: 1e6, canExport: true, shareLinks: true, removeBranding: true } };
(async () => {
  const calls = [];
  let sessions = [
    { id: 's-cur', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/131', ip: '177.43.•••.42', lastUsedAt: new Date().toISOString(), startedAt: '2026-10-01T10:00:00Z', current: true },
    { id: 's-old', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17) Safari/604', ip: '189.6.•••.18', lastUsedAt: new Date(Date.now() - 3 * 3600e3).toISOString(), startedAt: '2026-09-20T10:00:00Z', current: false },
    { id: 's-win', userAgent: 'Mozilla/5.0 (Windows NT 10.0) Edg/130', ip: '200.1.•••.9', lastUsedAt: new Date(Date.now() - 4 * 86400e3).toISOString(), startedAt: '2026-09-10T10:00:00Z', current: false },
  ];
  const handle = (m, p, body) => {
    calls.push([m, p, body ? JSON.parse(body) : null]);
    if (p === '/me/sessions' && m === 'GET') return { body: { sessions } };
    if (p.startsWith('/me/sessions/') && m === 'DELETE') { sessions = sessions.filter(s => s.id !== p.split('/').pop()); return { body: { ok: true } }; }
    if (p === '/me/sessions/revoke-others') { const n = sessions.filter(s => !s.current).length; sessions = sessions.filter(s => s.current); return { body: { ok: true, revoked: n } }; }
    if (p === '/me/password') return JSON.parse(body).current === 'errada' ? { status: 403, body: { error: 'senha_atual_incorreta' } } : { body: { ok: true, revoked: 2 } };
    if (p === '/me' && m === 'PATCH') return { body: { ok: true } };
    if (p === '/auth/resend-verification') return { body: { ok: true } };
    if (p === '/me/export') return { body: { conta: { email: 'ana@exemplo.com' } } };
    if (p === '/billing/history') return { body: { source: 'asaas', items: [
      { id: 'pay_2', value: 49.9, status: 'CONFIRMED', method: 'CREDIT_CARD', description: 'Plano pro (mensal)', dueDate: '2026-10-14', paidAt: '2026-10-14', invoiceUrl: 'https://www.asaas.com/i/pay_2' },
      { id: 'pay_1', value: 29.9, status: 'OVERDUE', method: 'PIX', description: 'Plano essencial (Pix mensal)', dueDate: '2026-09-14', paidAt: null, invoiceUrl: 'https://www.asaas.com/i/pay_1' },
    ] } };
    if (p === '/me/ai-usage') return { body: { months: [{ month: '2026-09', count: 7 }, { month: '2026-10', count: 4 }], recent: ['2026-10-15T14:10:00Z', '2026-10-12T09:00:00Z'] } };
    if (p === '/me/waitlist') return { body: { ok: true } };
    if (p === '/me' && m === 'DELETE') return JSON.parse(body).password === 'errada' ? { status: 403, body: { error: 'senha_incorreta' } } : { body: { ok: true } };
    return null;
  };
  const { browser, page, logs } = await open({ user, handle, dialogs: 'accept' });
  await page.evaluate(() => window.__dashOpenAccount('account')); await page.waitForTimeout(900);
  let t = await page.evaluate(() => document.body.innerText);
  const main = await page.evaluate(() => document.querySelector('main').innerText);
  ok(!/Em breve/.test(main) && !/Cargo|Telefone|Fuso horário|2 fatores|177\.43\.•••\.42.*São Paulo/.test(main), 'aba Conta sem campos falsos/"Em breve"');
  ok(/Chrome · macOS/.test(t) && /Safari · iOS/.test(t) && /Edge · Windows/.test(t) && /esta sessão/.test(t), 'sessões reais com dispositivo');
  ok(/Conta criada em 02\/03\/2026/.test(t) && /E-mail não confirmado/.test(t), 'perfil com data e status do e-mail');
  // nome
  await page.getByLabel('Nome completo').fill('Ana Lima');
  await page.getByRole('button', { name: 'Salvar nome' }).click(); await page.waitForTimeout(400);
  ok(calls.some(c => c[0] === 'PATCH' && c[1] === '/me' && c[2].fullName === 'Ana Lima'), 'salvar nome');
  // reenviar
  await page.getByRole('button', { name: /Reenviar e-mail/ }).click(); await page.waitForTimeout(400);
  ok(calls.some(c => c[1] === '/auth/resend-verification') && /Enviamos um novo link/.test(await page.evaluate(() => document.body.innerText)), 'reenviar confirmação');
  // senha errada / certa
  await page.getByRole('button', { name: 'Alterar senha' }).click();
  await page.getByLabel('Senha atual').fill('errada'); await page.getByLabel(/^Nova senha/).fill('NovaSenha-123'); await page.getByLabel('Repita a nova senha').fill('NovaSenha-123');
  await page.getByRole('button', { name: 'Salvar nova senha' }).click(); await page.waitForTimeout(400);
  ok(/Senha atual incorreta/.test(await page.evaluate(() => document.body.innerText)), 'senha atual errada mostra erro');
  await page.getByLabel('Senha atual').fill('Senha-forte-1');
  await page.getByRole('button', { name: 'Salvar nova senha' }).click(); await page.waitForTimeout(400);
  ok(/Senha alterada\. 2 outras sessões foram encerradas/.test(await page.evaluate(() => document.body.innerText)), 'troca de senha ok');
  // sessões
  await page.getByRole('button', { name: 'Encerrar', exact: true }).first().click(); await page.waitForTimeout(400);
  ok(calls.some(c => c[0] === 'DELETE' && c[1] === '/me/sessions/s-old'), 'encerrar sessão');
  await page.getByRole('button', { name: 'Encerrar as outras' }).click(); await page.waitForTimeout(400);
  ok(calls.some(c => c[1] === '/me/sessions/revoke-others') && !(await page.evaluate(() => document.body.innerText)).includes('Edge · Windows'), 'encerrar as outras');
  // exportar
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.getByRole('button', { name: /Baixar JSON/ }).click()]);
  ok(dl.suggestedFilename() === 'dash-meus-dados.json', 'baixar meus dados');
  await page.screenshot({ path: `${S}/shots/d3/account-real.png`, fullPage: true });
  // faturamento
  await page.evaluate(() => window.__dashOpenAccount('billing')); await page.waitForTimeout(900);
  t = await page.evaluate(() => document.body.innerText);
  ok(/R\$ 49,90/.test(t) && /Pago/.test(t) && /Vencida/.test(t) && !/Endereço de cobrança/.test(t), 'faturas reais com status');
  const links = await page.evaluate(() => [...document.querySelectorAll('a[href*="asaas.com/i/"]')].map(a => [a.textContent, a.target, a.rel]));
  ok(links.length === 2 && links.some(l => l[0] === 'Pagar') && links.every(l => l[1] === '_blank' && /noopener/.test(l[2])), 'links das faturas ' + JSON.stringify(links));
  // histórico
  await page.evaluate(() => window.__dashOpenAccount('history')); await page.waitForTimeout(900);
  t = await page.evaluate(() => document.body.innerText);
  ok(/Últimos 12 meses\s*11/.test(t) && /15\/10\/2026/.test(t) && !/Reanálise por IA|vendas_exemplo/.test(t), 'histórico de IA real');
  // workspace
  await page.evaluate(() => window.__dashOpenAccount('workspace')); await page.waitForTimeout(700);
  await page.getByRole('button', { name: /Notificar quando/ }).click(); await page.waitForTimeout(400);
  ok(calls.some(c => c[1] === '/me/waitlist' && c[2].feature === 'workspace') && /Te avisaremos/.test(await page.evaluate(() => document.body.innerText)), 'lista de espera do workspace');
  // excluir conta
  await page.evaluate(() => window.__dashOpenAccount('account')); await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Excluir conta…' }).click();
  const del = page.getByRole('button', { name: 'Excluir minha conta' });
  ok(await del.isDisabled(), 'excluir desabilitado sem senha/EXCLUIR');
  await page.getByLabel('Sua senha').fill('errada'); await page.getByLabel(/Digite EXCLUIR/).fill('excluir');
  await del.click(); await page.waitForTimeout(400);
  ok(/Senha atual incorreta|incorreta/.test(await page.evaluate(() => document.body.innerText)), 'senha errada na exclusão');
  await page.getByLabel('Sua senha').fill('Senha-forte-1');
  await del.click(); await page.waitForTimeout(900);
  const d = calls.find(c => c[0] === 'DELETE' && c[1] === '/me' && c[2].password === 'Senha-forte-1');
  ok(d && d[2].confirm === 'EXCLUIR', 'DELETE /me com confirmação');
  ok(logs.some(l => /Sua conta foi excluída/.test(l)) && /Da planilha ao/.test(await page.evaluate(() => document.body.innerText)), 'volta para a landing após excluir');
  ok(errs(logs).length === 0, 'sem erros ' + JSON.stringify(errs(logs)));
  await browser.close();

  // Nova senha pelo link do e-mail
  const rcalls = [];
  const r = await open({ query: '?reset=tok-abc-123456', handle: (m, p, body) => { rcalls.push([p, body && JSON.parse(body)]); if (p === '/auth/reset') return JSON.parse(body).token === 'tok-abc-123456' ? { body: { ok: true } } : { status: 400, body: { error: 'token_invalido' } }; return null; } });
  t = await r.page.evaluate(() => document.body.innerText);
  ok(/Defina uma nova senha/.test(t) && !r.logs.some(l => /dialog:prompt/.test(l)), 'tela de nova senha (sem prompt)');
  ok(!(await r.page.evaluate(() => location.search)).includes('reset'), 'token saiu da URL');
  await r.page.getByLabel(/^Nova senha/).fill('NovaSenha-123');
  await r.page.getByLabel('Repita a nova senha').fill('NovaSenha-12');
  ok(await r.page.getByRole('button', { name: 'Salvar nova senha' }).isDisabled(), 'senhas diferentes bloqueiam');
  await r.page.getByLabel('Repita a nova senha').fill('NovaSenha-123');
  await r.page.getByRole('button', { name: 'Salvar nova senha' }).click(); await r.page.waitForTimeout(500);
  ok(rcalls.some(c => c[0] === '/auth/reset' && c[1].password === 'NovaSenha-123') && /Senha redefinida/.test(await r.page.evaluate(() => document.body.innerText)), 'senha redefinida');
  await r.page.getByRole('button', { name: /^Entrar/ }).click(); await r.page.waitForTimeout(400);
  ok(/Bem-vindo de volta/.test(await r.page.evaluate(() => document.body.innerText)), 'segue para o login');
  ok(errs(r.logs).length === 0, 'sem erros (reset)');
  await r.browser.close();

  for (const w of [375, 768]) {
    const m = await open({ width: w, user, handle });
    for (const sec of ['account', 'billing', 'history']) {
      await m.page.evaluate((s) => window.__dashOpenAccount(s), sec); await m.page.waitForTimeout(700);
      const ov = await overflowX(m.page);
      ok(ov.scrollW <= ov.w, `sem overflow ${sec} ${w}px ${JSON.stringify(ov.offenders.slice(0, 2))}`);
    }
    await m.browser.close();
  }
  console.log(fails ? fails + ' FALHAS' : 'TUDO OK');
})();
