# Testes de ponta a ponta (navegador)

Scripts Playwright que abrem o site servido localmente, simulam a API do
backend (`harness/lib.js`) e conferem o comportamento das telas. Não fazem
parte do site: o `.vercelignore` tira esta pasta do deploy.

```bash
cd tests/e2e
./setup.sh                                   # libs do CDN (npm) + base de 150 mil linhas
(cd ../.. && python3 -m http.server 8099 --bind 127.0.0.1 &)
node harness/flow.js "$(pwd)"                # um teste
./run-all.sh                                 # todos
```

| Script | O que cobre |
|---|---|
| `flow.js` | etapas, seleção de métricas real, foco da IA, legenda do donut, eixos, tooltip, exemplos, sem overflow 375/768 |
| `round4.js` | IA grátis (1/mês), plano anual, cancelamento, dashboards salvos (IndexedDB), fila do analytics |
| `account.js` | aba Conta real (perfil, senha, sessões, exportar, excluir), faturas, histórico de IA, lista de espera, tela de nova senha |
| `pass2.js` / `resp.js` | todas as telas por plano e larguras 1440/1024/768/375 sem erro nem rolagem horizontal |
| `upload.js` | CSV cp1252, JSON, Excel, pesquisa, limite do Free, 150 mil linhas |
| `export.js` / `csp.js` | PDF/PNG e a CSP do `vercel.json` aplicada (sem violações) |
| `share.js`, `change.js`, `auth.js`, `ai.js`, `tests.js` | link público, troca de plano, login/reset, IA opt-in, parsers |
| `design-shots.js`, `site-shots.js` | capturas de tela em `shots/` para revisão visual |

Erros esperados nos logs: 401 do `/auth/refresh` no boot anônimo e 403 dos
testes de senha errada (o navegador registra toda resposta de erro). As duas
falhas de `tests.js` (ranking da descoberta) já existiam antes desta suíte.
