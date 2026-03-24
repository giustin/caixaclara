const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const crypto = require('crypto');

// Bancos suportados
const BANCOS_SUPORTADOS = [
  'nubank',
  'banco_do_brasil',
  'porto_bank',
  'mercado_pago',
  'pao_de_acucar'
];

/**
 * Importa um arquivo de transações e o processa
 * @param {string} filePath - Caminho do arquivo
 * @param {string} mimeType - Tipo MIME do arquivo
 * @param {Array} contas - Contas disponíveis no sistema
 * @param {Array} regras - Regras de categorização
 * @param {Array} historico - Histórico de transações existentes
 * @returns {Object} Resultado da importação
 */
function importarArquivo(filePath, mimeType, contas, regras, historico = []) {
  const log = [];
  let lancamentos = [];
  let conta_detectada = null;
  let tipo_documento = null;
  let duplicidades = [];
  let pendentes = [];

  try {
    // Verifica se arquivo existe
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }

    log.push(`[INFO] Iniciando importação de: ${path.basename(filePath)}`);

    // Detecta tipo de documento
    const extensao = path.extname(filePath).toLowerCase();
    const nomeArquivo = path.basename(filePath);

    if (extensao === '.csv' || mimeType === 'text/csv') {
      tipo_documento = 'CSV';
      log.push(`[INFO] Tipo de documento: CSV`);
      lancamentos = parsearCSV(filePath, log);
    } else if (extensao === '.ofx' || mimeType === 'application/x-ofx') {
      tipo_documento = 'OFX';
      log.push(`[INFO] Tipo de documento: OFX`);
      // OFX parsing seria implementado aqui
      throw new Error('Formato OFX ainda não suportado');
    } else {
      throw new Error(`Formato de arquivo não suportado: ${extensao}`);
    }

    // Detecta banco
    conta_detectada = detectarBanco(lancamentos, nomeArquivo, log);
    log.push(`[INFO] Banco detectado: ${conta_detectada || 'desconhecido'}`);

    // Padroniza e valida transações
    const lancamentosProcessados = [];
    for (const lancamento of lancamentos) {
      try {
        const padronizado = padronizarLancamento(lancamento, conta_detectada);
        lancamentosProcessados.push(padronizado);
      } catch (erro) {
        log.push(`[ERRO] Falha ao padronizar transação: ${erro.message}`);
        pendentes.push(lancamento);
      }
    }

    // Detecta duplicidades
    duplicidades = [];
    for (const lancamento of lancamentosProcessados) {
      if (detectarDuplicidade(lancamento, historico)) {
        log.push(`[AVISO] Transação duplicada detectada: ${lancamento.data} - ${lancamento.descricao}`);
        duplicidades.push(lancamento);
      }
    }

    // Remove duplicidades da lista final
    const lancamentosUnicos = lancamentosProcessados.filter(
      l => !duplicidades.some(d => d.hash === l.hash)
    );

    log.push(`[INFO] Total de transações processadas: ${lancamentosProcessados.length}`);
    log.push(`[INFO] Transações únicas: ${lancamentosUnicos.length}`);
    log.push(`[INFO] Duplicidades: ${duplicidades.length}`);
    log.push(`[INFO] Pendentes: ${pendentes.length}`);

    return {
      lancamentos: lancamentosUnicos,
      conta_detectada,
      tipo_documento,
      duplicidades,
      pendentes,
      log
    };
  } catch (erro) {
    log.push(`[ERRO] Falha na importação: ${erro.message}`);
    return {
      lancamentos: [],
      conta_detectada: null,
      tipo_documento: null,
      duplicidades: [],
      pendentes: [],
      log,
      erro: erro.message
    };
  }
}

/**
 * Detecta encoding do arquivo (UTF-8 ou Latin-1)
 * @param {Buffer} buffer - Buffer do arquivo
 * @returns {string} Encoding detectado
 */
function detectarEncoding(buffer) {
  try {
    // Tenta UTF-8 primeiro (mais comum)
    buffer.toString('utf-8');
    return 'utf-8';
  } catch {
    // Fallback para Latin-1
    return 'latin-1';
  }
}

/**
 * Detecta delimitador do CSV (vírgula, ponto-e-vírgula, tab)
 * @param {string} conteudo - Primeiras linhas do arquivo
 * @returns {string} Delimitador detectado
 */
function detectarDelimitador(conteudo) {
  const linhas = conteudo.split('\n').slice(0, 3);
  const delimitadores = [',', ';', '\t'];

  let delimitadorVencedor = ',';
  let maxOcorrencias = 0;

  for (const delim of delimitadores) {
    let ocorrencias = 0;
    for (const linha of linhas) {
      ocorrencias += (linha.match(new RegExp(`\\${delim}`, 'g')) || []).length;
    }
    if (ocorrencias > maxOcorrencias) {
      maxOcorrencias = ocorrencias;
      delimitadorVencedor = delim;
    }
  }

  return delimitadorVencedor;
}

/**
 * Mapeia colunas automaticamente baseado em nomes comuns
 * @param {Array<string>} headers - Cabeçalhos do CSV
 * @returns {Object} Mapa de índices de colunas
 */
function mapearColunas(headers) {
  const mapa = {
    data: -1,
    descricao: -1,
    valor: -1,
    tipo: -1,
    categoria: -1,
    identificador: -1
  };

  const nomesData = ['data', 'date', 'data transação', 'data da transação', 'data lançamento', 'transacao_data'];
  const nomesDescricao = ['descrição', 'descricao', 'histórico', 'historico', 'lançamento', 'lancamento', 'estabelecimento', 'título', 'titulo'];
  const nomesValor = ['valor', 'value', 'amount', 'quantia', 'montante'];
  const nomesTipo = ['tipo', 'type', 'natureza'];
  const nomesCategoria = ['categoria', 'category', 'classe'];
  const nomesIdentificador = ['identificador', 'id_transacao', 'transaction_id', 'uuid'];

  headers.forEach((header, index) => {
    const headerLower = header.toLowerCase().trim();

    if (mapa.data === -1 && nomesData.some(n => headerLower.includes(n))) {
      mapa.data = index;
    }
    if (mapa.descricao === -1 && nomesDescricao.some(n => headerLower.includes(n))) {
      mapa.descricao = index;
    }
    if (mapa.valor === -1 && nomesValor.some(n => headerLower.includes(n))) {
      mapa.valor = index;
    }
    if (mapa.tipo === -1 && nomesTipo.some(n => headerLower.includes(n))) {
      mapa.tipo = index;
    }
    if (mapa.categoria === -1 && nomesCategoria.some(n => headerLower.includes(n))) {
      mapa.categoria = index;
    }
    if (mapa.identificador === -1 && nomesIdentificador.some(n => headerLower.includes(n))) {
      mapa.identificador = index;
    }
  });

  return mapa;
}

/**
 * Faz parsing de arquivo CSV
 * @param {string} filePath - Caminho do arquivo
 * @param {Array} log - Array de log (opcional)
 * @returns {Array} Array de transações parseadas
 */
function parsearCSV(filePath, log = []) {
  try {
    // Lê conteúdo bruto do arquivo
    const buffer = fs.readFileSync(filePath);
    const encoding = detectarEncoding(buffer);
    const conteudo = buffer.toString(encoding);

    log.push(`[INFO] Encoding detectado: ${encoding}`);

    // Detecta delimitador
    const delimitador = detectarDelimitador(conteudo);
    log.push(`[INFO] Delimitador detectado: ${delimitador === '\t' ? 'TAB' : delimitador}`);

    // Faz parsing do CSV
    const registros = parse(conteudo, {
      delimiter: delimitador,
      skip_empty_lines: true,
      trim: true
    });

    if (registros.length < 1) {
      throw new Error('Arquivo CSV vazio');
    }

    // Extrai headers e dados
    const headers = registros[0];
    const dados = registros.slice(1);

    log.push(`[INFO] Headers detectados: ${headers.join(', ')}`);
    log.push(`[INFO] Total de linhas: ${dados.length}`);

    // Mapeia colunas
    const mapa = mapearColunas(headers);
    log.push(`[INFO] Mapeamento de colunas: ${JSON.stringify(mapa)}`);

    if (mapa.data === -1 || mapa.valor === -1) {
      throw new Error('Não foi possível detectar colunas essenciais (data e/ou valor)');
    }

    // Converte dados em transações
    const lancamentos = [];
    for (const linha of dados) {
      if (linha.length === 0 || !linha[mapa.data] || !linha[mapa.valor]) {
        continue;
      }

      const lancamento = {
        data: linha[mapa.data],
        descricao: mapa.descricao !== -1 ? linha[mapa.descricao] : '',
        valor: linha[mapa.valor],
        tipo: mapa.tipo !== -1 ? linha[mapa.tipo] : null,
        categoria: mapa.categoria !== -1 ? linha[mapa.categoria] : null,
        identificador: mapa.identificador !== -1 ? linha[mapa.identificador] : null,
        dados_originais: Object.fromEntries(headers.map((h, i) => [h, linha[i]]))
      };
      lancamentos.push(lancamento);
    }

    log.push(`[INFO] ${lancamentos.length} transações extraídas do CSV`);
    return lancamentos;
  } catch (erro) {
    log.push(`[ERRO] Falha ao fazer parsing de CSV: ${erro.message}`);
    throw erro;
  }
}

/**
 * Normaliza valor para número (formatos brasileiros)
 * @param {string} valorStr - String com o valor
 * @returns {number} Valor normalizado
 */
function normalizarValor(valorStr) {
  if (typeof valorStr === 'number') {
    return valorStr;
  }

  if (!valorStr || typeof valorStr !== 'string') {
    return 0;
  }

  // Remove espaços e símbolos de moeda
  let valor = valorStr.trim().replace(/[R$\s]/g, '');

  // Detecta se é negativo (parenteses ou travessão)
  const negativo = /^[\(-]/.test(valor) || /[\)]$/.test(valor);
  valor = valor.replace(/[()]/g, '');

  // Detecta formato: pode ser 1.234,56 (brasileiro) ou 1,234.56 (americano)
  // Heurística: se tem ponto antes da vírgula, é brasileiro
  if (valor.includes('.') && valor.includes(',')) {
    // Formato brasileiro: substitui . por nada e , por .
    valor = valor.replace('.', '').replace(',', '.');
  } else if (valor.includes(',') && !valor.includes('.')) {
    // Pode ser brasileiro (1,5) ou com thousands separator
    const partes = valor.split(',');
    if (partes[1].length === 2) {
      // Provavelmente decimal (1.234,56 sem o ponto)
      valor = valor.replace(',', '.');
    }
  }

  let numero = parseFloat(valor);

  if (isNaN(numero)) {
    numero = 0;
  }

  return negativo ? -Math.abs(numero) : numero;
}

/**
 * Normaliza data para formato YYYY-MM-DD
 * @param {string} dataStr - String com a data
 * @returns {string} Data normalizada ou null
 */
function normalizarData(dataStr) {
  if (!dataStr || typeof dataStr !== 'string') {
    return null;
  }

  dataStr = dataStr.trim();

  // Detecta formato DD/MM/YYYY
  const regexBR = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const matchBR = dataStr.match(regexBR);
  if (matchBR) {
    const [, dia, mes, ano] = matchBR;
    return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  // Detecta formato DD/MM/YY
  const regexBRCurto = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/;
  const matchBRCurto = dataStr.match(regexBRCurto);
  if (matchBRCurto) {
    const [, dia, mes, ano] = matchBRCurto;
    const anoCompleto = parseInt(ano) < 50 ? 2000 + parseInt(ano) : 1900 + parseInt(ano);
    return `${anoCompleto}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  // Detecta formato DD-MM-YYYY
  const regexTrab = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
  const matchTrab = dataStr.match(regexTrab);
  if (matchTrab) {
    const [, dia, mes, ano] = matchTrab;
    return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  // Detecta formato YYYY-MM-DD (já normalizado)
  const regexISO = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  const matchISO = dataStr.match(regexISO);
  if (matchISO) {
    const [, ano, mes, dia] = matchISO;
    return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  // Tenta parse genérico
  const data = new Date(dataStr);
  if (!isNaN(data.getTime())) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  return null;
}

/**
 * Gera hash para deduplicação de transação
 * @param {Object} lancamento - Objeto com transação
 * @returns {string} Hash SHA256
 */
function gerarHash(lancamento) {
  // Se tem identificador único (ex: UUID do Nubank conta corrente), usa ele — deduplicação perfeita
  if (lancamento.identificador) {
    return crypto.createHash('sha256').update(lancamento.identificador).digest('hex');
  }
  const dados = `${lancamento.data}|${lancamento.descricao}|${lancamento.valor}`;
  return crypto.createHash('sha256').update(dados).digest('hex');
}

/**
 * Detecta tipo de transação
 * @param {string|number} valor - Valor da transação
 * @param {string} tipo - Campo tipo (se existir)
 * @returns {string} Tipo: despesa, receita ou transferencia
 */
function detectarTipo(valor, tipo = null) {
  // Se tem tipo explícito
  if (tipo) {
    const tipoLower = String(tipo).toLowerCase();
    if (tipoLower.includes('transfer')) return 'transferencia';
    if (tipoLower.includes('saída') || tipoLower.includes('saida') || tipoLower.includes('debit')) return 'despesa';
    if (tipoLower.includes('entrada') || tipoLower.includes('credit')) return 'receita';
  }

  // Detecta por valor
  const valorNum = typeof valor === 'number' ? valor : normalizarValor(valor);
  if (valorNum > 0) return 'receita';
  if (valorNum < 0) return 'despesa';

  return 'transferencia';
}

/**
 * Padroniza uma transação bruta
 * @param {Object} lancamentoRaw - Objeto bruto parseado
 * @param {string} banco - Nome do banco
 * @returns {Object} Transação padronizada
 */
function padronizarLancamento(lancamentoRaw, banco = null) {
  const data = normalizarData(lancamentoRaw.data);
  if (!data) {
    throw new Error(`Data inválida: ${lancamentoRaw.data}`);
  }

  const valor = normalizarValor(lancamentoRaw.valor);
  if (valor === 0) {
    throw new Error(`Valor inválido: ${lancamentoRaw.valor}`);
  }

  const descricao = String(lancamentoRaw.descricao || '').trim().toUpperCase();
  const tipo = detectarTipo(valor, lancamentoRaw.tipo);

  const lancamento = {
    data,
    descricao,
    descricao_original: String(lancamentoRaw.descricao || ''),
    valor: Math.abs(valor),
    valor_operacao: valor,
    tipo,
    categoria: lancamentoRaw.categoria || null,
    identificador: lancamentoRaw.identificador || null,
    origem_dado: banco || 'desconhecido',
    processado_em: new Date().toISOString()
  };

  // Gera hash (usa identificador único quando disponível)
  lancamento.hash = gerarHash(lancamento);

  return lancamento;
}

/**
 * Detecta duplicidade de transação
 * @param {Object} lancamento - Transação a verificar
 * @param {Array} existentes - Array de transações existentes
 * @returns {boolean} True se é duplicada
 */
function detectarDuplicidade(lancamento, existentes = []) {
  if (!Array.isArray(existentes)) {
    return false;
  }

  // Verifica por hash
  const hashMatch = existentes.some(e => e.hash === lancamento.hash);
  if (hashMatch) {
    return true;
  }

  // Verifica por match exato: data + descrição + valor
  const matchExato = existentes.some(e =>
    e.data === lancamento.data &&
    e.descricao === lancamento.descricao &&
    Math.abs(e.valor - lancamento.valor) < 0.01
  );

  return matchExato;
}

/**
 * Detecta qual banco o arquivo vem
 * @param {Array} lancamentos - Transações parseadas
 * @param {string} nomeArquivo - Nome do arquivo
 * @param {Array} log - Array de log (opcional)
 * @returns {string|null} Nome do banco detectado
 */
function detectarBanco(lancamentos, nomeArquivo, log = []) {
  const nomeArqLower = nomeArquivo.toLowerCase();

  // Detecta por padrões no nome do arquivo
  if (nomeArqLower.includes('nubank')) return 'nubank';
  if (nomeArqLower.includes('bb') || nomeArqLower.includes('banco do brasil')) return 'banco_do_brasil';
  if (nomeArqLower.includes('porto')) return 'porto_bank';
  if (nomeArqLower.includes('mercado pago')) return 'mercado_pago';
  if (nomeArqLower.includes('pda') || nomeArqLower.includes('pão') || nomeArqLower.includes('pao')) return 'pao_de_acucar';

  // Tenta detectar por padrões nas transações
  if (lancamentos.length > 0) {
    const primeira = lancamentos[0];

    // Nubank conta corrente: tem identificador UUID
    if (primeira.identificador && /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(primeira.identificador)) {
      return 'nubank';
    }

    // Nubank cartão: geralmente tem categoria
    if (primeira.categoria && lancamentos.some(l => l.categoria)) {
      return 'nubank';
    }

    // Analisa padrões de descrição
    const descricoes = lancamentos.map(l => String(l.descricao || '').toLowerCase()).join(' ');

    if (descricoes.includes('pao de acucar') || descricoes.includes('pda')) {
      return 'pao_de_acucar';
    }
    if (descricoes.includes('mercado livre') || descricoes.includes('mercado pago')) {
      return 'mercado_pago';
    }
  }

  return null;
}

// Exports
module.exports = {
  importarArquivo,
  parsearCSV,
  detectarDuplicidade,
  gerarHash,
  padronizarLancamento,
  detectarBanco,
  normalizarValor,
  normalizarData,
  normalizarEncoding: detectarEncoding,
  normalizarDelimitador: detectarDelimitador,
  mapearColunas,
  BANCOS_SUPORTADOS
};
