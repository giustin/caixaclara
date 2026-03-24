const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');

// Configuração dos nomes das abas e seus cabeçalhos
const SHEET_CONFIGS = {
  contas: {
    displayName: 'Contas',
    headers: ['id', 'nome', 'instituicao', 'tipo', 'titular', 'moeda', 'status', 'saldo_inicial', 'data_saldo_inicial', 'saldo_atual', 'data_atualizacao', 'observacoes', 'liquidez_imediata', 'patrimonio_total', 'visao_caixa']
  },
  lancamentos: {
    displayName: 'Lançamentos',
    headers: ['id', 'data_transacao', 'data_competencia', 'descricao_original', 'descricao_padronizada', 'valor', 'tipo', 'conta_origem', 'conta_destino', 'cartao', 'categoria', 'subcategoria', 'status_classificacao', 'status_conciliacao', 'origem_dado', 'arquivo_origem', 'hash', 'observacao', 'recorrente', 'extraordinario', 'confianca']
  },
  categorias: {
    displayName: 'Categorias',
    headers: ['id', 'nome', 'grupo', 'icone', 'ativa', 'ordem']
  },
  regras_classificacao: {
    displayName: 'Regras de Classificação',
    headers: ['id', 'padrao_texto', 'categoria', 'subcategoria', 'banco', 'cartao', 'tipo_transacao', 'confianca', 'vezes_usada', 'criada_por']
  },
  tetos: {
    displayName: 'Tetos',
    headers: ['id', 'categoria', 'teto_mensal', 'teto_semanal', 'teto_anual', 'mes_referencia', 'alerta_percentual']
  },
  metas: {
    displayName: 'Metas',
    headers: ['id', 'nome', 'tipo', 'valor_alvo', 'valor_atual', 'data_inicio', 'data_limite', 'status', 'prioridade']
  },
  saldos_historico: {
    displayName: 'Saldos Histórico',
    headers: ['id', 'conta_id', 'data', 'saldo', 'origem_atualizacao', 'arquivo_origem']
  },
  importacoes_log: {
    displayName: 'Importações Log',
    headers: ['id', 'data_importacao', 'tipo_arquivo', 'nome_arquivo', 'conta_detectada', 'linhas_importadas', 'duplicidades_ignoradas', 'itens_pendentes', 'alteracoes_saldo', 'status']
  },
  config: {
    displayName: 'Config',
    headers: ['chave', 'valor', 'descricao']
  }
};

// Cache para cliente autenticado
let authClient = null;
let sheetsAPI = null;

/**
 * Gera um ID único curto (8 caracteres)
 * @returns {string} ID único
 */
function generateId() {
  return uuidv4().substring(0, 8);
}

/**
 * Obtém ou cria o cliente autenticado via service account
 * @returns {Object} Cliente autenticado
 */
async function getAuthClient() {
  if (authClient) {
    return authClient;
  }

  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!serviceAccountEmail || !privateKey) {
    throw new Error('Variáveis de ambiente GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_PRIVATE_KEY são obrigatórias');
  }

  authClient = new google.auth.GoogleAuth({
    credentials: {
      type: 'service_account',
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      private_key: privateKey,
      client_email: serviceAccountEmail,
      client_id: process.env.GOOGLE_CLIENT_ID,
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs'
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  sheetsAPI = google.sheets({ version: 'v4', auth: authClient });

  return authClient;
}

/**
 * Obtém a API de Sheets
 * @returns {Object} API de Sheets
 */
async function getSheetsAPI() {
  if (!sheetsAPI) {
    await getAuthClient();
  }
  return sheetsAPI;
}

/**
 * Obtém o ID da aba pela chave de configuração
 * @param {string} sheetName - Nome da aba (chave da configuração)
 * @returns {Promise<number>} ID da aba
 */
async function getSheetId(sheetName) {
  if (!SHEET_CONFIGS[sheetName]) {
    throw new Error(`Aba desconhecida: ${sheetName}`);
  }

  const sheets = await getSheetsAPI();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error('Variável de ambiente GOOGLE_SPREADSHEET_ID é obrigatória');
  }

  const response = await sheets.spreadsheets.get({
    spreadsheetId
  });

  const sheet = response.data.sheets.find(s => s.properties.title === SHEET_CONFIGS[sheetName].displayName);

  if (!sheet) {
    throw new Error(`Aba não encontrada: ${SHEET_CONFIGS[sheetName].displayName}`);
  }

  return sheet.properties.sheetId;
}

/**
 * Converte um array de valores em um objeto usando os cabeçalhos
 * @param {Array} row - Array de valores
 * @param {Array} headers - Array de nomes de colunas
 * @returns {Object} Objeto com dados nomeados
 */
function arrayToObject(row, headers) {
  if (!row || row.length === 0) {
    return {};
  }

  const obj = {};
  headers.forEach((header, index) => {
    obj[header] = row[index] || '';
  });
  return obj;
}

/**
 * Converte um objeto em um array usando a ordem dos cabeçalhos
 * @param {Object} obj - Objeto com dados nomeados
 * @param {Array} headers - Array de nomes de colunas
 * @returns {Array} Array de valores na ordem dos cabeçalhos
 */
function objectToArray(obj, headers) {
  return headers.map(header => obj[header] !== undefined ? obj[header] : '');
}

/**
 * Obtém todos os dados brutos de uma aba
 * @param {string} sheetName - Nome da aba
 * @returns {Promise<Array>} Array de linhas (arrays)
 */
async function getRawRows(sheetName) {
  const sheets = await getSheetsAPI();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const displayName = SHEET_CONFIGS[sheetName]?.displayName;

  if (!displayName) {
    throw new Error(`Aba desconhecida: ${sheetName}`);
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${displayName}!A:ZZ`
    });

    return response.data.values || [];
  } catch (error) {
    if (error.message.includes('not found')) {
      return [];
    }
    throw error;
  }
}

/**
 * Obtém os cabeçalhos de uma aba
 * @param {string} sheetName - Nome da aba
 * @returns {Promise<Array>} Array dos nomes das colunas
 */
async function getSheetHeaders(sheetName) {
  const rawRows = await getRawRows(sheetName);

  if (rawRows.length === 0) {
    return SHEET_CONFIGS[sheetName]?.headers || [];
  }

  return rawRows[0];
}

/**
 * Obtém todas as linhas de uma aba (exceto o cabeçalho)
 * @param {string} sheetName - Nome da aba
 * @returns {Promise<Array>} Array de objetos com dados das linhas
 */
async function getRows(sheetName) {
  const rawRows = await getRawRows(sheetName);

  if (rawRows.length <= 1) {
    return [];
  }

  const headers = rawRows[0];
  return rawRows.slice(1).map(row => arrayToObject(row, headers));
}

/**
 * Adiciona uma linha a uma aba
 * @param {string} sheetName - Nome da aba
 * @param {Object} rowData - Objeto com os dados da linha
 * @returns {Promise<Object>} Objeto adicionado com ID gerado
 */
async function addRow(sheetName, rowData) {
  const sheets = await getSheetsAPI();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const displayName = SHEET_CONFIGS[sheetName]?.displayName;
  const headers = SHEET_CONFIGS[sheetName]?.headers;

  if (!displayName || !headers) {
    throw new Error(`Aba desconhecida: ${sheetName}`);
  }

  // Gera ID se não fornecido
  if (!rowData.id) {
    rowData.id = generateId();
  }

  const rowArray = objectToArray(rowData, headers);
  const range = `${displayName}!A:${String.fromCharCode(65 + headers.length - 1)}`;

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [rowArray]
    }
  });

  return rowData;
}

/**
 * Adiciona múltiplas linhas a uma aba
 * @param {string} sheetName - Nome da aba
 * @param {Array} rows - Array de objetos com dados das linhas
 * @returns {Promise<Array>} Array de objetos adicionados
 */
async function appendRows(sheetName, rows) {
  const sheets = await getSheetsAPI();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const displayName = SHEET_CONFIGS[sheetName]?.displayName;
  const headers = SHEET_CONFIGS[sheetName]?.headers;

  if (!displayName || !headers) {
    throw new Error(`Aba desconhecida: ${sheetName}`);
  }

  // Gera IDs se não fornecidos
  const processedRows = rows.map(row => ({
    ...row,
    id: row.id || generateId()
  }));

  const rowArrays = processedRows.map(row => objectToArray(row, headers));
  const range = `${displayName}!A:${String.fromCharCode(65 + headers.length - 1)}`;

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: rowArrays
    }
  });

  return processedRows;
}

/**
 * Atualiza uma linha específica de uma aba
 * @param {string} sheetName - Nome da aba
 * @param {number} rowIndex - Índice da linha (0 = primeira linha de dados, após cabeçalho)
 * @param {Object} rowData - Objeto com os dados atualizados
 * @returns {Promise<Object>} Objeto atualizado
 */
async function updateRow(sheetName, rowIndex, rowData) {
  const sheets = await getSheetsAPI();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const displayName = SHEET_CONFIGS[sheetName]?.displayName;
  const headers = SHEET_CONFIGS[sheetName]?.headers;

  if (!displayName || !headers) {
    throw new Error(`Aba desconhecida: ${sheetName}`);
  }

  const rowArray = objectToArray(rowData, headers);
  const sheetRowIndex = rowIndex + 2; // +1 para pular cabeçalho, +1 para índice baseado em 1
  const range = `${displayName}!A${sheetRowIndex}:${String.fromCharCode(65 + headers.length - 1)}${sheetRowIndex}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [rowArray]
    }
  });

  return rowData;
}

/**
 * Deleta uma linha específica de uma aba
 * @param {string} sheetName - Nome da aba
 * @param {number} rowIndex - Índice da linha (0 = primeira linha de dados, após cabeçalho)
 * @returns {Promise<void>}
 */
async function deleteRow(sheetName, rowIndex) {
  const sheets = await getSheetsAPI();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const sheetId = await getSheetId(sheetName);

  const sheetRowIndex = rowIndex + 1; // +1 para pular cabeçalho

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: sheetRowIndex,
              endIndex: sheetRowIndex + 1
            }
          }
        }
      ]
    }
  });
}

/**
 * Encontra uma linha por valor em uma coluna específica
 * @param {string} sheetName - Nome da aba
 * @param {string} columnName - Nome da coluna para buscar
 * @param {*} value - Valor a procurar
 * @returns {Promise<Object|null>} Objeto encontrado ou null
 */
async function findRow(sheetName, columnName, value) {
  const rows = await getRows(sheetName);
  const row = rows.find(r => r[columnName]?.toString() === value?.toString());
  return row || null;
}

/**
 * Filtra linhas por múltiplas colunas
 * @param {string} sheetName - Nome da aba
 * @param {Object} filters - Objeto com colunas e valores a filtrar
 * @returns {Promise<Array>} Array de objetos que atendem aos critérios
 */
async function getRowsByFilter(sheetName, filters) {
  const rows = await getRows(sheetName);

  return rows.filter(row => {
    return Object.entries(filters).every(([columnName, filterValue]) => {
      return row[columnName]?.toString() === filterValue?.toString();
    });
  });
}

/**
 * Filtra linhas por intervalo de datas
 * @param {string} sheetName - Nome da aba
 * @param {string} dateColumn - Nome da coluna de data
 * @param {Date|string} startDate - Data inicial
 * @param {Date|string} endDate - Data final
 * @returns {Promise<Array>} Array de objetos dentro do intervalo de datas
 */
async function getRowsByDateRange(sheetName, dateColumn, startDate, endDate) {
  const rows = await getRows(sheetName);

  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

  return rows.filter(row => {
    if (!row[dateColumn]) {
      return false;
    }

    const rowDate = new Date(row[dateColumn]);
    return rowDate >= start && rowDate <= end;
  });
}

/**
 * Inicializa todas as abas com cabeçalhos se não existirem
 * @returns {Promise<void>}
 */
async function initializeSheets() {
  const sheets = await getSheetsAPI();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error('Variável de ambiente GOOGLE_SPREADSHEET_ID é obrigatória');
  }

  const response = await sheets.spreadsheets.get({
    spreadsheetId
  });

  const existingSheetNames = new Set(response.data.sheets.map(s => s.properties.title));
  const requests = [];

  // Para cada aba configurada, verifica se existe e cria se necessário
  for (const [configKey, config] of Object.entries(SHEET_CONFIGS)) {
    if (!existingSheetNames.has(config.displayName)) {
      // Cria a aba
      requests.push({
        addSheet: {
          properties: {
            title: config.displayName
          }
        }
      });
    }
  }

  // Executa as requisições de criação de abas
  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });
  }

  // Agora adiciona cabeçalhos às abas que não têm dados
  for (const [configKey, config] of Object.entries(SHEET_CONFIGS)) {
    const existingData = await getRawRows(configKey);

    if (existingData.length === 0) {
      // Aba está vazia, adiciona cabeçalhos
      const range = `${config.displayName}!A1:${String.fromCharCode(65 + config.headers.length - 1)}1`;

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [config.headers]
        }
      });
    }
  }
}

// Exporta as funções públicas
module.exports = {
  // CRUD básico
  getRows,
  addRow,
  updateRow,
  deleteRow,
  findRow,

  // Funções especializadas
  initializeSheets,
  getSheetHeaders,
  appendRows,
  getRowsByFilter,
  getRowsByDateRange,

  // Utilitários
  generateId,

  // Funções internas (para testes ou uso avançado)
  _getAuthClient: getAuthClient,
  _getSheetsAPI: getSheetsAPI,
  _getRawRows: getRawRows,
  _arrayToObject: arrayToObject,
  _objectToArray: objectToArray,
  _getSheetId: getSheetId,
  _SHEET_CONFIGS: SHEET_CONFIGS
};
