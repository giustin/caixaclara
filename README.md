# CaixaClara

Sistema de gestão financeira familiar simples e inteligente. Controle suas contas, lançamentos, orçamentos e metas em um único lugar, com dados armazenados no Google Sheets.

## O que faz

CaixaClara é um app web para gerenciar finanças pessoais e familiares. Ele permite:

- Registrar e categorizar lançamentos (receitas e despesas)
- Importar extratos bancários (CSV/Excel) com classificação automática
- Definir tetos orçamentários por categoria e receber alertas quando estiver perto do limite
- Acompanhar metas financeiras (ex: reserva de emergência, viagem)
- Visualizar um dashboard consolidado com saldos, gastos por categoria e projeções de fim de mês
- Reconciliar saldos das contas

## Stack

- **Frontend**: React 18 (single-page, servido como HTML estático)
- **Backend**: Node.js + Express
- **Banco de dados**: Google Sheets (via Google Sheets API com service account)
- **Classificação**: Motor próprio de 6 etapas para categorizar transações automaticamente

## Estrutura do projeto

```
CaixaClara/
  server.js              # Servidor Express (API REST)
  setup-sheets.js        # Script de inicialização das abas do Google Sheets
  package.json           # Dependências Node.js
  Code.gs                # Backend alternativo via Google Apps Script
  .env.example           # Template de variáveis de ambiente
  public/
    index.html           # Frontend React completo
    config.js            # Configuração (URL do Apps Script)
  services/
    sheets.js            # Camada de acesso ao Google Sheets
    classifier.js        # Classificador automático de transações
    importer.js          # Importador de extratos CSV/Excel
    projections.js       # Projeções de gastos para fim de mês
```

## Pré-requisitos

1. **Node.js** 18 ou superior
2. **Conta Google** com uma planilha criada no Google Sheets
3. **Service Account** no Google Cloud com acesso à planilha

## Configuração

### 1. Criar a Service Account no Google Cloud

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um projeto (ou use um existente)
3. Ative a **Google Sheets API**
4. Vá em **IAM & Admin > Service Accounts** e crie uma nova service account
5. Gere uma chave JSON para essa service account
6. Compartilhe sua planilha do Google Sheets com o email da service account (permissão de Editor)

### 2. Configurar variáveis de ambiente

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

O ID da planilha está na URL dela: `https://docs.google.com/spreadsheets/d/ESTE_E_O_ID/edit`

### 3. Instalar dependências e inicializar

```bash
npm install
npm run setup   # Cria as abas e categorias padrão no Google Sheets
npm start       # Inicia o servidor na porta 3000
```

Acesse `http://localhost:3000` no navegador.

## Deploy no Render (gratuito)

Este projeto está configurado para deploy automático no Render:

1. Faça fork ou push deste repositório no GitHub
2. Crie uma conta em [render.com](https://render.com)
3. Clique em **New > Web Service** e conecte seu repositório
4. O Render detecta automaticamente o `render.yaml` e configura tudo
5. Adicione as variáveis de ambiente (credenciais Google) no painel do Render
6. Pronto! O app estará disponível em `https://caixaclara.onrender.com` (ou nome similar)

**Nota:** No plano gratuito, o servidor adormece após 15 minutos sem uso e demora ~30s para acordar na próxima requisição.

## API

Principais endpoints:

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/dashboard` | Dados consolidados do mês atual |
| GET | `/api/lancamentos` | Listar lançamentos (com filtros) |
| POST | `/api/lancamentos` | Criar lançamento |
| GET | `/api/contas` | Listar contas |
| GET | `/api/saldos` | Saldos atuais |
| GET | `/api/categorias` | Listar categorias |
| GET | `/api/tetos` | Tetos orçamentários |
| GET | `/api/metas` | Metas financeiras |
| GET | `/api/alertas` | Alertas de orçamento |
| POST | `/api/importar` | Importar extrato (CSV/Excel) |
| POST | `/api/classificar` | Classificar transação |
| GET | `/api/projecoes` | Projeções de fim de mês |

## Licença

Projeto pessoal. Uso livre.
