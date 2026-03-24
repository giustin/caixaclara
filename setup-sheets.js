require('dotenv').config();
const sheets = require('./services/sheets');

/**
 * Categorias padrão para o CaixaClara
 */
const DEFAULT_CATEGORIES = [
  // --- Despesas variáveis ---
  { nome: 'Supermercado', grupo: 'essencial', icone: '🛒', ativa: true, ordem: 1 },
  { nome: 'Restaurantes', grupo: 'variavel', icone: '🍽️', ativa: true, ordem: 2 },
  { nome: 'Combustível', grupo: 'transporte', icone: '⛽', ativa: true, ordem: 3 },
  { nome: 'Transporte', grupo: 'transporte', icone: '🚕', ativa: true, ordem: 4 },
  { nome: 'Saúde', grupo: 'essencial', icone: '🏥', ativa: true, ordem: 5 },
  { nome: 'Pet', grupo: 'variavel', icone: '🐾', ativa: true, ordem: 6 },
  { nome: 'Educação', grupo: 'essencial', icone: '📚', ativa: true, ordem: 7 },
  { nome: 'Lazer', grupo: 'variavel', icone: '🎬', ativa: true, ordem: 8 },
  { nome: 'Compras Pessoais', grupo: 'variavel', icone: '🛍️', ativa: true, ordem: 9 },
  { nome: 'Casa', grupo: 'essencial', icone: '🏠', ativa: true, ordem: 10 },
  { nome: 'Assinaturas', grupo: 'fixa', icone: '📱', ativa: true, ordem: 11 },
  { nome: 'Seguros', grupo: 'fixa', icone: '🛡️', ativa: true, ordem: 12 },
  { nome: 'Impostos', grupo: 'fixa', icone: '📋', ativa: true, ordem: 13 },
  { nome: 'Viagens', grupo: 'variavel', icone: '✈️', ativa: true, ordem: 14 },
  { nome: 'Presentes', grupo: 'variavel', icone: '🎁', ativa: true, ordem: 15 },
  { nome: 'Outras Despesas', grupo: 'variavel', icone: '📦', ativa: true, ordem: 30 },
  // --- Receitas (sem teto padrão) ---
  { nome: 'Salário e Proventos', grupo: 'receita', icone: '💰', ativa: true, ordem: 16 },
  { nome: 'Pró-labore', grupo: 'receita', icone: '🏢', ativa: true, ordem: 17 },
  { nome: 'Freelance / Extra', grupo: 'receita', icone: '💼', ativa: true, ordem: 18 },
  { nome: 'Rendimentos', grupo: 'receita', icone: '📈', ativa: true, ordem: 19 },
  { nome: 'Outras Receitas', grupo: 'receita', icone: '💵', ativa: true, ordem: 20 },
  { nome: 'Lucros e Dividendos', grupo: 'receita', icone: '💎', ativa: true, ordem: 21 },
  // --- Moradia e contas fixas ---
  { nome: 'Moradia / Aluguel', grupo: 'fixa', icone: '🏡', ativa: true, ordem: 22 },
  { nome: 'Água', grupo: 'fixa', icone: '💧', ativa: true, ordem: 23 },
  { nome: 'Telefone / Celular', grupo: 'fixa', icone: '📱', ativa: true, ordem: 24 },
  { nome: 'Energia', grupo: 'fixa', icone: '💡', ativa: true, ordem: 25 },
  // --- Financeiro / bancário (sem teto padrão) ---
  { nome: 'Juros / IOF Bancário', grupo: 'financeiro', icone: '🏦', ativa: true, ordem: 26 },
  { nome: 'Tarifa Bancária', grupo: 'financeiro', icone: '💳', ativa: true, ordem: 27 },
  { nome: 'Pagamento Fatura Cartão', grupo: 'financeiro', icone: '💳', ativa: true, ordem: 28 },
  { nome: 'Financiamento / Dívidas', grupo: 'financeiro', icone: '💸', ativa: true, ordem: 29 },
];

/**
 * Configurações padrão do sistema
 */
const DEFAULT_CONFIG = [
  { chave: 'moeda', valor: 'BRL', descricao: 'Moeda padrão do sistema' },
  { chave: 'timezone', valor: 'America/Sao_Paulo', descricao: 'Fuso horário padrão' },
  { chave: 'idioma', valor: 'pt-BR', descricao: 'Idioma padrão da interface' },
  { chave: 'formato_data', valor: 'DD/MM/YYYY', descricao: 'Formato padrão de datas' },
  { chave: 'casas_decimais', valor: '2', descricao: 'Casas decimais para valores monetários' },
  { chave: 'tema', valor: 'claro', descricao: 'Tema padrão da interface (claro/escuro)' },
  { chave: 'primeira_execucao', valor: 'false', descricao: 'Indica se é a primeira execução do sistema' }
];

/**
 * Executa o setup do CaixaClara
 */
async function runSetup() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 Iniciando setup do CaixaClara');
    console.log('='.repeat(60) + '\n');

    // Valida variáveis de ambiente obrigatórias
    const requiredEnvVars = [
      'GOOGLE_SPREADSHEET_ID',
      'GOOGLE_SERVICE_ACCOUNT_EMAIL',
      'GOOGLE_PRIVATE_KEY',
      'GOOGLE_PROJECT_ID'
    ];

    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingEnvVars.length > 0) {
      console.error('❌ Erro: Variáveis de ambiente obrigatórias não encontradas:');
      missingEnvVars.forEach(varName => console.error(`   - ${varName}`));
      console.error('\nPor favor, verifique seu arquivo .env');
      process.exit(1);
    }

    console.log('✅ Variáveis de ambiente validadas\n');

    // Passo 1: Inicializa abas e cabeçalhos
    console.log('📋 Passo 1: Criando estrutura de abas...');
    await sheets.initializeSheets();
    console.log('✅ Abas criadas com sucesso\n');

    // Passo 2: Popula categorias padrão
    console.log('📋 Passo 2: Populando categorias padrão...');
    const categoriesWithIds = DEFAULT_CATEGORIES.map(cat => ({
      id: sheets.generateId(),
      ...cat
    }));
    await sheets.appendRows('categorias', categoriesWithIds);
    console.log(`✅ ${DEFAULT_CATEGORIES.length} categorias adicionadas\n`);

    // Passo 3: Popula configurações padrão
    console.log('📋 Passo 3: Populando configurações do sistema...');
    const configWithIds = DEFAULT_CONFIG.map(cfg => ({
      ...cfg
    }));
    await sheets.appendRows('config', configWithIds);
    console.log(`✅ ${DEFAULT_CONFIG.length} configurações adicionadas\n`);

    // Resumo final
    console.log('='.repeat(60));
    console.log('✨ Setup do CaixaClara completado com sucesso!');
    console.log('='.repeat(60));
    console.log('\n📊 Resumo do que foi criado:\n');

    console.log('📑 Abas criadas:');
    console.log('   • Contas');
    console.log('   • Lançamentos');
    console.log('   • Categorias');
    console.log('   • Regras de Classificação');
    console.log('   • Tetos');
    console.log('   • Metas');
    console.log('   • Saldos Histórico');
    console.log('   • Importações Log');
    console.log('   • Config');

    console.log('\n💰 Categorias:');
    DEFAULT_CATEGORIES.forEach(cat => {
      console.log(`   • ${cat.icone} ${cat.nome} (${cat.grupo})`);
    });

    console.log('\n⚙️ Configurações padrão:');
    DEFAULT_CONFIG.forEach(cfg => {
      console.log(`   • ${cfg.chave}: ${cfg.valor}`);
    });

    console.log('\n📍 Google Spreadsheet ID:');
    console.log(`   ${process.env.GOOGLE_SPREADSHEET_ID}`);

    console.log('\n' + '='.repeat(60));
    console.log('O sistema está pronto para uso!');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Erro durante o setup:\n');
    console.error(error.message);
    if (error.stack) {
      console.error('\nDetalhes técnicos:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Executa o setup
runSetup();
