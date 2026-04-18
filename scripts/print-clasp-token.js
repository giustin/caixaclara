#!/usr/bin/env node
// Lê ~/.clasprc.json, copia pro clipboard (quando possível) e imprime
// instruções pra colar no GitHub como secret CLASPRC_JSON.
// Usado uma única vez pra habilitar o deploy automático via GitHub Actions.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const arquivo = path.join(os.homedir(), '.clasprc.json');

if (!fs.existsSync(arquivo)) {
  console.error('\n❌ ~/.clasprc.json não encontrado.\n');
  console.error('   Rode antes:');
  console.error('     npm run apps-script:login\n');
  console.error('   Isso abre o navegador pra você autorizar o clasp no Google.');
  console.error('   Depois rode este comando de novo.\n');
  process.exit(1);
}

const conteudo = fs.readFileSync(arquivo, 'utf8').trim();

try {
  JSON.parse(conteudo);
} catch (e) {
  console.error('❌ ~/.clasprc.json não é um JSON válido. Refaça o login:');
  console.error('   npm run apps-script:login');
  process.exit(1);
}

// Tenta copiar pro clipboard. Retorna true se deu certo.
const copiarClipboard = (conteudo) => {
  const tentativas =
    process.platform === 'darwin' ? [['pbcopy', []]] :
    process.platform === 'win32'  ? [['clip', []]] :
    [['xclip', ['-selection', 'clipboard']], ['xsel', ['--clipboard', '--input']]];
  for (const [cmd, args] of tentativas) {
    try {
      execFileSync(cmd, args, { input: conteudo, stdio: ['pipe', 'ignore', 'ignore'] });
      return true;
    } catch (e) { /* tenta a próxima */ }
  }
  return false;
};

const copiou = copiarClipboard(conteudo);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (copiou) {
  console.log('✅ Token do clasp copiado pro clipboard (use Cmd/Ctrl+V pra colar).');
} else {
  console.log('⚠️  Não foi possível copiar automaticamente. Copie o JSON abaixo manualmente:\n');
  console.log(conteudo);
}
console.log('\n📋 Próximos passos no GitHub (leva 30s):');
console.log('   1. Abra: https://github.com/giustin/caixaclara/settings/secrets/actions');
console.log('   2. Clique em "New repository secret"');
console.log('   3. Name:   CLASPRC_JSON');
console.log('   4. Secret: cole o conteúdo');
console.log('   5. Clique "Add secret"');
console.log('\nDepois disso, todo push na main que mexer no Code.gs dispara o deploy.');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
