// CaixaClara - Sistema de Gestão Financeira Familiar
// Express Backend Server

require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Importar serviços
const sheetsService = require('./services/sheets');
const classifierService = require('./services/classifier');
const projectionsService = require('./services/projections');
const importerService = require('./services/importer');
const authService = require('./services/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configurar multer para uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Middleware de erro centralizado
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ============================================================================
// ROTAS: AUTENTICAÇÃO (públicas - sem middleware)
// ============================================================================

/**
 * POST /api/auth/login
 * Recebe token do Google, valida, verifica whitelist, retorna JWT
 * Body: { google_token }
 */
app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { google_token } = req.body;

  if (!google_token) {
    return res.status(400).json({ erro: 'Token do Google não fornecido' });
  }

  // 1. Validar token com Google
  const usuario = await authService.validarGoogleToken(google_token);

  // 2. Verificar whitelist
  if (!authService.emailPermitido(usuario.email)) {
    console.warn(`Login negado para: ${usuario.email}`);
    return res.status(403).json({
      erro: 'Acesso não autorizado',
      mensagem: 'Este email não tem permissão para acessar o CaixaClara'
    });
  }

  // 3. Gerar JWT
  const token = authService.gerarJWT(usuario);

  console.log(`Login bem-sucedido: ${usuario.email}`);

  res.json({
    token,
    usuario: {
      email: usuario.email,
      nome: usuario.nome,
      foto: usuario.foto
    }
  });
}));

/**
 * GET /api/auth/me
 * Retorna dados do usuário logado (valida JWT)
 */
app.get('/api/auth/me', authService.authMiddleware, (req, res) => {
  res.json({ usuario: req.usuario });
});

/**
 * GET /api/auth/config
 * Retorna o Google Client ID para o frontend (público)
 */
app.get('/api/auth/config', (req, res) => {
  res.json({
    google_client_id: authService.GOOGLE_CLIENT_ID || null,
    auth_enabled: !!(authService.GOOGLE_CLIENT_ID),
    apps_script_url: process.env.APPS_SCRIPT_URL || null
  });
});

// ============================================================================
// MIDDLEWARE: Proteger todas as rotas /api/* abaixo deste ponto
// ============================================================================
app.use('/api', (req, res, next) => {
  // Rotas de auth já foram definidas acima, não passam por aqui
  // Permitir acesso sem auth se GOOGLE_CLIENT_ID não estiver configurado (dev mode)
  if (!authService.GOOGLE_CLIENT_ID) {
    return next();
  }
  return authService.authMiddleware(req, res, next);
});

// ============================================================================
// ROTAS: CONTAS (Accounts)
// ============================================================================

/**
 * GET /api/contas
 * Retorna todas as contas da família
 */
app.get('/api/contas', asyncHandler(async (req, res) => {
  const contas = await sheetsService.getContas();
  res.json(contas);
}));

/**
 * POST /api/contas
 * Cria nova conta
 * Body: { nome, tipo, saldo_inicial, moeda }
 */
app.post('/api/contas', asyncHandler(async (req, res) => {
  const { nome, tipo, saldo_inicial, moeda } = req.body;

  if (!nome || !tipo) {
    return res.status(400).json({ erro: 'Nome e tipo são obrigatórios' });
  }

  const novaConta = await sheetsService.createConta({
    nome,
    tipo,
    saldo_inicial: saldo_inicial || 0,
    moeda: moeda || 'BRL',
    data_criacao: new Date().toISOString()
  });

  res.status(201).json(novaConta);
}));

/**
 * PUT /api/contas/:id
 * Atualiza uma conta
 */
app.put('/api/contas/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const dados = req.body;

  const contaAtualizada = await sheetsService.updateConta(id, dados);
  res.json(contaAtualizada);
}));

/**
 * GET /api/saldos
 * Retorna saldo atual de todas as contas
 */
app.get('/api/saldos', asyncHandler(async (req, res) => {
  const saldos = await sheetsService.getSaldosPorConta();
  res.json(saldos);
}));

// ============================================================================
// ROTAS: LANÇAMENTOS (Transactions)
// ============================================================================

/**
 * GET /api/lancamentos
 * Retorna lançamentos com filtros opcionais
 * Query params: ?data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD&conta_id=X&categoria=Y
 */
app.get('/api/lancamentos', asyncHandler(async (req, res) => {
  const { data_inicio, data_fim, conta_id, categoria } = req.query;

  const filtros = {};
  if (data_inicio) filtros.data_inicio = data_inicio;
  if (data_fim) filtros.data_fim = data_fim;
  if (conta_id) filtros.conta_id = conta_id;
  if (categoria) filtros.categoria = categoria;

  const lancamentos = await sheetsService.getLancamentos(filtros);
  res.json(lancamentos);
}));

/**
 * POST /api/lancamentos
 * Cria novo lançamento
 * Body: { data, descricao, valor, tipo, conta_id, categoria, pessoa_responsavel }
 */
app.post('/api/lancamentos', asyncHandler(async (req, res) => {
  const { data, descricao, valor, tipo, conta_id, categoria, pessoa_responsavel } = req.body;

  if (!data || valor === undefined || !tipo || !conta_id) {
    return res.status(400).json({
      erro: 'Data, valor, tipo e conta_id são obrigatórios'
    });
  }

  if (!['receita', 'despesa'].includes(tipo)) {
    return res.status(400).json({ erro: 'Tipo deve ser "receita" ou "despesa"' });
  }

  const novoLancamento = await sheetsService.createLancamento({
    data,
    descricao: descricao || '',
    valor,
    tipo,
    conta_id,
    categoria: categoria || 'Sem categoria',
    pessoa_responsavel: pessoa_responsavel || '',
    data_criacao: new Date().toISOString()
  });

  res.status(201).json(novoLancamento);
}));

/**
 * PUT /api/lancamentos/:id
 * Atualiza lançamento existente
 */
app.put('/api/lancamentos/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const dados = req.body;

  const lancamentoAtualizado = await sheetsService.updateLancamento(id, dados);
  res.json(lancamentoAtualizado);
}));

/**
 * DELETE /api/lancamentos/:id
 * Deleta lançamento
 */
app.delete('/api/lancamentos/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  await sheetsService.deleteLancamento(id);
  res.json({ mensagem: 'Lançamento deletado com sucesso' });
}));

// ============================================================================
// ROTAS: CATEGORIAS (Categories)
// ============================================================================

/**
 * GET /api/categorias
 * Retorna todas as categorias
 */
app.get('/api/categorias', asyncHandler(async (req, res) => {
  const categorias = await sheetsService.getCategorias();
  res.json(categorias);
}));

/**
 * POST /api/categorias
 * Cria nova categoria
 * Body: { nome, tipo, cor_hexadecimal }
 */
app.post('/api/categorias', asyncHandler(async (req, res) => {
  const { nome, tipo, cor_hexadecimal } = req.body;

  if (!nome || !tipo) {
    return res.status(400).json({ erro: 'Nome e tipo são obrigatórios' });
  }

  const novaCategoria = await sheetsService.createCategoria({
    nome,
    tipo,
    cor_hexadecimal: cor_hexadecimal || '#808080'
  });

  res.status(201).json(novaCategoria);
}));

// ============================================================================
// ROTAS: TETOS (Budgets/Ceilings)
// ============================================================================

/**
 * GET /api/tetos
 * Retorna todos os tetos orçamentários
 */
app.get('/api/tetos', asyncHandler(async (req, res) => {
  const tetos = await sheetsService.getTetos();
  res.json(tetos);
}));

/**
 * POST /api/tetos
 * Cria novo teto orçamentário
 * Body: { categoria, mes, ano, limite, descricao }
 */
app.post('/api/tetos', asyncHandler(async (req, res) => {
  const { categoria, mes, ano, limite, descricao } = req.body;

  if (!categoria || !mes || !ano || limite === undefined) {
    return res.status(400).json({
      erro: 'Categoria, mês, ano e limite são obrigatórios'
    });
  }

  const novoTeto = await sheetsService.createTeto({
    categoria,
    mes,
    ano,
    limite,
    descricao: descricao || ''
  });

  res.status(201).json(novoTeto);
}));

// ============================================================================
// ROTAS: METAS (Goals)
// ============================================================================

/**
 * GET /api/metas
 * Retorna todas as metas
 */
app.get('/api/metas', asyncHandler(async (req, res) => {
  const metas = await sheetsService.getMetas();
  res.json(metas);
}));

/**
 * POST /api/metas
 * Cria nova meta
 * Body: { titulo, descricao, tipo, valor_meta, valor_atual, data_alvo, prioridade }
 */
app.post('/api/metas', asyncHandler(async (req, res) => {
  const { titulo, descricao, tipo, valor_meta, valor_atual, data_alvo, prioridade } = req.body;

  if (!titulo || !tipo || valor_meta === undefined) {
    return res.status(400).json({
      erro: 'Título, tipo e valor_meta são obrigatórios'
    });
  }

  const novaMeta = await sheetsService.createMeta({
    titulo,
    descricao: descricao || '',
    tipo,
    valor_meta,
    valor_atual: valor_atual || 0,
    data_alvo,
    prioridade: prioridade || 'média',
    data_criacao: new Date().toISOString()
  });

  res.status(201).json(novaMeta);
}));

// ============================================================================
// ROTAS: IMPORTAÇÃO (Import)
// ============================================================================

/**
 * POST /api/importar
 * Importa lançamentos de arquivo (CSV/Excel)
 * Multipart form-data com arquivo
 */
app.post('/api/importar', upload.single('arquivo'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ erro: 'Nenhum arquivo foi enviado' });
  }

  const caminhoArquivo = req.file.path;
  const nomeArquivo = req.file.originalname;

  try {
    // Processar importação
    const resultado = await importerService.importarLancamentos(caminhoArquivo, nomeArquivo);

    // Remover arquivo temporário
    fs.unlinkSync(caminhoArquivo);

    res.json({
      mensagem: 'Importação realizada com sucesso',
      lancamentos_importados: resultado.count,
      detalhes: resultado.detalhes
    });
  } catch (erro) {
    // Limpar arquivo em caso de erro
    if (fs.existsSync(caminhoArquivo)) {
      fs.unlinkSync(caminhoArquivo);
    }
    throw erro;
  }
}));

// ============================================================================
// ROTAS: DASHBOARD
// ============================================================================

/**
 * GET /api/dashboard
 * Retorna dados consolidados do dashboard
 * Inclui: receitas, despesas, saldos, categorias, tetos, metas
 */
app.get('/api/dashboard', asyncHandler(async (req, res) => {
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();

  // Buscar dados de todas as fontes
  const [contas, lancamentos, categorias, tetos, metas] = await Promise.all([
    sheetsService.getContas(),
    sheetsService.getLancamentos({
      mes: mesAtual,
      ano: anoAtual
    }),
    sheetsService.getCategorias(),
    sheetsService.getTetos(),
    sheetsService.getMetas()
  ]);

  // Mapear categorias do tipo transferencia para excluir dos totais de despesas
  const categoriasTransferencia = new Set(
    categorias.filter(c => c.tipo === 'transferencia').map(c => c.id)
  );

  // Calcular totais
  let totalReceitas = 0;
  let totalDespesas = 0;
  let totalTransferencias = 0;
  const despesasPorCategoria = {};

  lancamentos.forEach(l => {
    const ehReembolsavel = l.reembolsavel === 'sim' || l.reembolsavel === true;
    if (l.tipo === 'receita') {
      if (!ehReembolsavel) totalReceitas += l.valor;
    } else {
      // Verificar se a categoria é transferencia ou se é reembolsável
      if (categoriasTransferencia.has(l.categoria) || ehReembolsavel) {
        totalTransferencias += l.valor;
      } else {
        totalDespesas += l.valor;
        if (!despesasPorCategoria[l.categoria]) {
          despesasPorCategoria[l.categoria] = 0;
        }
        despesasPorCategoria[l.categoria] += l.valor;
      }
    }
  });

  // Calcular saldos por conta
  const saldosPorConta = await sheetsService.getSaldosPorConta();

  // Calcular status dos tetos
  const tetoStatus = tetos.map(teto => {
    const gasto = despesasPorCategoria[teto.categoria] || 0;
    const percentual = (gasto / teto.limite) * 100;
    return {
      ...teto,
      gasto,
      percentual,
      disponivel: Math.max(0, teto.limite - gasto)
    };
  });

  // Calcular progresso das metas
  const metasComProgresso = metas.map(meta => ({
    ...meta,
    percentual_progresso: (meta.valor_atual / meta.valor_meta) * 100
  }));

  res.json({
    periodo: { mes: mesAtual, ano: anoAtual },
    resumo: {
      total_receitas: totalReceitas,
      total_despesas: totalDespesas,
      saldo_liquido: totalReceitas - totalDespesas
    },
    saldos_por_conta: saldosPorConta,
    despesas_por_categoria: despesasPorCategoria,
    tetos: tetoStatus,
    metas: metasComProgresso,
    contas_total: contas.length,
    lancamentos_mes: lancamentos.length
  });
}));

// ============================================================================
// ROTAS: ALERTAS
// ============================================================================

/**
 * GET /api/alertas
 * Retorna alertas baseados em regras orçamentárias
 * Severidade: verde (ok), amarelo (atenção), vermelho (aviso), crítico (limite)
 */
app.get('/api/alertas', asyncHandler(async (req, res) => {
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();

  // Buscar dados
  const [lancamentos, categorias, tetos] = await Promise.all([
    sheetsService.getLancamentos({ mes: mesAtual, ano: anoAtual }),
    sheetsService.getCategorias(),
    sheetsService.getTetos()
  ]);

  // Mapear categorias do tipo transferencia
  const categoriasTransferencia = new Set(
    categorias.filter(c => c.tipo === 'transferencia').map(c => c.id)
  );

  // Agregar despesas por categoria (excluindo transferencias)
  const despesasPorCategoria = {};
  lancamentos.forEach(l => {
    const ehReembolsavel = l.reembolsavel === 'sim' || l.reembolsavel === true;
    if (l.tipo === 'despesa' && !categoriasTransferencia.has(l.categoria) && !ehReembolsavel) {
      if (!despesasPorCategoria[l.categoria]) {
        despesasPorCategoria[l.categoria] = 0;
      }
      despesasPorCategoria[l.categoria] += l.valor;
    }
  });

  // Gerar alertas
  const alertas = [];

  tetos.forEach(teto => {
    const gasto = despesasPorCategoria[teto.categoria] || 0;
    const percentual = (gasto / teto.limite) * 100;

    let severidade = 'verde';
    let mensagem = '';

    if (percentual >= 100) {
      severidade = 'critico';
      mensagem = `Limite de ${teto.categoria} excedido em R$ ${(gasto - teto.limite).toFixed(2)}`;
    } else if (percentual >= 90) {
      severidade = 'vermelho';
      mensagem = `${teto.categoria} em ${percentual.toFixed(0)}% do orçamento`;
    } else if (percentual >= 75) {
      severidade = 'amarelo';
      mensagem = `${teto.categoria} em ${percentual.toFixed(0)}% do orçamento`;
    }

    if (severidade !== 'verde') {
      alertas.push({
        categoria: teto.categoria,
        severidade,
        mensagem,
        limite: teto.limite,
        gasto,
        percentual: percentual.toFixed(2),
        data: new Date().toISOString()
      });
    }
  });

  // Alertas de contas com saldo baixo
  const contas = await sheetsService.getContas();
  const saldos = await sheetsService.getSaldosPorConta();

  saldos.forEach(saldo => {
    if (saldo.saldo < 100) { // Exemplo: alerta se saldo < R$ 100
      alertas.push({
        tipo: 'saldo_baixo',
        severidade: 'amarelo',
        mensagem: `Conta ${saldo.nome} com saldo baixo: R$ ${saldo.saldo.toFixed(2)}`,
        conta: saldo.nome,
        saldo: saldo.saldo,
        data: new Date().toISOString()
      });
    }
  });

  res.json({
    total_alertas: alertas.length,
    alertas: alertas.sort((a, b) => {
      const ordem = { critico: 0, vermelho: 1, amarelo: 2, verde: 3 };
      return ordem[a.severidade] - ordem[b.severidade];
    })
  });
}));

// ============================================================================
// ROTAS: CLASSIFICAÇÃO
// ============================================================================

/**
 * POST /api/classificar
 * Classifica ou reclassifica uma transação
 * Body: { lancamento_id, categoria_nova, regra_aplicada }
 */
app.post('/api/classificar', asyncHandler(async (req, res) => {
  const { lancamento_id, categoria_nova, regra_aplicada } = req.body;

  if (!lancamento_id || !categoria_nova) {
    return res.status(400).json({
      erro: 'lancamento_id e categoria_nova são obrigatórios'
    });
  }

  // Buscar lançamento
  const lancamento = await sheetsService.getLancamentoById(lancamento_id);
  if (!lancamento) {
    return res.status(404).json({ erro: 'Lançamento não encontrado' });
  }

  // Usar serviço de classificação
  const resultado = await classifierService.classificar(lancamento, categoria_nova, regra_aplicada);

  // Atualizar no sheets
  await sheetsService.updateLancamento(lancamento_id, {
    categoria: categoria_nova,
    regra_classificacao: regra_aplicada || ''
  });

  res.json({
    mensagem: 'Lançamento reclassificado com sucesso',
    lancamento_id,
    categoria_anterior: lancamento.categoria,
    categoria_nova,
    confianca: resultado.confianca || 0.8
  });
}));

// ============================================================================
// ROTAS: PROJEÇÕES
// ============================================================================

/**
 * GET /api/projecoes
 * Retorna projeções até o fim do mês
 * Baseado no ritmo atual de gastos
 */
app.get('/api/projecoes', asyncHandler(async (req, res) => {
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  const diaAtual = new Date().getDate();

  // Buscar lançamentos do mês
  const lancamentos = await sheetsService.getLancamentos({
    mes: mesAtual,
    ano: anoAtual
  });

  // Buscar categorias
  const categorias = await sheetsService.getCategorias();

  // Calcular projeções por categoria
  const projector = new projectionsService.Projector();
  const projecoes = projector.projetarFimMes(lancamentos, diaAtual);

  // Incluir tetos para comparação
  const tetos = await sheetsService.getTetos();

  const resultado = projecoes.map(proj => {
    const teto = tetos.find(t => t.categoria === proj.categoria);
    return {
      categoria: proj.categoria,
      gasto_ate_hoje: proj.gasto_atual,
      media_diaria: proj.media_diaria,
      projecao_fim_mes: proj.projecao_fim_mes,
      limite_orcamento: teto?.limite || null,
      sobra_prevista: teto ? (teto.limite - proj.projecao_fim_mes) : null,
      percentual_projetado: teto ? ((proj.projecao_fim_mes / teto.limite) * 100) : null
    };
  });

  res.json({
    mes: mesAtual,
    ano: anoAtual,
    dia_mes_atual: diaAtual,
    dias_restantes: 30 - diaAtual, // Aproximado
    projecoes: resultado
  });
}));

// ============================================================================
// ROTAS: RECONCILIAÇÃO
// ============================================================================

/**
 * POST /api/reconciliar
 * Reconcilia saldos das contas
 * Body: { conta_id, saldo_real, data }
 */
app.post('/api/reconciliar', asyncHandler(async (req, res) => {
  const { conta_id, saldo_real, data } = req.body;

  if (!conta_id || saldo_real === undefined) {
    return res.status(400).json({
      erro: 'conta_id e saldo_real são obrigatórios'
    });
  }

  // Buscar saldo da conta
  const saldoAtual = await sheetsService.getSaldoByConta(conta_id);

  const diferenca = saldo_real - saldoAtual;

  // Criar lançamento de ajuste se houver diferença
  if (Math.abs(diferenca) > 0.01) {
    await sheetsService.createLancamento({
      data: data || new Date().toISOString().split('T')[0],
      descricao: 'Ajuste de reconciliação',
      valor: Math.abs(diferenca),
      tipo: diferenca > 0 ? 'receita' : 'despesa',
      conta_id,
      categoria: 'Ajustes',
      pessoa_responsavel: 'Sistema'
    });
  }

  res.json({
    conta_id,
    saldo_anterior: saldoAtual,
    saldo_real,
    diferenca,
    ajuste_realizado: Math.abs(diferenca) > 0.01,
    mensagem: Math.abs(diferenca) > 0.01
      ? 'Reconciliação realizada com ajuste'
      : 'Saldos já estavam conciliados'
  });
}));

// ============================================================================
// TRATAMENTO DE ERROS
// ============================================================================

app.use((err, req, res, next) => {
  console.error('Erro:', err);

  // Erro de validação Multer
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      erro: 'Erro ao processar upload: ' + err.message
    });
  }

  // Erro genérico
  const statusCode = err.statusCode || 500;
  const mensagem = err.message || 'Erro interno do servidor';

  res.status(statusCode).json({
    erro: mensagem,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// ROTA: 404
// ============================================================================

app.use((req, res) => {
  res.status(404).json({
    erro: 'Rota não encontrada',
    path: req.path,
    metodo: req.method
  });
});

// ============================================================================
// INICIAR SERVIDOR
// ============================================================================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║         CaixaClara - Backend Server iniciado             ║
╠═══════════════════════════════════════════════════════════╣
║ Porta: ${PORT}
║ Ambiente: ${process.env.NODE_ENV || 'development'}
║ Arquivos estáticos: ./public
║ Uploads temporários: ./uploads
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
