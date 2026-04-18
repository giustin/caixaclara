// ============================================================
// CaixaClara - Google Apps Script (Backend API)
// Este código roda dentro do Google Apps Script
// e serve como API entre o frontend e a planilha Google.
// ============================================================

// ID da planilha (será preenchido automaticamente pelo setup)
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

// ============================================================
// SETUP INICIAL - Cria todas as abas com cabeçalhos
// Execute esta função UMA VEZ após criar o script
// ============================================================
function setupInicial() {
  const ss = getSpreadsheet();

  const abas = {
    'contas': ['id', 'nome', 'instituicao', 'tipo', 'titular', 'status', 'saldo_atual', 'data_atualizacao', 'liquidez_imediata', 'patrimonio_total', 'visao_caixa', 'observacoes'],
    'lancamentos': ['id', 'data_transacao', 'data_competencia', 'descricao_original', 'descricao_padronizada', 'valor', 'tipo', 'conta_origem', 'conta_destino', 'cartao', 'categoria', 'subcategoria', 'status_classificacao', 'origem_dado', 'arquivo_origem', 'hash', 'observacao', 'recorrente', 'extraordinario', 'confianca', 'lote_importacao', 'reembolsavel', 'is_projecao', 'parcela_num', 'parcela_total', 'projecao_origem_lote'],
    'categorias': ['id', 'nome', 'icone', 'grupo', 'ativa', 'ordem', 'tipo'],
    'tetos': ['id', 'categoria', 'teto_mensal', 'teto_semanal', 'teto_anual', 'mes_referencia'],
    'metas': ['id', 'nome', 'tipo', 'valor_alvo', 'valor_atual', 'data_inicio', 'data_limite', 'status', 'prioridade'],
    'regras_classificacao': ['id', 'padrao_texto', 'categoria', 'subcategoria', 'banco', 'tipo_transacao', 'confianca', 'vezes_usada'],
    'regras_split': ['id', 'padrao_texto', 'partes_json', 'vezes_usada', 'criada_em', 'atualizada_em'],
    'importacoes_log': ['id', 'data_importacao', 'tipo_arquivo', 'nome_arquivo', 'conta_detectada', 'linhas_importadas', 'duplicidades_ignoradas', 'itens_pendentes', 'status'],
    'config': ['chave', 'valor', 'descricao'],
    'saldos_historico': ['id', 'data', 'conta_id', 'conta_nome', 'instituicao', 'produto', 'tipo_movimento', 'valor_movimento', 'saldo_apos', 'observacao', 'lote_importacao']
  };

  // Criar abas
  Object.keys(abas).forEach(nomeAba => {
    let sheet = ss.getSheetByName(nomeAba);
    if (!sheet) {
      sheet = ss.insertSheet(nomeAba);
    }
    // Limpar e colocar cabeçalho
    const headers = abas[nomeAba];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e8eaf6');
    sheet.setFrozenRows(1);
  });

  // Popular categorias padrão (lista definitiva - renda referência: R$ 10.000)
  const catSheet = ss.getSheetByName('categorias');
  const categorias = [
    // --- Despesas variáveis ---
    ['cat01', 'Supermercado', '🛒', 'essencial', 'sim', 1, 'despesa'],
    ['cat02', 'Restaurantes', '🍽️', 'variavel', 'sim', 2, 'despesa'],
    ['cat03', 'Combustível', '⛽', 'transporte', 'sim', 3, 'despesa'],
    ['cat04', 'Transporte', '🚕', 'transporte', 'sim', 4, 'despesa'],
    ['cat05', 'Saúde', '🏥', 'essencial', 'sim', 5, 'despesa'],
    ['cat06', 'Pet', '🐾', 'variavel', 'sim', 6, 'despesa'],
    ['cat07', 'Educação', '📚', 'essencial', 'sim', 7, 'despesa'],
    ['cat08', 'Lazer', '🎬', 'variavel', 'sim', 8, 'despesa'],
    ['cat09', 'Compras Pessoais', '🛍️', 'variavel', 'sim', 9, 'despesa'],
    ['cat10', 'Casa', '🏠', 'essencial', 'sim', 10, 'despesa'],
    ['cat11', 'Assinaturas', '📱', 'fixa', 'sim', 11, 'despesa'],
    ['cat12', 'Seguros', '🛡️', 'fixa', 'sim', 12, 'despesa'],
    ['cat13', 'Impostos', '📋', 'fixa', 'sim', 13, 'despesa'],
    ['cat14', 'Viagens', '✈️', 'variavel', 'sim', 14, 'despesa'],
    ['cat15', 'Presentes', '🎁', 'variavel', 'sim', 15, 'despesa'],
    ['cat30', 'Outras Despesas', '📦', 'variavel', 'sim', 30, 'despesa'],
    // --- Receitas (sem teto padrão) ---
    ['cat16', 'Salário e Proventos', '💰', 'receita', 'sim', 16, 'receita'],
    ['cat17', 'Pró-labore', '🏢', 'receita', 'sim', 17, 'receita'],
    ['cat18', 'Freelance / Extra', '💼', 'receita', 'sim', 18, 'receita'],
    ['cat19', 'Rendimentos', '📈', 'receita', 'sim', 19, 'receita'],
    ['cat20', 'Outras Receitas', '💵', 'receita', 'sim', 20, 'receita'],
    ['cat21', 'Lucros e Dividendos', '💎', 'receita', 'sim', 21, 'receita'],
    // --- Moradia e contas fixas ---
    ['cat22', 'Moradia / Aluguel', '🏡', 'fixa', 'sim', 22, 'despesa'],
    ['cat23', 'Água', '💧', 'fixa', 'sim', 23, 'despesa'],
    ['cat24', 'Telefone / Celular', '📱', 'fixa', 'sim', 24, 'despesa'],
    ['cat25', 'Energia', '💡', 'fixa', 'sim', 25, 'despesa'],
    // --- Financeiro / bancário (sem teto padrão) ---
    ['cat26', 'Juros / IOF Bancário', '🏦', 'financeiro', 'sim', 26, 'despesa'],
    ['cat27', 'Tarifa Bancária', '💳', 'financeiro', 'sim', 27, 'despesa'],
    ['cat28', 'Pagamento Fatura Cartão', '💳', 'financeiro', 'sim', 28, 'transferencia'],
    ['cat29', 'Financiamento / Dívidas', '💸', 'financeiro', 'sim', 29, 'despesa'],
  ];
  if (catSheet.getLastRow() <= 1) {
    catSheet.getRange(2, 1, categorias.length, categorias[0].length).setValues(categorias);
  }

  // Popular tetos padrão (apenas categorias de despesa que fazem sentido controlar)
  // Referência: renda média R$ 10.000/mês
  const tetosSheet = ss.getSheetByName('tetos');
  const tetos = [
    ['t01', 'Supermercado', 2000, 500, 24000, ''],
    ['t02', 'Restaurantes', 800, 200, 9600, ''],
    ['t03', 'Combustível', 600, 150, 7200, ''],
    ['t04', 'Transporte', 300, 75, 3600, ''],
    ['t05', 'Saúde', 500, 125, 6000, ''],
    ['t06', 'Pet', 200, 50, 2400, ''],
    ['t07', 'Educação', 1000, 250, 12000, ''],
    ['t08', 'Lazer', 400, 100, 4800, ''],
    ['t09', 'Compras Pessoais', 300, 75, 3600, ''],
    ['t10', 'Casa', 500, 125, 6000, ''],
    ['t11', 'Assinaturas', 250, 63, 3000, ''],
    ['t12', 'Seguros', 400, 100, 4800, ''],
    ['t13', 'Impostos', 500, 125, 6000, ''],
    ['t14', 'Viagens', 500, 125, 6000, ''],
    ['t15', 'Presentes', 200, 50, 2400, ''],
    ['t16', 'Moradia / Aluguel', 2000, 500, 24000, ''],
    ['t17', 'Água', 120, 30, 1440, ''],
    ['t18', 'Telefone / Celular', 100, 25, 1200, ''],
    ['t19', 'Energia', 200, 50, 2400, ''],
  ];
  if (tetosSheet.getLastRow() <= 1) {
    tetosSheet.getRange(2, 1, tetos.length, tetos[0].length).setValues(tetos);
  }

  // Popular config
  const configSheet = ss.getSheetByName('config');
  const configs = [
    ['moeda', 'BRL', 'Moeda principal'],
    ['timezone', 'America/Sao_Paulo', 'Fuso horário'],
    ['meta_sobra_mensal', '1500', 'Meta de sobra por mês'],
    ['saldo_minimo_seguranca', '3000', 'Saldo mínimo de segurança'],
  ];
  if (configSheet.getLastRow() <= 1) {
    configSheet.getRange(2, 1, configs.length, configs[0].length).setValues(configs);
  }

  // Remover Sheet1 padrão se existir
  const sheet1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('Página1') || ss.getSheetByName('Planilha1');
  if (sheet1 && ss.getSheets().length > 1) {
    ss.deleteSheet(sheet1);
  }

  SpreadsheetApp.getUi().alert('✅ CaixaClara configurado com sucesso!\n\nAbas criadas: ' + Object.keys(abas).join(', '));
}

// ============================================================
// API WEB - Recebe requisições GET e POST do frontend
// ============================================================

function doGet(e) {
  const action = e.parameter.action || 'ping';
  let result;

  try {
    switch (action) {
      case 'ping':
        result = { ok: true, msg: 'CaixaClara API ativa' };
        break;
      case 'contas':
        result = lerAba('contas');
        break;
      case 'lancamentos':
        result = lerLancamentos(e.parameter);
        break;
      case 'categorias':
        result = lerAba('categorias');
        break;
      case 'tetos':
        result = lerAba('tetos');
        break;
      case 'metas':
        result = lerAba('metas');
        break;
      case 'regras':
        result = lerAba('regras_classificacao');
        break;
      case 'regras_split':
        result = lerAba('regras_split');
        break;
      case 'config':
        result = lerAba('config');
        break;
      case 'dashboard':
        result = gerarDashboard(e.parameter);
        break;
      case 'importacoes':
        result = lerAba('importacoes_log');
        break;
      case 'saldos_historico':
        result = lerAba('saldos_historico');
        break;
      case 'post_via_get':
        // Fallback: recebe POST como GET (para contornar CORS)
        try {
          // e.parameter já decodifica automaticamente, não precisa de decodeURIComponent
          var rawPayload = e.parameter.payload;
          var payload = JSON.parse(rawPayload);
          var postAction = payload.action;
          var postDados = payload.dados;
          switch (postAction) {
            case 'salvar_lancamento': result = salvarLancamento(postDados); break;
            case 'salvar_lancamentos': result = salvarLancamentosLote(postDados); break;
            case 'deletar_lancamento': result = deletarLinha('lancamentos', postDados.id || payload.id); break;
            case 'deletar_lote': result = deletarLote(postDados.lote_id || postDados.id); break;
            case 'deletar_projecoes': result = deletarProjecoes(postDados); break;
            case 'log_importacao': result = salvarGenerico('importacoes_log', postDados); break;
            case 'salvar_conta': result = salvarConta(postDados); break;
            case 'salvar_categoria': result = salvarGenerico('categorias', postDados); break;
            case 'salvar_meta': result = salvarMeta(postDados); break;
            case 'salvar_teto': result = salvarTeto(postDados); break;
            case 'salvar_regra': result = salvarRegra(postDados); break;
            case 'salvar_regra_split': result = salvarGenerico('regras_split', postDados); break;
            case 'deletar_regra_split': result = deletarLinha('regras_split', postDados.id || payload.id); break;
            case 'atualizar_saldo': result = atualizarSaldo(postDados.conta_id, postDados.novo_saldo); break;
            case 'salvar_saldo_historico': result = salvarGenerico('saldos_historico', postDados); break;
            case 'deletar_saldo_historico': result = deletarLinha('saldos_historico', postDados.id); break;
            case 'registrar_transferencia': result = registrarTransferencia(postDados); break;
            default: result = { erro: 'Ação POST desconhecida: ' + postAction };
          }
        } catch (parseErr) {
          result = { erro: 'Erro no payload: ' + parseErr.toString() };
        }
        break;
      default:
        result = { erro: 'Ação desconhecida: ' + action };
    }
  } catch (err) {
    result = { erro: err.toString() };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return respJson({ erro: 'JSON inválido' });
  }

  const action = body.action;
  let result;

  try {
    switch (action) {
      case 'salvar_lancamento':
        result = salvarLancamento(body.dados);
        break;
      case 'salvar_lancamentos':
        result = salvarLancamentosLote(body.dados);
        break;
      case 'deletar_lancamento':
        result = deletarLinha('lancamentos', body.id);
        break;
      case 'salvar_conta':
        result = salvarConta(body.dados);
        break;
      case 'deletar_lote':
        result = deletarLote(body.dados.lote_id || body.dados.id);
        break;
      case 'deletar_projecoes':
        result = deletarProjecoes(body.dados);
        break;
      case 'salvar_categoria':
        result = salvarGenerico('categorias', body.dados);
        break;
      case 'salvar_meta':
        result = salvarMeta(body.dados);
        break;
      case 'salvar_teto':
        result = salvarTeto(body.dados);
        break;
      case 'salvar_regra':
        result = salvarRegra(body.dados);
        break;
      case 'salvar_regra_split':
        result = salvarGenerico('regras_split', body.dados);
        break;
      case 'deletar_regra_split':
        result = deletarLinha('regras_split', body.dados ? body.dados.id : body.id);
        break;
      case 'atualizar_saldo':
        result = atualizarSaldo(body.conta_id, body.novo_saldo);
        break;
      case 'log_importacao':
        result = registrarImportacao(body.dados);
        break;
      default:
        result = { erro: 'Ação desconhecida: ' + action };
    }
  } catch (err) {
    result = { erro: err.toString() };
  }

  return respJson(result);
}

function respJson(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// AUTO-CRIAR ABAS (se não existirem)
// ============================================================
var HEADERS = {
  'contas': ['id', 'nome', 'instituicao', 'tipo', 'titular', 'status', 'saldo_atual', 'data_atualizacao', 'liquidez_imediata', 'patrimonio_total', 'visao_caixa', 'observacoes', 'dia_fechamento', 'dia_vencimento', 'limite', 'bandeira'],
  'lancamentos': ['id', 'data_transacao', 'data_competencia', 'descricao_original', 'descricao_padronizada', 'valor', 'tipo', 'conta_origem', 'conta_destino', 'cartao', 'categoria', 'subcategoria', 'status_classificacao', 'origem_dado', 'arquivo_origem', 'hash', 'observacao', 'recorrente', 'extraordinario', 'confianca', 'lote_importacao', 'reembolsavel', 'is_projecao', 'parcela_num', 'parcela_total', 'projecao_origem_lote'],
  'categorias': ['id', 'nome', 'icone', 'grupo', 'ativa', 'ordem', 'teto_mensal', 'tipo'],
  'tetos': ['id', 'categoria', 'teto_mensal', 'teto_semanal', 'teto_anual', 'mes_referencia'],  // mantém por compatibilidade
  'metas': ['id', 'nome', 'tipo', 'valor_alvo', 'valor_atual', 'data_inicio', 'data_limite', 'status', 'prioridade'],
  'regras_classificacao': ['id', 'padrao_texto', 'categoria', 'subcategoria', 'banco', 'tipo_transacao', 'confianca', 'vezes_usada'],
  'regras_split': ['id', 'padrao_texto', 'partes_json', 'vezes_usada', 'criada_em', 'atualizada_em'],
  'importacoes_log': ['id', 'data_importacao', 'tipo_arquivo', 'nome_arquivo', 'conta_detectada', 'linhas_importadas', 'duplicidades_ignoradas', 'itens_pendentes', 'status'],
  'config': ['chave', 'valor', 'descricao'],
  'saldos_historico': ['id', 'data', 'conta_id', 'conta_nome', 'instituicao', 'produto', 'tipo_movimento', 'valor_movimento', 'saldo_apos', 'observacao', 'lote_importacao']
};

function obterOuCriarAba(nomeAba) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(nomeAba);
  if (sheet) {
    // Migração: verificar se há colunas faltantes nos headers
    migrarHeaders(sheet, nomeAba);
    return sheet;
  }

  // Criar aba automaticamente
  sheet = ss.insertSheet(nomeAba);
  var headers = HEADERS[nomeAba];
  if (headers) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e8eaf6');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Migração automática: adiciona colunas faltantes em abas existentes.
 * Compara os headers atuais da planilha com os esperados em HEADERS
 * e adiciona ao final qualquer coluna que esteja faltando.
 */
function migrarHeaders(sheet, nomeAba) {
  var esperados = HEADERS[nomeAba];
  if (!esperados) return;

  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;

  var atuais = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  var faltantes = esperados.filter(h => !atuais.includes(h));

  if (faltantes.length > 0) {
    var col = lastCol + 1;
    faltantes.forEach(h => {
      sheet.getRange(1, col).setValue(h);
      sheet.getRange(1, col).setFontWeight('bold').setBackground('#e8eaf6');
      col++;
    });
  }
}

// ============================================================
// FUNÇÕES DE LEITURA
// ============================================================

function lerAba(nomeAba) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(nomeAba);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const obj = {};
    headers.forEach((h, j) => {
      obj[h] = data[i][j];
    });
    rows.push(obj);
  }
  return rows;
}

function lerLancamentos(params) {
  let lancamentos = lerAba('lancamentos');

  // Filtro por mês (usa data_transacao)
  if (params.mes) {
    lancamentos = lancamentos.filter(l => {
      const d = formatarDataParaStr(l.data_transacao);
      return d.startsWith(params.mes);
    });
  }

  // Filtro por competência (usa data_competencia, fallback para data_transacao)
  if (params.competencia) {
    lancamentos = lancamentos.filter(l => {
      const dc = formatarDataParaStr(l.data_competencia) || formatarDataParaStr(l.data_transacao);
      return dc.startsWith(params.competencia);
    });
  }

  // Filtro por datas
  if (params.de && params.ate) {
    lancamentos = lancamentos.filter(l => {
      const d = formatarDataParaStr(l.data_transacao);
      return d >= params.de && d <= params.ate;
    });
  }

  // Filtro por categoria
  if (params.categoria) {
    lancamentos = lancamentos.filter(l => l.categoria === params.categoria);
  }

  return lancamentos;
}

// ============================================================
// FUNÇÕES DE ESCRITA
// ============================================================

function salvarLancamento(dados) {
  var sheet = obterOuCriarAba('lancamentos');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  if (dados.id) {
    // Atualizar existente
    const linhaIdx = encontrarLinha(sheet, 'id', dados.id);
    if (linhaIdx > 0) {
      const row = headers.map(h => dados[h] !== undefined ? dados[h] : '');
      sheet.getRange(linhaIdx, 1, 1, headers.length).setValues([row]);
      return { ok: true, msg: 'Lançamento atualizado', id: dados.id };
    }
  }

  // Novo lançamento
  if (!dados.id) {
    dados.id = 'L' + new Date().getTime();
  }
  const row = headers.map(h => dados[h] !== undefined ? dados[h] : '');
  sheet.appendRow(row);
  return { ok: true, msg: 'Lançamento criado', id: dados.id };
}

function salvarLancamentosLote(lista) {
  var sheet = obterOuCriarAba('lancamentos');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const rows = lista.map(dados => {
    if (!dados.id) dados.id = 'L' + new Date().getTime() + Math.random().toString(36).substr(2, 4);
    return headers.map(h => dados[h] !== undefined ? dados[h] : '');
  });

  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  }

  return { ok: true, msg: rows.length + ' lançamentos importados' };
}

function salvarConta(dados) {
  // Garantir que todas as colunas de contas existem (pode faltar em planilhas antigas)
  var sheet = obterOuCriarAba('contas');
  garantirColunas(sheet, HEADERS['contas'] || []);
  return salvarGenerico('contas', dados);
}

function salvarMeta(dados) {
  return salvarGenerico('metas', dados);
}

function salvarTeto(dados) {
  return salvarGenerico('tetos', dados);
}

function salvarRegra(dados) {
  return salvarGenerico('regras_classificacao', dados);
}

// Garante que todas as colunas esperadas existem na aba (adiciona as faltantes)
function garantirColunas(sheet, colunasEsperadas) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var adicionadas = [];
  colunasEsperadas.forEach(function(col) {
    if (headers.indexOf(col) < 0) {
      var nextCol = headers.length + adicionadas.length + 1;
      sheet.getRange(1, nextCol).setValue(col).setFontWeight('bold').setBackground('#e8eaf6');
      adicionadas.push(col);
    }
  });
  return adicionadas;
}

// Deleta projeções de parcelas para um cartão e competência específicos
// Usado quando se importa uma fatura real que substitui as projeções
function deletarProjecoes(params) {
  if (!params.conta_id || !params.competencia) return { erro: 'conta_id e competencia são obrigatórios' };

  var sheet = obterOuCriarAba('lancamentos');
  garantirColunas(sheet, ['is_projecao', 'conta_origem', 'data_competencia']);

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var colProj = headers.indexOf('is_projecao');
  var colConta = headers.indexOf('conta_origem');
  var colComp = headers.indexOf('data_competencia');

  if (colProj < 0 || colConta < 0 || colComp < 0) return { ok: true, deletados: 0 };

  var linhasManter = [headers];
  var deletados = 0;

  for (var i = 1; i < data.length; i++) {
    var isProj = String(data[i][colProj]) === 'sim';
    var contaMatch = String(data[i][colConta]) === String(params.conta_id);
    var compStr = formatarDataParaStr(data[i][colComp]) || '';
    var compMatch = compStr.startsWith(params.competencia);

    if (isProj && contaMatch && compMatch) {
      deletados++;
    } else {
      linhasManter.push(data[i]);
    }
  }

  if (deletados > 0) {
    sheet.clearContents();
    if (linhasManter.length > 0) {
      sheet.getRange(1, 1, linhasManter.length, headers.length).setValues(linhasManter);
    }
  }

  return { ok: true, deletados: deletados };
}

// Deleta todos os lançamentos de um lote de importação
function deletarLote(loteId) {
  if (!loteId) return { erro: 'lote_id não informado' };

  var sheet = obterOuCriarAba('lancamentos');

  // Garantir que a coluna lote_importacao existe (pode faltar em planilhas criadas antes)
  garantirColunas(sheet, ['lote_importacao']);

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var colLote = headers.indexOf('lote_importacao');

  // Se a coluna agora existe mas estava vazia, tentar fallback por arquivo_origem
  // Buscar info do lote no importacoes_log para saber o nome do arquivo
  var logSheet = obterOuCriarAba('importacoes_log');
  var logData = logSheet.getDataRange().getValues();
  var logHeaders = logData[0];
  var colLogId = logHeaders.indexOf('id');
  var colLogArquivo = logHeaders.indexOf('nome_arquivo');
  var colLogConta = logHeaders.indexOf('conta_detectada');
  var loteInfo = null;
  if (colLogId >= 0) {
    for (var k = 1; k < logData.length; k++) {
      if (String(logData[k][colLogId]) === String(loteId)) {
        loteInfo = {
          nome_arquivo: colLogArquivo >= 0 ? String(logData[k][colLogArquivo]) : '',
          conta_detectada: colLogConta >= 0 ? String(logData[k][colLogConta]) : ''
        };
        break;
      }
    }
  }

  // Filtrar lançamentos: primeiro por lote_importacao, se não achar por arquivo_origem
  var colArquivo = headers.indexOf('arquivo_origem');
  var linhasManter = [headers];
  var deletados = 0;

  for (var i = 1; i < data.length; i++) {
    var matchLote = colLote >= 0 && String(data[i][colLote]) === String(loteId);
    // Fallback: se nenhum match por lote e temos info do arquivo, tentar por arquivo_origem
    var matchArquivo = false;
    if (!matchLote && deletados === 0 && loteInfo && loteInfo.nome_arquivo && colArquivo >= 0) {
      matchArquivo = String(data[i][colArquivo]) === loteInfo.nome_arquivo;
    }

    if (matchLote || matchArquivo) {
      deletados++;
    } else {
      linhasManter.push(data[i]);
    }
  }

  // Se nenhum match por lote_importacao, fazer segunda passagem com fallback por arquivo
  if (deletados === 0 && loteInfo && loteInfo.nome_arquivo && colArquivo >= 0) {
    linhasManter = [headers];
    for (var i2 = 1; i2 < data.length; i2++) {
      if (String(data[i2][colArquivo]) === loteInfo.nome_arquivo) {
        deletados++;
      } else {
        linhasManter.push(data[i2]);
      }
    }
  }

  // Reescrever a aba inteira de uma vez (muito mais rápido que deleteRow em loop)
  sheet.clearContents();
  if (linhasManter.length > 0) {
    sheet.getRange(1, 1, linhasManter.length, headers.length).setValues(linhasManter);
  }

  // Deletar o log de importação
  if (colLogId >= 0) {
    var logManter = [logHeaders];
    for (var j = 1; j < logData.length; j++) {
      if (String(logData[j][colLogId]) !== String(loteId)) {
        logManter.push(logData[j]);
      }
    }
    logSheet.clearContents();
    if (logManter.length > 0) {
      logSheet.getRange(1, 1, logManter.length, logHeaders.length).setValues(logManter);
    }
  }

  // Limpar saldos_historico vinculados ao lote (movimentos de investimento criados na importação)
  var deletadosSH = 0;
  try {
    var shSheet = obterOuCriarAba('saldos_historico');
    garantirColunas(shSheet, ['lote_importacao']);
    var shData = shSheet.getDataRange().getValues();
    if (shData.length > 1) {
      var shHeaders = shData[0];
      var colSHLote = shHeaders.indexOf('lote_importacao');
      var colSHObs = shHeaders.indexOf('observacao');
      var shManter = [shHeaders];

      for (var s = 1; s < shData.length; s++) {
        var matchPorLote = colSHLote >= 0 && String(shData[s][colSHLote]) === String(loteId);
        // Fallback para registros antigos sem lote_importacao: match por observacao contendo "(importação extrato)"
        // + arquivo_origem do lote, se disponível
        var matchPorObs = false;
        if (!matchPorLote && colSHObs >= 0 && loteInfo && loteInfo.nome_arquivo) {
          var obs = String(shData[s][colSHObs]);
          matchPorObs = obs.indexOf('(importação extrato)') >= 0 && (!shData[s][colSHLote] || String(shData[s][colSHLote]).trim() === '');
        }
        if (matchPorLote || matchPorObs) {
          deletadosSH++;
        } else {
          shManter.push(shData[s]);
        }
      }

      if (deletadosSH > 0) {
        shSheet.clearContents();
        if (shManter.length > 0) {
          shSheet.getRange(1, 1, shManter.length, shHeaders.length).setValues(shManter);
        }
      }
    }
  } catch (e) {
    // Não bloquear a exclusão do lote se houver erro no saldos_historico
  }

  return { ok: true, msg: deletados + ' lançamentos do lote removidos' + (deletadosSH > 0 ? ' + ' + deletadosSH + ' movimentos de investimento' : ''), deletados: deletados, deletados_saldos: deletadosSH };
}

// ============================================================
// TRANSFERÊNCIA ENTRE CONTAS (investimento ↔ conta corrente)
// Cria lançamento tipo transferencia_interna + registra no saldos_historico
// ============================================================
function registrarTransferencia(dados) {
  // dados: { conta_origem_id, conta_destino_id, valor, data, observacao }
  if (!dados.conta_origem_id || !dados.conta_destino_id || !dados.valor) {
    return { erro: 'Campos obrigatórios: conta_origem_id, conta_destino_id, valor' };
  }

  var valor = Math.abs(Number(dados.valor));
  var dataTransacao = dados.data || new Date().toISOString().slice(0, 10);
  var obs = dados.observacao || '';
  var id = 'TRF_' + new Date().getTime();

  // Buscar dados das contas
  var contasSheet = obterOuCriarAba('contas');
  var contasData = contasSheet.getDataRange().getValues();
  var contasHeaders = contasData[0];
  var colContaId = contasHeaders.indexOf('id');
  var colContaNome = contasHeaders.indexOf('nome');
  var colContaInstituicao = contasHeaders.indexOf('instituicao');
  var colContaSaldo = contasHeaders.indexOf('saldo_atual');

  var contaOrigem = null, contaDestino = null;
  var linhaOrigem = -1, linhaDestino = -1;
  for (var i = 1; i < contasData.length; i++) {
    if (String(contasData[i][colContaId]) === String(dados.conta_origem_id)) {
      contaOrigem = { nome: contasData[i][colContaNome], instituicao: contasData[i][colContaInstituicao], saldo: Number(contasData[i][colContaSaldo] || 0) };
      linhaOrigem = i + 1;
    }
    if (String(contasData[i][colContaId]) === String(dados.conta_destino_id)) {
      contaDestino = { nome: contasData[i][colContaNome], instituicao: contasData[i][colContaInstituicao], saldo: Number(contasData[i][colContaSaldo] || 0) };
      linhaDestino = i + 1;
    }
  }
  if (!contaOrigem || !contaDestino) return { erro: 'Conta origem ou destino não encontrada' };

  // 1. Criar lançamento de transferência interna
  var lancamento = {
    id: id,
    data_transacao: dataTransacao,
    data_competencia: dataTransacao,
    descricao_original: 'Transferência: ' + contaOrigem.nome + ' → ' + contaDestino.nome,
    descricao_padronizada: 'Transferência interna',
    valor: valor,
    tipo: 'transferencia_interna',
    conta_origem: dados.conta_origem_id,
    conta_destino: dados.conta_destino_id,
    categoria: 'Investimentos',
    subcategoria: 'transferencia',
    status_classificacao: 'classificado',
    origem_dado: 'manual',
    observacao: obs,
    confianca: 'alta'
  };
  salvarLancamento(lancamento);

  // 2. Atualizar saldos das contas
  var novoSaldoOrigem = contaOrigem.saldo - valor;
  var novoSaldoDestino = contaDestino.saldo + valor;
  contasSheet.getRange(linhaOrigem, colContaSaldo + 1).setValue(novoSaldoOrigem);
  contasSheet.getRange(linhaDestino, colContaSaldo + 1).setValue(novoSaldoDestino);

  // 3. Registrar no histórico de saldos (resgate da origem)
  var saldoOrigem = {
    id: 'SH_' + new Date().getTime() + '_o',
    data: dataTransacao,
    conta_id: dados.conta_origem_id,
    conta_nome: contaOrigem.nome,
    instituicao: contaOrigem.instituicao,
    produto: contaOrigem.nome,
    tipo_movimento: 'Resgate',
    valor_movimento: valor,
    saldo_apos: novoSaldoOrigem,
    observacao: 'Transferência para ' + contaDestino.nome + (obs ? ' - ' + obs : '')
  };
  salvarGenerico('saldos_historico', saldoOrigem);

  // 4. Registrar no histórico de saldos (aporte no destino)
  var saldoDestino = {
    id: 'SH_' + (new Date().getTime() + 1) + '_d',
    data: dataTransacao,
    conta_id: dados.conta_destino_id,
    conta_nome: contaDestino.nome,
    instituicao: contaDestino.instituicao,
    produto: contaDestino.nome,
    tipo_movimento: 'Aporte',
    valor_movimento: valor,
    saldo_apos: novoSaldoDestino,
    observacao: 'Transferência de ' + contaOrigem.nome + (obs ? ' - ' + obs : '')
  };
  salvarGenerico('saldos_historico', saldoDestino);

  return {
    ok: true,
    msg: 'Transferência registrada: R$ ' + valor.toFixed(2) + ' de ' + contaOrigem.nome + ' para ' + contaDestino.nome,
    lancamento_id: id,
    saldo_origem: novoSaldoOrigem,
    saldo_destino: novoSaldoDestino
  };
}

function salvarGenerico(nomeAba, dados) {
  var sheet = obterOuCriarAba(nomeAba);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  if (dados.id) {
    const linhaIdx = encontrarLinha(sheet, 'id', dados.id);
    if (linhaIdx > 0) {
      const row = headers.map(h => dados[h] !== undefined ? dados[h] : '');
      sheet.getRange(linhaIdx, 1, 1, headers.length).setValues([row]);
      return { ok: true, msg: 'Atualizado', id: dados.id };
    }
  }

  if (!dados.id) {
    dados.id = nomeAba.charAt(0).toUpperCase() + new Date().getTime();
  }
  const row = headers.map(h => dados[h] !== undefined ? dados[h] : '');
  sheet.appendRow(row);
  return { ok: true, msg: 'Criado', id: dados.id };
}

function deletarLinha(nomeAba, id) {
  var sheet = obterOuCriarAba(nomeAba);
  var linhaIdx = encontrarLinha(sheet, 'id', id);

  if (linhaIdx > 0) {
    sheet.deleteRow(linhaIdx);
    return { ok: true, msg: 'Deletado' };
  }
  return { erro: 'Não encontrado' };
}

function atualizarSaldo(contaId, novoSaldo) {
  var sheet = obterOuCriarAba('contas');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const linhaIdx = encontrarLinha(sheet, 'id', contaId);

  if (linhaIdx > 0) {
    const colSaldo = headers.indexOf('saldo_atual') + 1;
    const colData = headers.indexOf('data_atualizacao') + 1;
    sheet.getRange(linhaIdx, colSaldo).setValue(novoSaldo);
    sheet.getRange(linhaIdx, colData).setValue(new Date());
    return { ok: true, msg: 'Saldo atualizado' };
  }
  return { erro: 'Conta não encontrada' };
}

function registrarImportacao(dados) {
  return salvarGenerico('importacoes_log', dados);
}

// ============================================================
// DASHBOARD AGREGADO
// ============================================================

function gerarDashboard(params) {
  const mesAtual = params.mes || Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM');

  const contas = lerAba('contas');
  const categorias = lerAba('categorias');
  const tetos = lerAba('tetos');
  const metas = lerAba('metas');
  const lancamentos = lerAba('lancamentos').filter(l => {
    const d = formatarDataParaStr(l.data_transacao);
    return d.startsWith(mesAtual);
  });

  // Mapear categorias do tipo transferencia para excluir dos totais de despesas
  const categoriasTransferencia = new Set(
    categorias.filter(c => c.tipo === 'transferencia').map(c => c.id)
  );

  // Calcular totais
  let totalReceitas = 0;
  let totalDespesas = 0;
  let totalTransferencias = 0;
  const gastosPorCategoria = {};

  lancamentos.forEach(l => {
    const valor = Number(l.valor) || 0;
    const ehReembolsavel = l.reembolsavel === 'sim' || l.reembolsavel === true;
    if (l.tipo === 'receita') {
      if (!ehReembolsavel) totalReceitas += valor;
    } else if (l.tipo === 'despesa') {
      // Verificar se a categoria é transferencia ou se é reembolsável
      if (categoriasTransferencia.has(l.categoria) || ehReembolsavel) {
        totalTransferencias += Math.abs(valor);
      } else {
        totalDespesas += Math.abs(valor);
        const cat = l.categoria || 'Sem Categoria';
        gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + Math.abs(valor);
      }
    }
  });

  // Saldos
  let saldoDisponivel = 0;
  let patrimonio = 0;
  contas.forEach(c => {
    const saldo = Number(c.saldo_atual) || 0;
    if (c.visao_caixa === 'sim') saldoDisponivel += saldo;
    if (c.patrimonio_total === 'sim') patrimonio += saldo;
  });

  // Status das categorias vs tetos
  const statusCategorias = tetos.map(t => {
    const gasto = gastosPorCategoria[t.categoria] || 0;
    const teto = Number(t.teto_mensal) || 0;
    const percentual = teto > 0 ? (gasto / teto) * 100 : 0;
    return {
      categoria: t.categoria,
      gasto: gasto,
      teto: teto,
      percentual: Math.round(percentual),
      status: percentual > 100 ? 'critico' : percentual > 90 ? 'vermelho' : percentual > 70 ? 'amarelo' : 'verde'
    };
  });

  // Semáforo geral
  const orcamentoTotal = tetos.reduce((s, t) => s + (Number(t.teto_mensal) || 0), 0);
  const comprom = orcamentoTotal > 0 ? (totalDespesas / orcamentoTotal) * 100 : 0;
  const semaforo = comprom > 100 ? 'critico' : comprom > 90 ? 'vermelho' : comprom > 70 ? 'amarelo' : 'verde';

  // Pendentes
  const pendentes = lancamentos.filter(l => l.status_classificacao === 'pendente_confirmacao').length;

  // Projeção simples
  const hoje = new Date();
  const diaAtual = hoje.getDate();
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const projecaoMes = diaAtual > 0 ? (totalDespesas / diaAtual) * diasNoMes : 0;

  return {
    mes: mesAtual,
    saldo_disponivel: saldoDisponivel,
    patrimonio: patrimonio,
    receitas: totalReceitas,
    despesas: totalDespesas,
    transferencias: totalTransferencias,
    sobra: totalReceitas - totalDespesas,
    comprometimento: Math.round(comprom),
    semaforo: semaforo,
    projecao_mes: Math.round(projecaoMes),
    gastos_por_categoria: gastosPorCategoria,
    status_categorias: statusCategorias,
    metas: metas,
    contas: contas,
    pendentes: pendentes,
    total_lancamentos: lancamentos.length
  };
}

// ============================================================
// HELPERS
// ============================================================

function encontrarLinha(sheet, coluna, valor) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colIdx = headers.indexOf(coluna);
  if (colIdx < 0) return -1;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colIdx]) === String(valor)) {
      return i + 1; // +1 porque sheets é 1-indexed
    }
  }
  return -1;
}

function formatarDataParaStr(data) {
  if (!data) return '';
  if (data instanceof Date) {
    return Utilities.formatDate(data, 'America/Sao_Paulo', 'yyyy-MM-dd');
  }
  return String(data);
}

function gerarId(prefixo) {
  return (prefixo || 'ID') + new Date().getTime();
}
