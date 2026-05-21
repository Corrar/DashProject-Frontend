# Dash — CLAUDE.md

Persistent guidance for designing and developing this product. Read me before writing anything.

---

## 1. O que é o Dash

**Dash** é um SaaS de **dashboards gerados por IA**:

- O usuário envia uma base de dados (CSV / Excel / JSON / TSV / Parquet / Google Sheets) ou cola/aponta para uma URL pública.
- A IA detecta o esquema, sugere métricas (KPIs, tendências, quebras por dimensão, análises avançadas) e monta um dashboard interativo.
- O usuário pode editar tudo: arrastar-e-soltar blocos, redimensionar (¼/⅓/½/⅔/full em grid de 12 colunas), trocar tipos de gráfico, dimensão, agregação e cor, e exportar com pré-visualização fiel ao dashboard.
- Existe diferenciação **Free vs Pro** (paywall, blur das análises, locks visuais).

Fluxos: **Landing → Upload → Prompt/Análise → Dashboard**. Mais a tela de Dashboard com presets (Visão geral, Por região, Por produto, Por canal, Avançado-Pro).

**Próxima fase**: integração com **Supabase Auth** (signup/login com e‑mail) + **Stripe Checkout** para ativar o plano Pro real (**R$ 49/mês**). A estrutura no front (`currentUser`, `AuthBubble`, props `onSignIn/onSignOut/onProfile`) já está plumbada — só os handlers são stubs aguardando o backend. Ver §17.

---

## 2. Stack & restrições técnicas

Stack **deliberadamente leve**, sem bundler, roda direto no navegador:

| Camada              | Tecnologia                                                                 |
| ------------------- | -------------------------------------------------------------------------- |
| Estrutura           | HTML5                                                                      |
| Estilo              | CSS3 puro (variáveis CSS, grid, flex, `color-mix`, `@keyframes`)           |
| Lógica              | JavaScript ES6+ vanilla                                                    |
| UI                  | **React 18.3.1** + **JSX**, transpilado com **Babel Standalone 7.29.0**    |
| Gráficos            | **SVG inline** desenhado por funções próprias — **sem libs de chart**      |
| Fontes              | **Geist** e **Geist Mono** via Google Fonts (com `preconnect`)             |
| APIs                | `IntersectionObserver`, `MutationObserver`, HTML5 Drag & Drop, `requestAnimationFrame` |

Regras inegociáveis:

- **Nunca** introduzir bundler / build step / framework pesado (Next, Vite, Webpack).
- **Nunca** importar libs de gráfico externas (Recharts, Chart.js, D3, Plotly). Gráficos novos devem ser construídos com SVG inline seguindo o padrão de `components/charts.jsx`.
- **Nunca** usar Tailwind, CSS-in-JS runtime ou Emotion. Estilo é CSS no `<style>` global do `Dash.html` + `style={{}}` inline em componentes.
- Usar **as versões pinadas** do React/Babel já presentes em `Dash.html` (com `integrity` attributes). Não atualizar sem motivo.
- **JSX só funciona em `<script type="text/babel">`**. Importar com `<script type="text/babel" src="...">` no `Dash.html`, na ordem correta (icons → charts → landing → dashboard → app).
- Componentes que precisam ser usados em outros arquivos JSX **devem ser exportados via `Object.assign(window, { Foo, Bar })`** no final do arquivo. Cada `<script type="text/babel">` é um escopo isolado após transpile.
- Evite `const styles = { … }` em arquivos JSX — em escopo global colide com outros arquivos. Use nomes específicos (`dashboardStyles`) ou inline.

---

## 3. Estrutura do projeto

```
Dash.html                  # entry point — head, estilos globais, ordem de imports
tweaks-panel.jsx           # painel de ajustes em runtime (TweakPanel, useTweaks, etc.)
components/
  icons.jsx                # Icon.{Logo, Sparkle, Wand, Upload, …} — SVG inline
  charts.jsx               # LineChart, BarChart, Donut, Sparkline (SVG)
  landing.jsx              # Landing page com scroll choreography
  dashboard.jsx            # Topbar, UploadView, PromptView, Dashboard, Insights, ChartCard, KPI, ExportModal, MiniBlock, PaywallModal, …
  app.jsx                  # App root: roteamento de views (landing/upload/prompt/dashboard) + tweaks
```

Convenções:

- **Cada arquivo < ~1000 linhas.** Se um arquivo crescer, **divida por feature** (ex.: `dashboard-export.jsx`, `dashboard-insights.jsx`) — não por tipo.
- **Componentes nomeados em PascalCase, exportados explicitamente para `window`.**
- **Não fazer dynamic imports** (`type="module"`).
- Estado global: nenhum store. Cada fluxo carrega seu próprio estado em `App` ou `Dashboard`.

---

## 4. Design system

### Cores (variáveis CSS em `:root`)

| Token            | Uso                                       |
| ---------------- | ----------------------------------------- |
| `--bg`           | fundo geral (off-white quente)            |
| `--bg-2`         | superfície de cards                       |
| `--ink`          | texto primário                            |
| `--ink-2`        | texto secundário                          |
| `--muted`        | texto/ícones desfocados                   |
| `--line`         | bordas / divisórias                       |
| `--line-2`       | divisórias leves / linhas tracejadas      |
| `--brand`        | acento principal (azul `#2f6bff`)          |
| `--brand-2`      | hover do brand                            |
| `--brand-soft`   | fundo suave da marca                      |
| `--accent`       | verde (positivos)                         |
| `--warn`         | laranja                                   |
| `--pink`, `--violet` | acentos secundários                   |

Cores temáticas (positivo/negativo/risco): verdes `#0a8a4a`, vermelhos `#c9234a`, violetas `#7a5cff`.

**Regras:**

- Brand color é **tweakable** via `--brand` (Tweaks panel) — **nunca** hardcodar o azul; sempre `var(--brand)` ou `tweaks.accent` em JS.
- Para mesclar cores dinamicamente use `color-mix(in oklch, X 14%, white)`.
- Não usar saturações > 0.02 em "brancos" — manter tom quente.
- Nunca gerar paletas novas sem motivo. Reutilize `palette = ["#2f6bff", "#0a8a4a", "#7a5cff", "#ff7849", "#ff5e93", "#0b1020"]`.

### Tipografia

- **Geist** sans para tudo; **Geist Mono** para números, código, chips de coluna, valores monetários crus, debug.
- Escalas semânticas:
  - `.h-display` ≈ clamp(40, 6.4vw, 76) — landing hero only
  - `.h-section` ≈ clamp(32, 4.2vw, 56) — section heads
  - títulos de seção `fontSize: 34`, weight 800, letter-spacing `-.02em`
  - títulos de bloco `fontSize: 15-16`, weight 700
  - body `fontSize: 13-14`, line-height 1.5
  - meta/microcopy `fontSize: 11-12`, color `var(--muted)`
- `font-variant-numeric: tabular-nums` em valores numéricos (`.ticker`).
- `letter-spacing: -.02em` em headings; `+.06em` em micro labels uppercase.

### Espaço e radius

- Raios: cards grandes 18, cards médios 14, chips 999, botões 12, pequenos 6-10.
- Gap padrão do grid: 14px (16px em listas grandes).
- Padding de card: 18-24px.
- Sombras: usar `.soft-shadow` (já definida) ou estilo equivalente `0 20px 40px -28px rgba(15,23,42,.18)`.

### Componentes-base reutilizáveis

| Classe / componente | O quê                                                       |
| ------------------- | ----------------------------------------------------------- |
| `.btn`, `.btn-primary`, `.btn-ghost` | botões padrão                              |
| `.card`, `.soft-shadow`             | cards                                       |
| `.chip`                             | pílulas pequenas (tags, badges)             |
| `.eyebrow`                          | sobre-título de seção                       |
| `.seg`                              | segmented control                           |
| `.icon-btn`                         | botão de ícone 32×32                        |
| `.kpi-card`, `.chart-card`          | shells dos blocos do dashboard              |
| `.fab-bar`                          | toolbar flutuante                           |
| `.block-menu-btn`, `.block-menu`    | menu 3-pontos por bloco                     |
| `.paywall-blur`, `.pw-card`         | blur + card de upgrade                      |
| `.rv` + `.rv.in`                    | reveal por scroll (com `useReveal()`)       |

**Não invente novos botões/cards/chips antes de verificar se já existe um equivalente.**

---

## 5. Padrões de UX

### Layout em blocos (12 colunas)

Todo conteúdo do dashboard é um **bloco** num grid de 12 colunas. Modelo:

```js
{ id, kind: "kpi" | "chart" | "insights" | "ranking" | "cta", span: 3|4|6|8|12, props: {...} }
```

- KPI default `span: 3` (¼).
- Chart default `span: 6` (½). ⅔=8, full=12.
- Insights / Ranking / CTA preferencialmente `span: 12`.
- Adicionar novo tipo de bloco? Crie a entrada em `renderBlock` + atualize `MiniBlock` no `ExportModal` (caso contrário a prévia quebra) + adicione no `AddPicker`.

### Drag-and-drop nativo

- Usa HTML5 Drag & Drop (sem libs).
- Indicador visual via `<DropIndicator side="left|right">` (pulsa).
- Comparar `clientX` com `midX` do alvo para escolher posição before/after.
- Reordenar via `reorderBlock(sourceId, targetId, position)` — manter essa assinatura.

### Modo edição vs modo visualização

- **Visualização**: cards renderizam clean. Hover mostra **botão 3-pontos** (`block-menu-btn`) no canto superior direito → dropdown com Editar / Duplicar / Apagar.
- **Edição**: cada bloco mostra uma **toolbar escura** no topo com grip handle, mover ↑/↓, tamanhos (¼/⅓/½/⅔/full ou similar) e X. Title/sub/dim/agg/cor ficam inline-editáveis.
- **Não duplicar controles**: o que estiver na toolbar de edição **não** deve aparecer também no body do card.

### FAB (floating action bar)

- Fica em `position: fixed; bottom: 28px; left: 50%; translateX(-50%)`.
- Botões principais: **Editar · Adicionar · Exportar**.
- Translade para fora (`translateY(80px)`) quando um modal de tela cheia abre.

### Paywall

- `tweaks.plan` = `"free" | "pro"`. Quando free:
  - Bloco **Insights**: envelope com `.paywall-blur` (blur do conteúdo) + `.pw-card` central com CTA.
  - **Editar / Adicionar / Avançado view / menu 3-pontos**: clique chama `requirePro(reason)` → abre `<PaywallModal reason="edit|add|insights|advanced">`.
  - Botões mostram **`<Icon.Lock>`** no lugar do ícone normal.
  - Pills de visão Pro recebem badge `"Pro"` + cadeado.
- **Sempre** centralize o gating em `requirePro(reason)`. Não espalhe `if (isFree)` no JSX.
- Modal de paywall sempre mostra: razão contextual + 6 features Pro + preço + "7 dias grátis".

### Análises da IA

- Resumo executivo + 4 highlight chips (maior alta, maior queda, concentração, cobertura).
- 3 abas: **Insights · Riscos & Atenção · Recomendações**.
- Cada card tem: ícone por categoria, título, evidência (`R$ 142k em 12 itens`), barra de confiança (%), e CTA **+ Adicionar ao dashboard** quando aplicável (chama `onAddChart`).

### Animações por scroll

- Toda seção/bloco que merece ênfase recebe a classe `rv`.
- `useReveal(viewKey)` (em `landing.jsx`) cuida do observer global. **Já está montado em `App`**, com `MutationObserver` para re-observar quando a view troca. Não monte outro.
- Use `transitionDelay` por índice para fazer stagger (`(idx*0.04)+"s"`).
- Limite a 1-2 animações de scroll-driven por seção; respeite a hierarquia visual.

---

## 6. Gráficos & visualizações

- Sempre usar os componentes em `components/charts.jsx`: `<LineChart>`, `<BarChart>`, `<Donut>`, `<Sparkline>`.
- API:
  ```jsx
  <LineChart data={[{l:"Jan", v:30}, …]} height={200} color={accent} fill animate />
  ```
- Tempo: a tendência principal vive em `fullTendency` (90 pontos). Slice baseado em `periodMeta.days`.
- Para previews ultra-pequenos (export modal), usar `<MiniChart>` / `<MiniBars>` — **não** inflar `LineChart` em 50px.
- Nunca renderizar > 200 pontos num gráfico inline; faça downsample.

---

## 7. Responsividade

Este é um **dashboard hi-fi para desktop primeiro**, mas tem que **não quebrar** em telas menores. Regras:

- Todo grid de 12 colunas tem **mínimo aceitável em ~1100px**. Abaixo disso, considerar `grid-template-columns: repeat(6, 1fr)` em media query e ajustar `span` máximo.
- Cards de hero/landing usam `clamp()` em tamanhos de fonte.
- O preview do export tem aspect-ratio fixo, mas o modal vira coluna única < 720px.
- **Nunca** quebre o overflow horizontal — `body { overflow-x: hidden }` já está em `Dash.html`.
- Para mobile real (< 640px): a landing está aceitável; o dashboard precisa de tratamento futuro (não é foco do MVP).

Antes de fazer merge de qualquer mudança grande, validar visualmente em:
- 1440×900 (desktop primary)
- 1280×800
- 1024×768
- 768×1024 (tablet)

---

## 8. Segurança & privacidade

Promessa do produto: *"seus dados nunca saem do navegador"*. Manter isso real:

- **Processar arquivos via FileReader / Blob no client.** Nunca subir para servidor sem consentimento explícito.
- Quando a IA precisar de contexto, enviar **apenas metadados de esquema** (nomes de colunas, tipos, exemplo amostrado de 1-3 linhas anonimizadas) — não a planilha inteira.
- Quando aceitar URL pública (Importar de URL), validar contra `data:`, `javascript:`, hosts de loopback; só permitir `https://`.
- `<input type="file">` com `accept` restrito (`.csv,.tsv,.txt,.json,.ndjson,.xlsx,.xls,.parquet`).
- Sanitizar nomes de arquivo antes de mostrar.
- Não logar conteúdo do usuário em `console.log` em produção.
- Não armazenar dados em `localStorage` exceto preferências de UI (período, tema, layout).
- Headers de segurança (quando hospedar): `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. Permitir só `https://unpkg.com` e `https://fonts.googleapis.com/gstatic.com` na CSP.
- **LGPD**: copy precisa deixar claro que análise é local e que metadados podem ser enviados para a IA com opt-in.

---

## 9. Acessibilidade

- Botões com `title` para tooltip (especialmente FAB e icon-buttons).
- `aria-label` em controles só com ícone.
- Foco visível em todos os interativos (`outline` em `:focus-visible`).
- Dropzone de upload tem `role="button"` + `tabIndex={0}` + handler `onKeyDown` (Enter/Space).
- Contraste mínimo AA: usar `--ink-2` (texto sec) em vez de `--muted` para textos importantes.
- Animations respeitam `prefers-reduced-motion`. Adicionar mediaquery quando criar nova animação:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```

---

## 10. Internacionalização

- Idioma primário: **PT-BR** (texto, números `pt-BR`, moeda `R$`, datas DD/MM/AAAA).
- `toLocaleString("pt-BR")` sempre que mostrar números grandes.
- Quando for adicionar EN-US, fazer um arquivo `i18n/pt.js` e `i18n/en.js` exportando objetos com mesmas chaves. Não inline traduções.

---

## 11. Performance

- **Don't reflow during scroll.** `IntersectionObserver` para reveal, `requestAnimationFrame` para parallax/scroll listeners.
- Sparklines em KPI: tamanho fixo 160×44, sem axis. Donuts em mini: thickness 6.
- Não anime simultaneamente > 8 elementos. Stagger reveal por índice.
- Lazy-render gráficos com `IntersectionObserver` antes do primeiro paint (`vis` state pattern já implementado em `KPI`, `ChartCard`, `RankingTable`).
- Evitar `box-shadow` em mais de 12 elementos visíveis ao mesmo tempo — performance ruim no Safari.

---

## 12. Convenções de código

- **Funções e componentes**: `function MyComponent() { … }` (não arrow), para parecer no stack trace.
- **Hooks**: `useTweaks` retorna `[values, setTweak]` — array, não objeto.
- **Eventos**: `onClick`, `onChange`, `onMove`, `onResize`, `onDelete` — verbos no infinitivo.
- **IDs de bloco**: `b-{kind-slug}-{n}` ou `b-{Date.now()}` para novos.
- **Tweakable defaults**: dentro de comentários `/*EDITMODE-BEGIN*/…/*EDITMODE-END*/` em formato JSON válido.
- **Comentários**: explicar **porquê**, não o **quê**.
- **Sem `console.log`** em código submetido.

### HTML canônico

- Tag de fechamento explícita: `<p>…</p>`, nunca `<p/>`.
- Atributos sempre com aspas duplas.
- Elementos não-void (`<div>`, `<p>`) nunca self-closed.

---

## 13. Checklist de qualidade (antes de finalizar)

Antes de declarar pronto, validar:

- [ ] `done` retorna sem erros de console
- [ ] Funciona em 1440px, 1280px, 1024px sem horizontal scroll
- [ ] Modo edição: drag-and-drop, resize (¼/⅓/½/⅔/full), delete, add — todos funcionam
- [ ] Free vs Pro: blur dos insights aparece; cadeados nos botões; PaywallModal abre nas 4 razões (edit/add/insights/advanced); alternar para Pro libera tudo instantaneamente
- [ ] Export modal: a prévia bate com o layout real do dashboard (ordem, tamanhos, conteúdo)
- [ ] Period: 7d / 30d / 90d / Tudo muda o subtítulo do cabeçalho **e** a quantidade de pontos no gráfico de tendência
- [ ] Trocar de "Visão geral" → "Por região" → "Avançado" (com Pro) funciona; modificações são descartadas (esperado) e nova visão carrega
- [ ] Tweaks panel: trocar cor do brand, nome, plano e view funcionam ao vivo
- [ ] Mouse hover em qualquer bloco mostra o botão 3-pontos no canto. Click abre dropdown.
- [ ] FAB sempre visível no dashboard; some atrás do export modal
- [ ] Reveal por scroll funciona em todas as telas (landing + dashboard)
- [ ] Mensagens de erro em PT-BR; nenhum "undefined" / "NaN" visível ao usuário

---

## 14. Anti-padrões — NÃO FAZER

- ❌ Não adicionar emoji aleatório (a marca não usa).
- ❌ Não desenhar SVG complexo à mão (placeholders são bem-vindos com texto monoespaçado).
- ❌ Não criar nova fonte / nova cor sem motivo.
- ❌ Não adicionar gradientes em backgrounds grandes — só em ícones e CTAs específicos.
- ❌ Não usar `position: absolute` para empilhar conteúdo principal (só para overlays).
- ❌ Não mexer no escopo global do React sem necessidade.
- ❌ Não usar `dangerouslySetInnerHTML` exceto em chartstrings controlados.
- ❌ Não enviar dados crus do usuário para IA sem opt-in.
- ❌ Não criar uma sexta view de dashboard sem casar com o padrão `presets`.
- ❌ Não duplicar `function ExportModal` (já aconteceu — sempre verifique o arquivo todo depois de edits grandes).

---

## 15. Roadmap sugerido (referência)

Quando o usuário pedir features novas, posicione no contexto deste roadmap:

1. **MVP atual**: upload local, prompt, dashboard editável, paywall, export preview.
2. **Próximas**: persistência de layout (localStorage / backend), compartilhamento por link público, embed, modo dark real, mobile dashboard.
3. **Pro+ futuro**: integrações (Postgres, BigQuery, Stripe), agendamento de exportação por e-mail, alertas baseados em insights.
4. **Plataforma**: equipes, permissões, branding white-label.

### Débitos técnicos conhecidos

- **`useCount` não reage a `target` pós-mount** (`landing.jsx`). Guard com `started.current` faz a animação capturar o primeiro `target` que viu e nunca re-animar. Hoje aceitável porque os KPIs do Dashboard recebem `target` estável (vem de `realAgg`, fixo após upload). Quando algum consumidor precisar de target mutável (ex.: dados ao vivo, morph entre períodos), a correção é forçar remount via `key` no consumidor — não reescrever o hook. Uma tentativa anterior de "animar do v atual" mutava ref durante render e brigava com o pipeline de commit do React 18, congelando o display em frame intermediário (commit `a1f36f1` → revertido em `3d1d9bd`).

Quando algo cair fora do roadmap, **pergunte antes de implementar**.

---

## 17. Convenções de Auth (implementado com Supabase)

`currentUser` é hidratado do Supabase Auth + tabela `profiles` no formato:

```ts
{
  id: uuid,
  email: string,
  plan: 'free' | 'pro',
  stripe_customer_id?: string,
  created_at: timestamp,
}
```

Regras de uso:

- **Plano efetivo** = `currentUser?.plan ?? 'free'`. Anônimo é sempre Free — sem login, nada de Pro, mesmo que o tweaks panel tente dizer o contrário. O toggle "Plano" do tweaks continua na UI como relíquia de dev, mas não afeta o paywall em produção. Para testar Pro localmente, ver §18.
- **Anônimo** (`currentUser === null`): mostra "Entrar" no Nav/Topbar. Usuário pode usar todas as features Free localmente (upload, dashboard, export sem branding pago). Nada é persistido server-side.
- **Logado free**: avatar com inicial do e‑mail + dropdown (e‑mail, badge "Free", "Meu perfil", "Sair"). Dashboards continuam locais até a feature de persistência entrar; o que muda é o paywall ficar legível ("upgrade para Pro") em vez de só "experimentar".
- **Logado pro**: idem free + tudo desbloqueado, badge "Pro" no dropdown. `stripe_customer_id` populado quando a integração Stripe entrar.

Handlers (implementados em `app.jsx`):

- `onSignIn` — abre `<AuthModal initialTab="signin"/>`. Submit chama `supabaseClient.auth.signInWithPassword({email, password})`.
- `onSignOut` — `supabaseClient.auth.signOut()`, depois `setCurrentUser(null)`.
- `onProfile` — abre `<ProfileModal/>` com e‑mail, plano, e botão Sair.

Bootstrap da sessão (em `app.jsx`):

```js
React.useEffect(() => {
  supabaseClient.auth.getSession().then(({data:{session}}) => {
    if (session) loadUserProfile(session.user.id);
  });
  const sub = supabaseClient.auth.onAuthStateChange((_e, session) => {
    if (session) loadUserProfile(session.user.id);
    else setCurrentUser(null);
  });
  return () => sub.data.subscription.unsubscribe();
}, []);
```

`loadUserProfile` faz `SELECT id,email,plan,full_name,stripe_customer_id FROM profiles WHERE id = uid` — RLS impede leitura cruzada.

Componentes:

- `AuthBubble` (`landing.jsx`) — entrada visual. Anônimo: botão "Entrar". Logado: avatar + dropdown. Usado em Nav (landing) e Topbar (dashboard).
- `AuthModal` (`auth-modal.jsx`) — formulários de sign-in / sign-up / reset. ESC fecha, backdrop fecha, focus inicial, body lock. Mensagem de erro inline, mensagem "Confirme seu e-mail" pós-signup.
- `ProfileModal` (inline em `app.jsx`) — info da conta + botão Sair.

Não armazenar dados sensíveis em `localStorage` — apenas preferências de UI. O token do Supabase é gerenciado pelo SDK (localStorage por padrão; httpOnly cookie quando configurado server-side).

**Anon key**: pública por design (RLS é quem protege). Vai hardcoded em `Dash.html`. **Nunca** colocar `service_role` no frontend.

---

## 18. Como testar plano Pro localmente

Como o paywall agora obedece `currentUser.plan` (e ignora qualquer override do tweaks panel quando anônimo), a forma oficial de testar a experiência Pro é editar o banco direto:

1. Criar uma conta no app (Entrar → tab "Criar conta", informar e‑mail + senha).
2. Confirmar o e‑mail (Supabase manda um link).
3. Voltar pro app e fazer login com a mesma conta.
4. Abrir o Supabase Dashboard → **Table Editor** → tabela `profiles`.
5. Localizar a linha do seu user e editar a coluna `plan` de `'free'` para `'pro'`.
6. Refresh do Dash → o `loadUserProfile` re-hidrata o `currentUser` com `plan='pro'` e tudo (edição do dashboard, análises da IA, "Avançado", "Adicionar bloco") fica desbloqueado.

Para voltar ao modo Free: idem, editar `plan` de volta pra `'free'` e dar refresh.

---

Mantenha este arquivo atualizado sempre que decisões grandes mudarem.
