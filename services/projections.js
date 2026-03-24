// CaixaClara - Motor de Projeções e Alertas Financeiros
// Projeta gastos futuros e gera alertas baseado em limites e metas

/**
 * Utilitários para cálculos de data
 */
const UtilsData = {
  // Retorna número de dias no mês
  diasNoMes(data = new Date()) {
    const d = new Date(data);
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  },

  // Primeiro dia do mês
  inicioMes(data = new Date()) {
    const d = new Date(data);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  },

  // Último dia do mês
  fimMes(data = new Date()) {
    const d = new Date(data);
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  },

  // Primeiro dia da semana (segunda)
  inicioSemana(data = new Date()) {
    const d = new Date(data);
    const dia = d.getDay();
    const diff = d.getDate() - dia + (dia === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  },

  // Último dia da semana (domingo)
  fimSemana(data = new Date()) {
    const d = new Date(data);
    const dia = d.getDay();
    const diff = d.getDate() - dia + (dia === 0 ? 0 : 7);
    return new Date(d.setDate(diff));
  },

  // Diferença em dias
  diasEntre(dataInicio, dataFim) {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    const diffTime = Math.abs(fim - inicio);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  // Verifica se transação é do mês especificado
  ehDoMes(data, mes, ano) {
    const d = new Date(data);
    return d.getMonth() === mes && d.getFullYear() === ano;
  }
};

/**
 * Filtra transações por categoria
 */
function filtrarPorCategoria(lancamentos, categoria) {
  return lancamentos.filter(l =>
    l.classificacao?.categoria === categoria ||
    l.categoria === categoria
  );
}

/**
 * Calcula gasto total de uma categoria
 */
function gatoCategoria(lancamentos, categoria) {
  return filtrarPorCategoria(lancamentos, categoria)
    .filter(l => l.valor < 0) // Apenas despesas
    .reduce((sum, l) => sum + Math.abs(l.valor), 0);
}

/**
 * Calcula gasto total de transações
 */
function gastoTotal(lancamentos) {
  return lancamentos
    .filter(l => l.valor < 0)
    .reduce((sum, l) => sum + Math.abs(l.valor), 0);
}

/**
 * Filtra transações do mês/período especificado
 */
function lancamentosDoPeriodo(lancamentos, dataInicio, dataFim) {
  return lancamentos.filter(l => {
    const data = new Date(l.data);
    return data >= new Date(dataInicio) && data <= new Date(dataFim);
  });
}

/**
 * Projeta fechamento do mês com cenários
 *
 * @param {Array} lancamentos - Transações do mês
 * @param {Object} tetos - { [categoria]: limite_mensal }
 * @param {Object} metas - { [meta]: { valor_alvo, categoria, tipo } }
 * @param {Date} dataAtual - Data de referência (default: hoje)
 * @returns {Object} Projeção com cenários e análise por categoria
 */
function projetarFechamentoMes(lancamentos, tetos = {}, metas = {}, dataAtual = new Date()) {
  const mes = dataAtual.getMonth();
  const ano = dataAtual.getFullYear();

  // Filtrar transações do mês
  const lancamentosMes = lancamentos.filter(l => UtilsData.ehDoMes(l.data, mes, ano));
  const lancamentosAteMes = lancamentosMes.filter(l => new Date(l.data) <= dataAtual);

  // Calcular dias do mês e dias passados
  const diasTotal = UtilsData.diasNoMes(dataAtual);
  const diasPassados = dataAtual.getDate();
  const diasRestantes = diasTotal - diasPassados;

  // Gasto atual
  const gastoAtual = gastoTotal(lancamentosAteMes);

  // Ritmo diário
  const ritmoDiario = diasPassados > 0 ? gastoAtual / diasPassados : 0;
  const ritmoDiarioEsperado = tetos.total ? tetos.total / diasTotal : 0;

  // Projeções de cenários
  const projecaoConservadora = gastoAtual + (ritmoDiario * diasRestantes * 0.9);
  const projecaoBase = gastoAtual + (ritmoDiario * diasRestantes);
  const projecaoEstressada = gastoAtual + (ritmoDiario * diasRestantes * 1.15);

  // Análise por categoria
  const categorias = Object.keys(tetos).filter(c => c !== 'total');
  const porCategoria = categorias.map(categoria => {
    const gasto = gatoCategoria(lancamentosAteMes, categoria);
    const teto = tetos[categoria] || 0;
    const percentualDias = (diasPassados / diasTotal) * 100;

    // Projeção linear da categoria
    const ritmoCategoria = diasPassados > 0 ? gasto / diasPassados : 0;
    const projecaoCategoria = gasto + (ritmoCategoria * diasRestantes);

    // Desvio relativo ao teto
    const percentualTeto = teto > 0 ? (projecaoCategoria / teto) * 100 : 0;
    const desvio = projecaoCategoria - teto;

    // Status da categoria
    let status = 'ok';
    if (percentualTeto >= 100) status = 'critico';
    else if (percentualTeto >= 90) status = 'alerta';
    else if (percentualTeto >= 75) status = 'atencao';

    return {
      categoria,
      gasto: Math.round(gasto * 100) / 100,
      teto,
      projecao: Math.round(projecaoCategoria * 100) / 100,
      desvio: Math.round(desvio * 100) / 100,
      percentualTeto: Math.round(percentualTeto * 10) / 10,
      status,
      ritmo: Math.round(ritmoCategoria * 100) / 100,
      diasPassados,
      diasTotal
    };
  });

  // Ordenar por maior desvio
  porCategoria.sort((a, b) => b.desvio - a.desvio);

  return {
    gastoAtual: Math.round(gastoAtual * 100) / 100,
    projecaoMes: Math.round(projecaoBase * 100) / 100,
    diasPassados,
    diasTotal,
    diasRestantes,
    ritmoDiario: Math.round(ritmoDiario * 100) / 100,
    ritmoDiarioEsperado: Math.round(ritmoDiarioEsperado * 100) / 100,
    percentualMesPassado: Math.round((diasPassados / diasTotal) * 100),
    porCategoria,
    cenarios: {
      conservador: {
        valor: Math.round(projecaoConservadora * 100) / 100,
        desvio_teto: Math.round((projecaoConservadora - (tetos.total || 0)) * 100) / 100,
        descricao: 'Ritmo 90% do atual'
      },
      base: {
        valor: Math.round(projecaoBase * 100) / 100,
        desvio_teto: Math.round((projecaoBase - (tetos.total || 0)) * 100) / 100,
        descricao: 'Ritmo atual mantido'
      },
      estressado: {
        valor: Math.round(projecaoEstressada * 100) / 100,
        desvio_teto: Math.round((projecaoEstressada - (tetos.total || 0)) * 100) / 100,
        descricao: 'Ritmo 115% do atual'
      }
    }
  };
}

/**
 * Gera alertas baseado em transações e limites
 *
 * @param {Array} lancamentos - Transações
 * @param {Object} tetos - Limites por categoria
 * @param {Object} metas - Metas financeiras
 * @param {Object} contas - Saldos das contas { [conta]: saldo }
 * @param {Date} dataAtual - Data de referência
 * @returns {Array} Array de alertas ordenado por gravidade
 */
function gerarAlertas(lancamentos, tetos = {}, metas = {}, contas = {}, dataAtual = new Date()) {
  const alertas = [];

  // Projeção do mês
  const projecao = projetarFechamentoMes(lancamentos, tetos, metas, dataAtual);

  // Alerta 1: Categoria acima do teto
  for (const cat of projecao.porCategoria) {
    if (cat.projecao > cat.teto && cat.teto > 0) {
      const excesso = cat.projecao - cat.teto;
      let gravidade = 'amarelo';
      if (cat.percentualTeto > 100) gravidade = 'vermelho';
      if (cat.percentualTeto > 120) gravidade = 'critico';

      alertas.push({
        tipo: 'categoria_acima_teto',
        gravidade,
        categoria: cat.categoria,
        mensagem: `Categoria "${cat.categoria}" pode exceder o teto em R$ ${excesso.toFixed(2)}`,
        impacto: Math.round(excesso * 100) / 100,
        evidencia: `Gasto atual: R$ ${cat.gasto}, Projeção: R$ ${cat.projecao}, Teto: R$ ${cat.teto}`,
        acao_sugerida: `Reduzir gastos em ${cat.categoria} ou aumentar o teto`,
        percentualTeto: cat.percentualTeto
      });
    }
  }

  // Alerta 2: Orçamento total acima
  if (projecao.cenarios.base.valor > (tetos.total || Infinity)) {
    const excesso = projecao.cenarios.base.valor - tetos.total;
    let gravidade = 'amarelo';
    if (excesso > tetos.total * 0.2) gravidade = 'vermelho';
    if (excesso > tetos.total * 0.3) gravidade = 'critico';

    alertas.push({
      tipo: 'orcamento_total_acima',
      gravidade,
      categoria: 'geral',
      mensagem: `Orçamento total pode ser excedido em R$ ${excesso.toFixed(2)}`,
      impacto: excesso,
      evidencia: `Gasto atual: R$ ${projecao.gastoAtual}, Projeção: R$ ${projecao.cenarios.base.valor}, Orçamento: R$ ${tetos.total}`,
      acao_sugerida: 'Revisar despesas em todas as categorias',
      percentualOrcamento: Math.round((projecao.cenarios.base.valor / tetos.total) * 100)
    });
  }

  // Alerta 3: Saldo baixo
  for (const [contaNome, saldo] of Object.entries(contas)) {
    if (saldo < 0) {
      alertas.push({
        tipo: 'saldo_baixo',
        gravidade: 'critico',
        categoria: contaNome,
        mensagem: `Conta "${contaNome}" está com saldo NEGATIVO: R$ ${saldo.toFixed(2)}`,
        impacto: Math.abs(saldo),
        evidencia: `Saldo atual: R$ ${saldo.toFixed(2)}`,
        acao_sugerida: 'Transferir recursos para essa conta imediatamente',
        saldo
      });
    } else if (saldo < 500) {
      alertas.push({
        tipo: 'saldo_baixo',
        gravidade: 'vermelho',
        categoria: contaNome,
        mensagem: `Conta "${contaNome}" com saldo baixo: R$ ${saldo.toFixed(2)}`,
        impacto: 500 - saldo,
        evidencia: `Saldo atual: R$ ${saldo.toFixed(2)}`,
        acao_sugerida: 'Manter fundo de emergência mínimo de R$ 500',
        saldo
      });
    }
  }

  // Alerta 4: Meta em risco
  for (const [metaNome, meta] of Object.entries(metas)) {
    const categoriasMeta = Array.isArray(meta.categoria) ? meta.categoria : [meta.categoria];
    const totalMeta = categoriasMeta.reduce((sum, cat) => {
      const catProj = projecao.porCategoria.find(c => c.categoria === cat);
      return sum + (catProj ? catProj.gasto : 0);
    }, 0);

    if (meta.tipo === 'poupanca') {
      const poupado = meta.valor_alvo - totalMeta;
      if (poupado < 0) {
        alertas.push({
          tipo: 'meta_em_risco',
          gravidade: 'vermelho',
          categoria: metaNome,
          mensagem: `Meta "${metaNome}" em risco: faltam R$ ${Math.abs(poupado).toFixed(2)}`,
          impacto: Math.abs(poupado),
          evidencia: `Meta: R$ ${meta.valor_alvo}, Trajetória atual: R$ ${totalMeta}`,
          acao_sugerida: `Aumentar poupança em ${metaNome}`,
          desvio: poupado
        });
      } else if (poupado < meta.valor_alvo * 0.2) {
        alertas.push({
          tipo: 'meta_em_risco',
          gravidade: 'amarelo',
          categoria: metaNome,
          mensagem: `Meta "${metaNome}" pode não ser atingida`,
          impacto: meta.valor_alvo - totalMeta,
          evidencia: `Meta: R$ ${meta.valor_alvo}, Trajetória: R$ ${totalMeta}`,
          acao_sugerida: `Aumentar contribuição para ${metaNome}`,
          desvio: totalMeta - meta.valor_alvo
        });
      }
    }
  }

  // Alerta 5: Ritmo acelerado
  const ritmoPercentual = (projecao.ritmoDiario / (projecao.ritmoDiarioEsperado || 1)) * 100;
  if (projecao.ritmoDiario > projecao.ritmoDiarioEsperado * 1.1) {
    alertas.push({
      tipo: 'ritmo_acelerado',
      gravidade: ritmoPercentual > 150 ? 'vermelho' : 'amarelo',
      categoria: 'geral',
      mensagem: `Ritmo de gastos está ${ritmoPercentual.toFixed(0)}% acima do esperado`,
      impacto: (projecao.ritmoDiario - projecao.ritmoDiarioEsperado) * projecao.diasRestantes,
      evidencia: `Ritmo atual: R$ ${projecao.ritmoDiario.toFixed(2)}/dia, Esperado: R$ ${projecao.ritmoDiarioEsperado.toFixed(2)}/dia`,
      acao_sugerida: 'Reduzir gastos diários para voltar ao ritmo esperado',
      percentualRitmo: ritmoPercentual
    });
  }

  // Alerta 6: Muitos pendentes
  const pendentes = lancamentos.filter(l =>
    l.classificacao?.categoria === 'pendente_confirmacao' ||
    l.categoria === 'pendente_confirmacao'
  );

  if (pendentes.length > 10) {
    alertas.push({
      tipo: 'muitos_pendentes',
      gravidade: 'amarelo',
      categoria: 'classificacao',
      mensagem: `${pendentes.length} transações aguardando classificação`,
      impacto: pendentes.length,
      evidencia: `Há ${pendentes.length} transações sem categoria definida`,
      acao_sugerida: 'Classificar transações pendentes para melhorar análise',
      quantidade: pendentes.length
    });
  } else if (pendentes.length > 20) {
    alertas.push({
      tipo: 'muitos_pendentes',
      gravidade: 'vermelho',
      categoria: 'classificacao',
      mensagem: `${pendentes.length} transações aguardando classificação (crítico)`,
      impacto: pendentes.length,
      evidencia: `Há ${pendentes.length} transações sem categoria definida`,
      acao_sugerida: 'URGENTE: Classificar todas as transações pendentes',
      quantidade: pendentes.length
    });
  }

  // Ordenar por gravidade: critico > vermelho > amarelo > verde
  const ordemGravidade = { critico: 0, vermelho: 1, amarelo: 2, verde: 3 };
  alertas.sort((a, b) => ordemGravidade[a.gravidade] - ordemGravidade[b.gravidade]);

  return alertas;
}

/**
 * Gera resumo semanal
 *
 * @param {Array} lancamentos - Transações
 * @param {Object} tetos - Limites semanais/mensais
 * @param {Date} semana - Data dentro da semana (default: hoje)
 * @returns {Object} Resumo semanal
 */
function resumoSemanal(lancamentos, tetos = {}, semana = new Date()) {
  const inicio = UtilsData.inicioSemana(semana);
  const fim = UtilsData.fimSemana(semana);

  const lancamentosSemana = lancamentosDoPeriodo(lancamentos, inicio, fim);
  const totalGasto = gastoTotal(lancamentosSemana);

  // Por categoria
  const categorias = Object.keys(tetos).filter(c => c !== 'total');
  const porCategoria = categorias.map(cat => ({
    categoria: cat,
    gasto: Math.round(gatoCategoria(lancamentosSemana, cat) * 100) / 100,
    teto_semanal: Math.round((tetos[cat] / 4) * 100) / 100 // Aproximadamente 4 semanas
  }));

  // Top desvios
  const desvios = porCategoria
    .map(c => ({ ...c, desvio: c.gasto - c.teto_semanal }))
    .sort((a, b) => b.desvio - a.desvio)
    .slice(0, 3);

  return {
    periodo: {
      inicio: inicio.toISOString().split('T')[0],
      fim: fim.toISOString().split('T')[0]
    },
    totalGasto: Math.round(totalGasto * 100) / 100,
    porCategoria: porCategoria.sort((a, b) => b.gasto - a.gasto),
    topDesvios: desvios,
    transacoes: lancamentosSemana.length
  };
}

/**
 * Gera resumo mensal
 *
 * @param {Array} lancamentos - Transações
 * @param {Object} tetos - Limites mensais
 * @param {Object} metas - Metas do mês
 * @param {Date|number} mes - Mês (0-11) ou data dentro do mês
 * @returns {Object} Resumo mensal
 */
function resumoMensal(lancamentos, tetos = {}, metas = {}, mes = new Date()) {
  const dataRef = typeof mes === 'number'
    ? new Date(new Date().getFullYear(), mes, 1)
    : new Date(mes);

  const mesNum = dataRef.getMonth();
  const anoNum = dataRef.getFullYear();

  const lancamentosMes = lancamentos.filter(l => UtilsData.ehDoMes(l.data, mesNum, anoNum));
  const totalGasto = gastoTotal(lancamentosMes);

  // Por categoria
  const categorias = Object.keys(tetos).filter(c => c !== 'total');
  const porCategoria = categorias.map(cat => {
    const gasto = gatoCategoria(lancamentosMes, cat);
    const teto = tetos[cat] || 0;
    return {
      categoria: cat,
      gasto: Math.round(gasto * 100) / 100,
      teto,
      percentual: teto > 0 ? Math.round((gasto / teto) * 100) : 0
    };
  });

  const nomeMes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  return {
    mes: nomeMes[mesNum],
    ano: anoNum,
    totalGasto: Math.round(totalGasto * 100) / 100,
    orcamentoTotal: tetos.total || 0,
    percentualOrcamento: tetos.total ? Math.round((totalGasto / tetos.total) * 100) : 0,
    porCategoria: porCategoria.sort((a, b) => b.gasto - a.gasto),
    transacoes: lancamentosMes.length,
    metas: Object.keys(metas).length > 0 ? Object.keys(metas) : []
  };
}

/**
 * Calcula indicadores financeiros gerais
 *
 * @param {Array} lancamentos - Todas as transações
 * @param {Object} contas - { [contaNome]: saldo }
 * @param {Object} metas - Metas financeiras
 * @returns {Object} Indicadores e semáforo
 */
function calcularIndicadores(lancamentos, contas = {}, metas = {}) {
  // Patrimônio total
  const patrimonioTotal = Object.values(contas).reduce((sum, saldo) => sum + saldo, 0);

  // Liquidez imediata
  const liquidezImediata = Object.values(contas)
    .filter(saldo => saldo > 0)
    .reduce((sum, saldo) => sum + saldo, 0);

  // Mês atual
  const agora = new Date();
  const mesAtual = agora.getMonth();
  const anoAtual = agora.getFullYear();
  const lancamentosAtual = lancamentos.filter(l => UtilsData.ehDoMes(l.data, mesAtual, anoAtual));

  // Gastos do mês
  const gastoMesAtual = gastoTotal(lancamentosAtual);

  // Estimativa de orçamento mensal (média dos 3 últimos meses ou padrão de 5000)
  const orcamentoEstimado = 5000;

  // Comprometimento do orçamento
  const comprometimentoOrcamento = (gastoMesAtual / orcamentoEstimado) * 100;

  // Taxa de poupança (receitas - despesas) / receitas
  const receitas = lancamentos
    .filter(l => l.valor > 0)
    .reduce((sum, l) => sum + l.valor, 0);

  const despesas = gastoTotal(lancamentos);
  const taxaPoupanca = receitas > 0 ? ((receitas - despesas) / receitas) * 100 : 0;

  // Semáforo geral
  let semaforoGeral = 'verde';

  // Critérios vermelho/crítico
  if (patrimonioTotal <= 0) {
    semaforoGeral = 'critico';
  } else if (comprometimentoOrcamento > 100) {
    semaforoGeral = 'critico';
  }
  // Critérios vermelho
  else if (comprometimentoOrcamento > 90) {
    semaforoGeral = 'vermelho';
  } else if (liquidezImediata < 500) {
    semaforoGeral = 'vermelho';
  }
  // Critérios amarelo
  else if (comprometimentoOrcamento > 75) {
    semaforoGeral = 'amarelo';
  } else if (taxaPoupanca < 5) {
    semaforoGeral = 'amarelo';
  }

  return {
    patrimonio_total: Math.round(patrimonioTotal * 100) / 100,
    liquidez_imediata: Math.round(liquidezImediata * 100) / 100,
    comprometimento_orcamento: Math.round(comprometimentoOrcamento * 10) / 10,
    taxa_poupanca: Math.round(taxaPoupanca * 10) / 10,
    receita_mes_atual: Math.round(receitas * 100) / 100,
    despesa_mes_atual: Math.round(despesas * 100) / 100,
    semaforo_geral: semaforoGeral,
    saude_financeira: {
      patrimonio: semaforoGeral === 'critico' ? 'em_risco' : 'saudavel',
      liquidez: liquidezImediata < 1000 ? 'baixa' : 'adequada',
      gastos: comprometimentoOrcamento > 85 ? 'altos' : 'controlados'
    }
  };
}

module.exports = {
  projetarFechamentoMes,
  gerarAlertas,
  resumoSemanal,
  resumoMensal,
  calcularIndicadores,
  // Exportar utilitários
  UtilsData,
  filtrarPorCategoria,
  gatoCategoria,
  gastoTotal,
  lancamentosDoPeriodo
};
