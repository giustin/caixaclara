# Segurança do CaixaClara

## NUNCA suba esses arquivos/dados para o GitHub:

### Arquivos proibidos
- `.env` — contém credenciais do Google Cloud
- `caixaclara-*.json` — chave da Service Account do Google
- Qualquer arquivo `.json` com `private_key` dentro

### Dados sensíveis que NÃO podem aparecer no código
- **URL do Apps Script** (`https://script.google.com/macros/s/.../exec`)
  - O arquivo `public/config.js` tem essa URL localmente, mas no GitHub deve ficar com o placeholder `COLE_AQUI_SUA_URL_DO_APPS_SCRIPT`
  - Se alguém tiver essa URL, pode acessar sua planilha financeira
- **GOOGLE_PRIVATE_KEY** — chave privada da Service Account
- **GOOGLE_SERVICE_ACCOUNT_EMAIL** — email da Service Account
- **GOOGLE_SPREADSHEET_ID** — ID da planilha (menos crítico, mas evite)
- **GOOGLE_CLIENT_ID** — ID do cliente OAuth (menos crítico, mas evite)
- **JWT_SECRET** — segredo usado para assinar tokens de sessão
- **ALLOWED_EMAILS** — lista de emails da família
- **Tokens do GitHub (PAT)** — nunca cole em código

## Autenticação (Google Sign-In + JWT)

O CaixaClara usa Google Sign-In para autenticação. O fluxo é:

1. Usuário clica em "Entrar com Google" no frontend
2. Google retorna um ID Token para o frontend
3. Frontend envia o token para `POST /api/auth/login`
4. Backend valida o token com Google, verifica se o email está na whitelist (`ALLOWED_EMAILS`)
5. Se autorizado, gera um JWT com validade de 24h
6. Todas as chamadas à API incluem o JWT no header `Authorization: Bearer <token>`

### Variáveis de ambiente necessárias (Render)
- `GOOGLE_CLIENT_ID` — ID do cliente OAuth 2.0 (criar em Google Cloud Console > APIs & Services > Credentials)
- `JWT_SECRET` — String secreta para assinar tokens JWT (gere com: `openssl rand -hex 32`)
- `ALLOWED_EMAILS` — Lista de emails autorizados, separados por vírgula

### Modo desenvolvimento
Se `GOOGLE_CLIENT_ID` não estiver configurado, o auth é desabilitado e todas as rotas ficam abertas. Isso permite desenvolvimento local sem configurar OAuth.

## Como funciona a proteção atual

### .gitignore
O `.gitignore` bloqueia automaticamente:
- `.env` e variações (`.env.local`, `.env.production`)
- Arquivos `.json` (exceto `package.json`)
- `node_modules/`, `uploads/`, logs

### Variáveis de ambiente no Render
As credenciais do Google estão configuradas como **Environment Variables** no painel do Render (render.com). Elas nunca aparecem no código.

### config.js
O `public/config.js` tem dois estados:
- **Local (sua máquina)**: contém a URL real do Apps Script — funciona normalmente
- **GitHub**: contém o placeholder — o app roda em modo demo

## Antes de fazer git push, SEMPRE verifique:

```bash
# Veja o que vai ser enviado
git diff --cached

# Procure por credenciais acidentais
git diff --cached | grep -i "private_key\|script.google.com\|gserviceaccount\|github_pat"
```

Se aparecer alguma credencial, remova antes de fazer push!

## Se você acidentalmente subiu uma credencial:

1. **Revogue imediatamente** a credencial comprometida (Google Cloud Console ou GitHub Settings)
2. Gere uma nova credencial
3. Remova do histórico do git:
   ```bash
   git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch ARQUIVO' HEAD
   git push origin main --force
   ```
4. Atualize a nova credencial no Render
