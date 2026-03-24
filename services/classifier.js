// CaixaClara - Motor de Classificação Automática de Transações
// Classifica transações bancárias em categorias usando regras e histórico

// Padrões de estabelecimentos comuns brasileiros
const PADROES_COMERCIANTES = {
  supermercado: ['MERCADO', 'SUPERMERCADO', 'PAO DE ACUCAR', 'CARREFOUR', 'ATACADAO'],
  restaurantes: ['IFOOD', 'RAPPI', 'UBER EATS', 'RESTAURANTE', 'LANCHONETE', 'BURGER', 'PIZZA', 'SUSHI', 'MC DONALDS', 'MCDONALDS', 'BK ', 'SUBWAY'],
  combustivel: ['SHELL', 'IPIRANGA', 'BR DISTRIBUIDORA', 'POSTO', 'COMBUSTIVEL'],
  transporte: ['UBER ', '99 ', 'CABIFY', 'ESTACIONAMENTO'],
  saude: ['FARMACIA', 'DROGARIA', 'DROGA RAIA', 'DROGASIL', 'HOSPITAL', 'CLINICA', 'MEDIC', 'LABORAT', 'CONSULTA'],
  assinaturas: ['NETFLIX', 'SPOTIFY', 'DISNEY', 'AMAZON PRIME', 'HBO', 'APPLE', 'GOOGLE PLAY', 'YOUTUBE'],
  contas_fixas: ['ENEL', 'CPFL', 'SABESP', 'COMGAS', 'VIVO', 'CLARO', 'TIM', 'OI ', 'NET ', 'INTERNET'],
  educacao: ['ESCOLA', 'FACULDADE', 'CURSO', 'LIVRO', 'UDEMY', 'ALURA'],
  pet: ['PET', 'COBASI', 'PETZ', 'VETERIN'],
  seguros: ['SEGURO', 'PORTO SEGURO', 'SULAMERICA', 'BRADESCO SEGUROS'],
  impostos: ['IMPOSTO', 'IPTU', 'IPVA', 'IR ', 'DARF', 'TAXA']
};

/**
 * Calcula similaridade de Levenshtein entre duas strings
 * Retorna um valor entre 0 e 1 (1 = idênticas)
 */
function calcularSimilaridade(str1, str2) {
  const s1 = str1.toUpperCase();
  const s2 = str2.toUpperCase();

  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  const matriz = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(0));

  for (let i = 0; i <= s1.length; i++) matriz[0][i] = i;
  for (let j = 0; j <= s2.length; j++) matriz[j][0] = j;

  for (let j = 1; j <= s2.length; j++) {
    for (let i = 1; i <= s1.length; i++) {
      const custo = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matriz[j][i] = Math.min(
        matriz[j][i - 1] + 1,
        matriz[j - 1][i] + 1,
        matriz[j - 1][i - 1] + custo
      );
    }
  }

  const maxLen = Math.max(s1.length, s2.length);
  return 1 - (matriz[s2.length][s1.length] / maxLen);
}

/**
 * Verifica se a descrição contém palavras-chave
 */
function contemPalavrasChave(descricao, palavras) {
  const desc = descricao.toUpperCase();
  return palavras.some(palavra => desc.includes(palavra.toUpperCase()));
}

/**
 * Identifica categoria pelo padrão de comerciante
 */
function identificarPorComercianteBase(descricao) {
  const desc = descricao.toUpperCase();

  for (const [categoria, padroes] of Object.entries(PADROES_COMERCIANTES)) {
    if (contemPalavrasChave(desc, padroes)) {
      return categoria;
    }
  }

  return null;
}

/**
 * Detecta movimentos relacionados a investimentos (resgate, aporte, rendimento)
 * Esses movimentos devem ser classificados como transferência interna, não como receita/despesa
 */
function detectarMovimentoInvestimento(lancamento) {
  const descricao = (lancamento.descricao || '').toUpperCase();

  // Padrões de resgate (dinheiro saindo do investimento para conta corrente)
  const padroesResgate = [
    'RESGATE CDB', 'RESGATE RDB', 'RESGATE LCI', 'RESGATE LCA',
    'RESGATE TESOURO', 'RESGATE POUPANCA', 'RESGATE POUPANÇA',
    'RESGATE FUNDO', 'RESGATE RENDA FIXA', 'RESGATE INVESTIMENTO',
    'RESGATE APLICACAO', 'RESGATE APLICAÇÃO',
    'RESGATE CRA', 'RESGATE CRI', 'RESGATE DEBENTURE',
    'RESG CDB', 'RESG RDB', 'RESG APLIC',
    'RESGATE - ', 'RESGATE ANTECIPADO'
  ];

  // Padrões de aporte (dinheiro saindo da conta corrente para investimento)
  const padroesAporte = [
    'APLICACAO CDB', 'APLICAÇÃO CDB', 'APLICACAO RDB', 'APLICAÇÃO RDB',
    'APLICACAO LCI', 'APLICAÇÃO LCI', 'APLICACAO LCA', 'APLICAÇÃO LCA',
    'APLICACAO TESOURO', 'APLICAÇÃO TESOURO',
    'APLICACAO FUNDO', 'APLICAÇÃO FUNDO',
    'APLICACAO POUPANCA', 'APLICAÇÃO POUPANÇA',
    'APLIC CDB', 'APLIC RDB', 'APLIC RENDA FIXA',
    'COMPRA TESOURO', 'INVESTIMENTO CDB', 'INVESTIMENTO RDB'
  ];

  // Padrões de rendimento
  const padroesRendimento = [
    'RENDIMENTO CDB', 'RENDIMENTO RDB', 'RENDIMENTO LCI', 'RENDIMENTO LCA',
    'RENDIMENTO POUPANCA', 'RENDIMENTO POUPANÇA',
    'RENDIMENTO FUNDO', 'RENDIMENTO TESOURO',
    'JUROS INVESTIMENTO', 'JUROS CDB', 'JUROS RDB',
    'CUPOM TESOURO', 'DIVIDENDOS', 'JCP ', 'JSCP ',
    'REND APLIC', 'REND POUP'
  ];

  // Padrão genérico de resgate (só "RESGATE" sem outra palavra que não seja investimento)
  const ehResgateSozinho = /^RESGATE\b/.test(descricao) && !descricao.includes('SEGURO');

  for (const p of padroesResgate) {
    if (descricao.includes(p)) {
      return { ehInvestimento: true, tipoMovimento: 'Resgate', confianca: 'alta', subtipo: 'resgate_investimento' };
    }
  }

  if (ehResgateSozinho) {
    return { ehInvestimento: true, tipoMovimento: 'Resgate', confianca: 'media', subtipo: 'resgate_investimento' };
  }

  for (const p of padroesAporte) {
    if (descricao.includes(p)) {
      return { ehInvestimento: true, tipoMovimento: 'Aporte', confianca: 'alta', subtipo: 'aporte_investimento' };
    }
  }

  for (const p of padroesRendimento) {
    if (descricao.includes(p)) {
      return { ehInvestimento: true, tipoMovimento: 'Rendimento', confianca: 'alta', subtipo: 'rendimento_investimento' };
    }
  }

  return { ehInvestimento: false, tipoMovimento: null, confianca: null, subtipo: null };
}

/**
 * Verifica se uma transação é uma transferência entre contas
 */
function detectarTransferencia(lancamento) {
  const descricao = (lancamento.descricao || '').toUpperCase();
  const tipo = (lancamento.tipo || '').toUpperCase();

  const padroes = ['PIX', 'TED', 'DOC', 'TRANSF', 'TRANSFERENCIA'];
  const ehTransferencia = padroes.some(p => descricao.includes(p));

  // Detectar transferência para conta própria
  const ehSelf = descricao.includes('CONTA PROPRIA') ||
                 descricao.includes('CONTA PRÓPRIA') ||
                 descricao.includes('MINHA CONTA');

  return {
    ehTransferencia,
    ehSelf,
    tipo: ehSelf ? 'transferencia_interna' : 'transferencia'
  };
}

/**
 * Verifica se uma transação é pagamento de fatura de cartão
 */
function detectarPagamentoFatura(lancamento) {
  const descricao = (lancamento.descricao || '').toUpperCase();

  const padroes = [
    'PAGTO CARTAO',
    'PAGAMENTO CARTAO',
    'FATURA CARTAO',
    'PAGTO FATURA',
    'PAGAMENTO FATURA',
    'CARTAO CREDITO',
    'CREDITO CARTAO'
  ];

  return padroes.some(p => descricao.includes(p));
}

/**
 * Classifica uma única transação
 *
 * @param {Object} lancamento - Transação a classificar
 * @param {Array} regras - Array de regras de classificação
 * @param {Array} historico - Array de transações histónicas classificadas
 * @returns {Object} { categoria, subcategoria, confianca, metodo, regra_id }
 */
function classificar(lancamento, regras = [], historico = []) {
  const descricao = lancamento.descricao || '';
  const valor = lancamento.valor || 0;

  // Passo 0: Detectar movimentos de investimento (resgate, aporte, rendimento)
  const investimento = detectarMovimentoInvestimento(lancamento);
  if (investimento.ehInvestimento) {
    return {
      categoria: 'transferencia',
      subcategoria: investimento.subtipo,
      confianca: investimento.confianca,
      metodo: 'deteccao_investimento',
      regra_id: null,
      tipo_movimento_investimento: investimento.tipoMovimento,
      notas: `Movimento de investimento detectado: ${investimento.tipoMovimento}`
    };
  }

  // Passo 1: Detectar transferências e pagamentos de fatura
  if (detectarPagamentoFatura(lancamento)) {
    return {
      categoria: 'cat28',
      subcategoria: 'fatura_cartao',
      confianca: 'alta',
      metodo: 'deteccao_pagamento_fatura',
      regra_id: null,
      notas: 'Pagamento de fatura de cartão detectado (tipo: transferencia)'
    };
  }

  const transferencia = detectarTransferencia(lancamento);
  if (transferencia.ehTransferencia) {
    return {
      categoria: 'transferencia',
      subcategoria: transferencia.tipo,
      confianca: 'alta',
      metodo: 'deteccao_transferencia',
      regra_id: null,
      notas: transferencia.ehSelf ? 'Transferência entre contas próprias' : 'Transferência'
    };
  }

  // Passo 2: Buscar correspondência exata em regras (padrão_texto)
  for (const regra of regras) {
    if (regra.padrao_texto) {
      const similaridade = calcularSimilaridade(descricao, regra.padrao_texto);
      if (similaridade > 0.95) {
        return {
          categoria: regra.categoria,
          subcategoria: regra.subcategoria || null,
          confianca: 'alta',
          metodo: 'correspondencia_exata_regra',
          regra_id: regra.id,
          similaridade: Math.round(similaridade * 100)
        };
      }
    }
  }

  // Passo 3: Buscar correspondência parcial em regras (palavras-chave)
  let melhorRegra = null;
  let maiorSimilaridade = 0;

  for (const regra of regras) {
    if (regra.palavras_chave && Array.isArray(regra.palavras_chave)) {
      if (contemPalavrasChave(descricao, regra.palavras_chave)) {
        melhorRegra = regra;
        break;
      }
    }
  }

  if (melhorRegra) {
    return {
      categoria: melhorRegra.categoria,
      subcategoria: melhorRegra.subcategoria || null,
      confianca: 'media',
      metodo: 'correspondencia_palavras_chave_regra',
      regra_id: melhorRegra.id
    };
  }

  // Passo 4: Classificar por padrão de comerciante
  const categoriaComercianteBase = identificarPorComercianteBase(descricao);
  if (categoriaComercianteBase) {
    return {
      categoria: categoriaComercianteBase,
      subcategoria: null,
      confianca: 'media',
      metodo: 'correspondencia_comerciante',
      regra_id: null
    };
  }

  // Passo 5: Buscar histórico com mesma descrição
  const noHistorico = historico.find(t => {
    const similaridade = calcularSimilaridade(descricao, t.descricao || '');
    return similaridade > 0.85;
  });

  if (noHistorico && noHistorico.categoria && noHistorico.categoria !== 'pendente_confirmacao') {
    return {
      categoria: noHistorico.categoria,
      subcategoria: noHistorico.subcategoria || null,
      confianca: 'media',
      metodo: 'correspondencia_historico',
      regra_id: null
    };
  }

  // Passo 6: Nenhuma correspondência - pendente de confirmação
  return {
    categoria: 'pendente_confirmacao',
    subcategoria: null,
    confianca: 'baixa',
    metodo: 'sem_correspondencia',
    regra_id: null,
    notas: 'Transação não classificada automaticamente'
  };
}

/**
 * Classifica múltiplas transações em lote
 *
 * @param {Array} lancamentos - Array de transações
 * @param {Array} regras - Array de regras de classificação
 * @param {Array} historico - Array de transações histónicas
 * @returns {Array} Array de transações classificadas
 */
function classificarLote(lancamentos, regras = [], historico = []) {
  return lancamentos.map(lancamento => ({
    ...lancamento,
    classificacao: classificar(lancamento, regras, historico)
  }));
}

/**
 * Cria uma regra a partir de uma classificação manual
 *
 * @param {Object} lancamento - Transação manual classificada
 * @param {string} categoria - Categoria atribuída manualmente
 * @param {string} subcategoria - Subcategoria (opcional)
 * @returns {Object} Nova regra para uso futuro
 */
function sugerirRegra(lancamento, categoria, subcategoria = null) {
  const descricao = (lancamento.descricao || '').toUpperCase();

  // Extrair palavras significativas (maior que 3 caracteres)
  const palavras = descricao
    .split(/\s+/)
    .filter(p => p.length > 3 && !['PARA', 'COM', 'POR', 'BANCARIO', 'DEBITO'].includes(p))
    .slice(0, 3);

  return {
    id: `regra_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    categoria,
    subcategoria: subcategoria || null,
    padrao_texto: descricao,
    palavras_chave: palavras,
    criada_em: new Date().toISOString(),
    fonte: 'classificacao_manual',
    aplicacoes: 0,
    ativa: true
  };
}

module.exports = {
  classificar,
  classificarLote,
  sugerirRegra,
  detectarMovimentoInvestimento,
  detectarTransferencia,
  detectarPagamentoFatura,
  // Exportar utilitários para testes/customização
  calcularSimilaridade,
  contemPalavrasChave,
  identificarPorComercianteBase,
  PADROES_COMERCIANTES
};
