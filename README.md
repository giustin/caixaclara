# CaixaClara

Sistema de gestao financeira familiar simples e inteligente. Controle suas contas, lancamentos, orcamentos e metas em um unico lugar, com dados armazenados no Google Sheets.

## O que faz

CaixaClara e um app web para gerenciar financas pessoais e familiares. Ele permite:

- Registrar e categorizar lancamentos (receitas e despesas)
- Importar extratos bancarios (CSV/Excel) com classificacao automatica
- Definir tetos orcamentarios por categoria e receber alertas quando estiver perto do limite
- Acompanhar metas financeiras (ex: reserva de emergencia, viagem)
- Visualizar um dashboard consolidado com saldos, gastos por categoria e projecoes de fim de mes
- Reconciliar saldos das contas

## Stack

- **Frontend**: React 18 (single-page, servido como HTML estatico)
- **Backend**: Node.js + Express
- **Banco de dados**: Google Sheets (via Google Sheets API com service account)
- **Classificacao**: Motor proprio de 6 etapas para categorizar transacoes automaticamente

## Estrutura do projeto

```
CaixaClara/
  server.js              # Servidor Express (API REST)
  setup-sheets.js        # Script de inicializacao das abas do Google Sheets
  package.json           # Dependencias Node.js
  Code.gs                # Backend alternativo via Google Apps Script
  .env.example           # Template de variaveis de ambiente
  public/
    index.html           # Frontend React completo
    config.js            # Configuracao (URL do Apps Script)
  services/
    sheets.js            # Camada de acesso ao Google Sheets
    classifier.js        # Classificador automatico de transacoes
    importer.js          # Importador de extratos CSV/Excel
    projections.js       # Projecoes de gastos para fim de mes
```

## Pre-requisitos

1. **Node.js** 18 ou superior
2. **Conta Google** com uma planilha criada no Google Sheets
3. **Service Account** no Google Cloud com acesso a planilha

## Configuracao

### 1. Criar a Service Account no Google Cloud

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um projeto (ou use um existente)
3. Ative a **Google Sheets API**
4. Va em **IAM & Admin > Service Accounts** e crie uma nova service account
5. Gere uma chave JSON para essa service account
6. Compartilhe sua planilha do Google Sheets com o email da service account (permissao de Editor)

### 2. Configurar variaveis de ambiente

Copie o arquivo de exemplo e preencha com suas credenciais:

```bash
cp .env.example .env
```

Edite o `.env`:

```
GOOGLE_SPREADSHEET_ID=id_da_sua_planilha
GOOGLE_SERVICE_ACCOUNT_EMAIL=email_da_service_account
GOOGLE_PRIVATE_KEY=chave_privada_da_service_account
PORT=3000
```

O ID da planilha esta na URL dela: `https://docs.google.com/spreadsheets/d/ESTE_E_O_ID/edit`

### 3. Instalar dependencias e inicializar

```bash
npm install
npm run setup   # Cria as abas e categorias padrao no Google Sheets
npm start       # Inicia o servidor na porta 3000
```

Acesse `http://localhost:3000` no navegador.

## Deploy no Render (gratuito)

Este projeto esta configurado para deploy automatico no Render:

1. Faca fork ou push deste repositorio no GitHub
2. Crie uma conta em [render.com](https://render.com)
3. Clique em **New > Web Service** e conecte seu repositorio
4. O Render detecta automaticamente o `render.yaml` e configura tudo
5. Adicione as variaveis de ambiente (credenciais Google) no painel do Render
6. Pronto! O app estara disponivel em `https://caixaclara.onrender.com` (ou nome similar)

**Nota:** No plano gratuito, o servidor adormece apos 15 minutos sem uso e demora ~30s para acordar na proxima requisicao.

## API

Principais endpoints:

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/api/dashboard` | Dados consolidados do mes atual |
| GET | `/api/lancamentos` | Listar lancamentos (com filtros) |
| POST | `/api/lancamentos` | Criar lancamento |
| GET | `/api/contas` | Listar contas |
| GET | `/api/saldos` | Saldos atuais |
| GET | `/api/categorias` | Listar categorias |
| GET | `/api/tetos` | Tetos orcamentarios |
| GET | `/api/metas` | Metas financeiras |
| GET | `/api/alertas` | Alertas de orcamento |
| POST | `/api/importar` | Importar extrato (CSV/Excel) |
| POST | `/api/classificar` | Classificar transacao |
| GET | `/api/projecoes` | Projecoes de fim de mes |

## Licenca

Projeto pessoal. Uso livre.
