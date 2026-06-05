# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é

CaixaClara — gestão financeira familiar. Frontend React (SPA) servido como HTML estático, dados no Google Sheets via Google Apps Script. Deploy do servidor web no Render; deploy do Apps Script via GitHub Actions.

## Arquitetura real (leia antes de tocar em qualquer coisa)

O ponto mais importante e contra-intuitivo deste projeto: **o backend de dados é o `Code.gs` (Google Apps Script), NÃO o `server.js` Express.**

Fluxo real em produção:

```
public/index.html (React)  ──►  Code.gs (Apps Script Web App)  ──►  Google Sheets
        │
        └──►  server.js (Express)  apenas para:  /api/auth/*  +  servir estáticos  +  injetar APPS_SCRIPT_URL
```

- O **frontend fala direto com o Apps Script** via `GET ?action=<x>` (leituras) e `?action=post_via_get&payload=<json>` (escritas — POST tunelado em GET pra contornar CORS). Veja `apiGet`/`apiPost` por volta de `public/index.html:683`.
- O `server.js` Express só atende **3 rotas usadas**: `/api/auth/login`, `/api/auth/me`, `/api/auth/config`. Esta última devolve `apps_script_url` (de env) e o Google Client ID pro frontend.
- A `APPS_SCRIPT_URL` chega ao frontend de duas formas: `public/config.js` (local, com placeholder no Git) ou via `GET /api/auth/config` (produção, lê `process.env.APPS_SCRIPT_URL`).

### Código legado / morto — NÃO use como referência

Boa parte do código Node existe mas **não participa do fluxo real** e está dessincronizada:

- **Rotas REST de dados em `server.js`** (`/api/contas`, `/api/lancamentos`, `/api/dashboard`, `/api/importar`, `/api/projecoes` etc.): chamam métodos como `sheetsService.getContas()`, `createLancamento()`, `getSaldosPorConta()` que **não existem** em `services/sheets.js` (que só exporta CRUD genérico: `getRows`, `addRow`...). Essas rotas quebrariam se chamadas. **Ninguém as chama** — o frontend só usa `/api/auth/*`.
- **`services/classifier.js`, `services/importer.js`, `services/projections.js`**: a lógica equivalente (classificação por padrão de comerciante, importação de extratos, projeção de fim de mês, split de lançamentos) está **reimplementada no frontend** (`public/index.html`) e/ou no `Code.gs`. Os módulos Node são versões antigas e divergentes.
- **`setup-sheets.js`**: cria categorias com schema diferente do real (usa `grupo`, sem IDs `catNN`). O setup verdadeiro é a função `setupInicial()` dentro do `Code.gs` (executada uma vez no editor do Apps Script).

Regra prática: **mudança de comportamento de dados/UI → `public/index.html` e/ou `Code.gs`.** Os `services/*.js` só importam se o objetivo explícito for ressuscitar/consertar o backend Express.

## Onde mexer (mapa por tarefa)

- **UI, lógica de tela, classificação/split/importação no cliente, gráficos, fluxo de dados** → `public/index.html` (~9500 linhas, React via Babel standalone num único `<script type="text/babel">`).
- **CRUD na planilha, dashboard agregado, regras de split persistidas, transferências, dedup por hash** → `Code.gs`. Adicionar uma operação = novo `case` no switch de `doGet` (e no espelho `post_via_get`) + a função handler.
- **Autenticação (Google Sign-In + JWT + whitelist)** → `services/auth.js` + rotas em `server.js`.
- **Schema das abas / categorias / tetos padrão** → `setupInicial()` no `Code.gs` (fonte de verdade do schema em produção).

## Schema do Apps Script (Code.gs) — o que vale

Abas e colunas reais estão em `setupInicial()` no `Code.gs`. Pontos que pegam:

- Lançamentos têm `lote_importacao`, `reembolsavel`, `is_projecao`, `parcela_num/total`, `projecao_origem_lote` — colunas que o `SHEET_CONFIGS` do `services/sheets.js` legado **não** tem.
- Categorias usam IDs fixos `catNN` e coluna `tipo` (`despesa`/`receita`/`transferencia`). `cat28` (Pagamento Fatura Cartão) é tipo `transferencia` e é tratada como tal nos totais.
- Lançamentos de tipo `transferencia` e os marcados `reembolsavel` são **excluídos** dos totais de despesa/receita no dashboard.
- Dedup de importação é por `hash` (usa identificador único do banco quando existe, ex.: UUID do Nubank conta corrente; senão `data|descricao|valor`).

## Comandos

```bash
npm install            # deps
npm start              # roda Express na porta 3000 (= npm run dev). Sem GOOGLE_CLIENT_ID, auth desligado (modo aberto)
npm run setup          # LEGADO: setup-sheets.js (não reflete o schema real; o setup real é setupInicial() no Code.gs)

# Apps Script (clasp) — backend de dados
npm run apps-script:login    # clasp login (gera ~/.clasprc.json)
npm run apps-script:pull     # puxa Code.gs do projeto Apps Script
npm run apps-script:push     # empurra Code.gs (clasp push -f)
npm run apps-script:ci-token # imprime o ~/.clasprc.json p/ colar no secret CLASPRC_JSON
```

Não há suíte de testes nem linter configurados.

### Apps Script: rodar o app de verdade exige push

Editar `Code.gs` localmente **não tem efeito** até `clasp push` (ou merge na `main`, que dispara o workflow). Depois do push, o Apps Script ainda precisa de **nova implantação** pra valer no endpoint `/exec` em uso — `clasp push` atualiza o código mas não cria deployment novo. Para validar mudança de backend de ponta a ponta, confirme qual implantação a `APPS_SCRIPT_URL` aponta.

## Deploy

- **Servidor web (frontend + auth)**: Render, via `render.yaml` (`node server.js`). Variáveis sensíveis ficam como Environment Variables no painel do Render — incluindo `APPS_SCRIPT_URL`, `GOOGLE_CLIENT_ID`, `JWT_SECRET`, `ALLOWED_EMAILS`. Plano free dorme após 15 min (~30s pra acordar).
- **Apps Script**: `.github/workflows/deploy-apps-script.yml` roda `clasp push -f` em todo push na `main` que altere `Code.gs`/`appsscript.json`/`.clasp.json`/`.claspignore`. Usa o secret `CLASPRC_JSON` (conteúdo do `~/.clasprc.json`; o refresh_token se renova sozinho).

## Segurança (ver SEGURANCA.md)

- `public/config.js` no Git deve ficar com o placeholder `COLE_AQUI_SUA_URL_DO_APPS_SCRIPT`. A URL real do Apps Script dá acesso aberto à planilha (deploy é `ANYONE_ANONYMOUS`) — **nunca commitar a URL real**.
- `.gitignore` bloqueia `.env*`, todo `*.json` (exceto `package.json`/`package-lock.json`/`.clasp.json`/`appsscript.json`), `.clasprc.json` e a pasta legada `google-apps-script/`.
- Antes de `git push`: `git diff --cached | grep -i "private_key\|script.google.com\|gserviceaccount\|github_pat"`.

## Convenções

- **Idioma do código em português**: identificadores, funções e comentários são em pt-BR (`salvarLancamento`, `lerAba`, `lancamentos`, `descricao`). Mantenha o padrão.
- Commits em pt-BR seguindo Conventional Commits com escopo (ex.: `feat(split): ...`, `fix(importar): ...`); PRs numeradas referenciadas no histórico.
