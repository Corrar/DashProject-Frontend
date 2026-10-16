# Pendências do Dash

Atualizado em 16/10/2026. Todo o código está na branch `claude/jolly-knuth-fafdvw`
dos dois repositórios (`DashProject-Frontend` e `DashProject-Backend`), ainda
fora da `main`. Marque `[x]` conforme for resolvendo.

## 1. Antes de publicar (bloqueia o lançamento)

- [ ] **Rodar as migrations no Neon** antes do deploy do backend: `npm run migrate`
      apontando `DATABASE_URL` para o Neon. Faltam a **006** (plano anual,
      cancelamento) e a **007** (sessões, arquivo de cobranças, lista de espera).
      Sem elas o `/me` e o login quebram. Elas podem rodar mais de uma vez.
- [ ] **Publicar a branch** nos dois repositórios (merge em `main` ou PR), nesta
      ordem: backend com as migrations aplicadas, depois o frontend.
- [ ] **Termos de Uso e Política de Privacidade**: preencher os campos entre
      colchetes em `termos.html` e `privacidade.html` (razão social, CNPJ,
      endereço, e-mail de contato, nome e e-mail do encarregado).
- [ ] **Revisão jurídica** dos dois textos, em especial a política de reembolso
      do plano anual (marcada `[REVISAR COM ADVOGADO]` em `termos.html`).
- [ ] **E-mail de contato no site**: preencher `window.__CONTACT_EMAIL` no
      `index.html` (vazio esconde o "Fale com a gente" da página de planos).
- [ ] **E-mails transacionais**: verificar um domínio no Resend e definir
      `RESEND_API_KEY` e `EMAIL_FROM` no Render. Com o remetente padrão
      (`onboarding@resend.dev`) confirmação, redefinição de senha e cobranças só
      chegam ao dono da conta Resend.

## 2. Configuração nos painéis

- [ ] **Vercel Web Analytics**: projeto `dash-ja` → Analytics → Enable. As
      visualizações por tela funcionam em qualquer plano; os eventos
      (`cadastro`, `checkout_iniciado`, `analise_ia`…) só no plano Pro da Vercel.
- [ ] **Asaas em produção** (Render): `ASAAS_ENV=production`, `ASAAS_API_KEY`,
      `ASAAS_WEBHOOK_TOKEN`, e o webhook do Asaas apontando para
      `https://<API_URL>/billing/webhook` com os eventos de cobrança e assinatura.
- [ ] **Cron diário** (ex.: cron-job.org): `POST https://<API_URL>/jobs/billing-tick`
      com o header `x-jobs-secret: <JOBS_SECRET>`. Gera renovações Pix, manda
      lembretes, rebaixa planos vencidos e apaga sessões antigas.
- [ ] **Keepalive** (ex.: UptimeRobot) em `GET /health` a cada ~10 min: o Render
      free hiberna depois de 15 minutos parado.
- [ ] **IA**: `GEMINI_API_KEY` no Render (e `GEMINI_MODEL`, se quiser outro modelo).
- [ ] Conferir no Render: `APP_URL` e `CORS_ORIGIN` com o domínio do site,
      `API_URL`, `JWT_ACCESS_SECRET` e `PG_SSL=true`.

## 3. Esperando decisão

- [ ] **Entrar com Google**: criar credenciais OAuth no Google Cloud; o backend
      ainda não tem a rota.
- [ ] **Importar do Google Sheets**: dá para buscar o CSV direto no navegador,
      mas o CORS do export do Google não pôde ser testado no ambiente de
      desenvolvimento (rede bloqueada). Exige liberar `docs.google.com` e
      `*.googleusercontent.com` no `connect-src` da CSP (`vercel.json`).
- [ ] **Indique e ganhe**: definir a recompensa (ex.: um mês grátis para os dois).
- [ ] **Plano Team / Workspace**: a lista de espera já registra os interessados
      (tabela `waitlist`); falta decidir preço e escopo.
- [ ] **Tema escuro**: muitas cores fixas em estilo inline; exige revisar todas as telas.
- [ ] **Dashboard no celular** (< 640px): hoje funciona sem quebrar, mas não foi
      desenhado para telas pequenas.

## 4. Débitos técnicos

- [ ] 2 falhas antigas em `components/dashboard-tests.js` (ranking da descoberta:
      "métrica top = sum").
- [ ] `components/dashboard.jsx` tem ~2.600 linhas (a regra é < 1.000): extrair
      `AINarrative`/`Insights` para `dashboard-insights.jsx` e os parsers para
      `dashboard-parse.jsx`.
- [ ] `CLAUDE.md` §1, §17, §18 e §20 ainda descrevem Supabase/Stripe; o backend
      real é próprio (JWT + Postgres/Neon + Asaas).
- [ ] Unificar `AuthModal` e `AuthView` (dois formulários de login).
- [ ] Rodar `tests/e2e/` e `scripts/smoke/` (backend) em CI no GitHub Actions.
- [ ] O limite de tentativas do backend fica em memória: trocar por Redis ou
      Postgres se o Render passar a ter mais de uma instância.

## 5. Conferir depois do deploy

- [ ] Criar conta, confirmar o e-mail pelo link e entrar.
- [ ] Enviar uma planilha, escolher métricas e gerar o dashboard; gerar a análise
      por IA no Free (1 por mês) e ver o aviso de cota na segunda.
- [ ] Assinar no sandbox do Asaas (cartão mensal e Pix anual) e ver o plano mudar.
- [ ] Trocar de mensal para anual, cancelar e ver "acesso até DD/MM".
- [ ] Faturamento mostra as faturas do Asaas com link; Histórico mostra as análises.
- [ ] Encerrar uma sessão em outro navegador; trocar a senha.
- [ ] Baixar meus dados e excluir uma conta de teste (a assinatura some do Asaas).
- [ ] Vercel → Analytics recebendo visualizações.

Como testar localmente: `tests/e2e/README.md` (frontend) e
`scripts/smoke/README.md` (backend).
