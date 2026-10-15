<div align="center">

# 📊 Dash

**Dashboards com IA.** Envie uma planilha e o Dash monta o painel sozinho:
indicadores, gráficos e análises escritas por IA, prontos para editar.

[![Demo](https://img.shields.io/badge/demo-online-2f6bff?style=flat-square&logo=vercel)](https://dash-project-frontend.vercel.app)
![Status](https://img.shields.io/badge/status-em%20desenvolvimento-f59e0b?style=flat-square)
![React](https://img.shields.io/badge/React-18-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Sem build](https://img.shields.io/badge/build-nenhum-00c39a?style=flat-square)

</div>

## ✨ Funcionalidades

| | |
|---|---|
| **Importar dados** | CSV, TSV, TXT, JSON/NDJSON e Excel (XLSX/XLS), colar dados direto ou usar o exemplo pronto |
| **Descoberta automática** | Analisa as colunas e gera os blocos do painel de acordo com o tipo de dado |
| **Visões prontas** | Visão geral, por região, por produto, por canal, avançada (Pro) e descoberta, com filtro de 7, 30 ou 90 dias |
| **Editor** | Arrastar e soltar, redimensionar e adicionar blocos |
| **Análise com IA** | Texto explicando os dados, gerado no backend (Gemini) sob demanda, nos planos pagos e limitado pela cota do plano |
| **Conta** | Cadastro, login, verificação de e-mail e troca de senha |
| **Assinatura** | Planos pagos por cartão ou Pix (Asaas), com cancelamento pela conta |

## 💳 Planos

| | Free | Essencial | Pro |
|---|---|---|---|
| Preço | R$ 0 | R$ 29,90/mês | R$ 49,90/mês |
| Análises de IA por mês | — | 50 | 300 |
| Linhas por arquivo | 5 mil | 100 mil | 1 milhão |
| Exportar PDF/PNG | — | ✓ | ✓ |
| Link de compartilhamento | — | — | ✓ |
| Sem a marca Dash | — | — | ✓ |

Os limites são aplicados no servidor ([DashProject-Backend](https://github.com/Corrar/DashProject-Backend), arquivo `src/plans.ts`).

## 🛠️ Como é feito

- **Sem etapa de build**: React 18 e Babel rodam direto no navegador (via CDN), então basta servir os arquivos
- **Gráficos em SVG próprio**, sem biblioteca de gráficos
- **SheetJS**, carregado só quando o arquivo é Excel
- **Fontes**: Geist e Geist Mono
- **Backend**: [DashProject-Backend](https://github.com/Corrar/DashProject-Backend), com Express 5, PostgreSQL (Neon), autenticação JWT própria e cobrança pelo Asaas. O token de acesso fica só em memória e o de renovação vai em cookie `httpOnly`

## 🚀 Como rodar

Não precisa instalar nada. Sirva a pasta por HTTP e abra no navegador:

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

Abrir o `index.html` direto (`file://`) não funciona, porque o navegador precisa buscar os `.jsx`.

O endereço da API fica em `window.__API_URL`, no `index.html`. Para testar login e IA localmente, aponte para um backend que aceite a sua origem (CORS).

## 📁 Estrutura

```
index.html                     # estilos globais, CDNs, URL da API e links de e-mail/pagamento
components/
├── app.jsx                    # raiz e navegação entre telas
├── api.js                     # cliente da API (auth, planos, IA)
├── landing.jsx                # página inicial
├── dashboard.jsx              # upload, análise e editor do dashboard
├── dashboard-discovery.jsx    # perfil das colunas e geração dos blocos
├── dashboard-export.jsx       # exportação PDF/PNG
├── share-view.jsx             # link público (Pro) e página compartilhada
├── charts.jsx · icons.jsx     # gráficos em SVG e ícones
├── auth-view.jsx · auth-modal.jsx
├── plans-view.jsx             # planos e assinatura
├── account-view.jsx           # conta, faturamento e histórico
└── dashboard-tests.js         # testes do parser (rodar no console do navegador)
tweaks-panel.jsx               # painel de ajustes visuais para desenvolvimento
termos.html · privacidade.html # páginas legais (rascunho: preencher dados da empresa)
vercel.json                    # headers de segurança (CSP, HSTS…)
favicon.svg · og-image.png     # ícone e prévia ao compartilhar o site
```

## 🗺️ Próximos passos

- [ ] Entrar com Google
- [ ] Importar de URL e do Google Sheets
- [ ] Workspace para equipes
- [ ] Tema escuro
