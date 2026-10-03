// Integração com a IA (DeepSeek, API compatível com OpenAI)
const store = require('./store');
const ops = require('./operacoes');
const E = require('../public/shared.js');

const URL_API = 'https://api.deepseek.com/chat/completions';

const hojeISO = store.hoje;

const ENV = typeof process !== 'undefined' && process.env ? process.env : {};

async function chamar(messages, { tools, json = false, esforco = 'high', maxTokens = 16000 } = {}) {
  const corpo = { model: ENV.DEEPSEEK_MODEL || 'deepseek-flash', messages, max_tokens: maxTokens, reasoning_effort: esforco };
  if (tools) corpo.tools = tools;
  if (json) corpo.response_format = { type: 'json_object' };
  let ultimoErro;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      let dados;
      if (store.chamarIA) {
        // Versão online: a chave fica guardada na função "ia" do Supabase
        dados = await store.chamarIA(corpo);
      } else {
        if (!ENV.DEEPSEEK_API_KEY) throw ops.erro('Chave da IA não configurada (DEEPSEEK_API_KEY no arquivo .env).', 500);
        const r = await fetch(URL_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ENV.DEEPSEEK_API_KEY}` },
          body: JSON.stringify(corpo),
          signal: AbortSignal.timeout(240000),
        });
        if (r.status === 429 || r.status >= 500) throw new Error(`IA respondeu ${r.status}`);
        dados = await r.json();
        if (!r.ok) throw ops.erro(`Erro da IA: ${(dados.error && dados.error.message) || r.status}`, 502);
      }
      if (dados && dados.erro) throw ops.erro(dados.erro, 502);
      if (!dados || !dados.choices) throw new Error('Resposta inválida da IA');
      return dados.choices[0].message;
    } catch (e) {
      if (e.status) throw e;
      ultimoErro = e;
      await new Promise(res => setTimeout(res, 1500 * (tentativa + 1)));
    }
  }
  throw ops.erro(`Não consegui falar com a IA: ${ultimoErro.message}`, 502);
}

function extrairJSON(texto) {
  const t = String(texto || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '');
  try {
    return JSON.parse(t);
  } catch {
    const i = t.indexOf('{');
    const f = t.lastIndexOf('}');
    if (i >= 0 && f > i) return JSON.parse(t.slice(i, f + 1));
    throw new Error('A IA não devolveu um JSON válido.');
  }
}

// ---------------- Contexto em texto para a IA ----------------

const DIAS_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function textoLimites(o, config) {
  const l = o.limites || {};
  const p = [];
  if (l.tarefas_mes != null) p.push(`máx ${l.tarefas_mes} tarefas/mês`);
  if (l.cultos_mes != null) p.push(`máx ${l.cultos_mes} cultos/mês`);
  for (const [k, v] of Object.entries(l.por_funcao || {})) p.push(`máx ${v}x ${(config.funcoes.find(f => f.id === k) || { nome: k }).nome}/mês`);
  return p.length ? p.join(', ') : 'sem limite';
}

function textoObreiros(obreiros, config, { soAtivos = false, uso = null } = {}) {
  return obreiros.filter(o => !soAtivos || o.status === 'ativo').map(o => {
    const partes = [
      `id: ${o.id}`, E.nomeCurto(o), `status: ${o.status}`,
      `funções: ${(o.funcoes || []).join(', ') || 'nenhuma'}`,
      `dias: ${o.dias && o.dias.length ? o.dias.map(d => DIAS_ABREV[d]).join(', ') : 'todos'}`,
      `limites: ${textoLimites(o, config)}`,
    ];
    if (o.parceiro_id) partes.push(`casal/dupla com: ${o.parceiro_id}`);
    if ((o.indisponibilidades || []).length) partes.push(`INDISPONÍVEL: ${o.indisponibilidades.map(i => `${i.inicio} a ${i.fim}${i.motivo ? ' (' + i.motivo + ')' : ''}`).join('; ')}`);
    if (o.regras) partes.push(`regras específicas: ${o.regras}`);
    if (uso) {
      const u = uso[o.id];
      partes.push(`uso no mês: ${u ? `${u.tarefas} tarefas em ${u.cultos} cultos (${Object.entries(u.por_funcao).map(([k, v]) => `${k} ${v}`).join(', ')})` : 'nenhum'}`);
    }
    return '- ' + partes.join(' | ');
  }).join('\n');
}

function textoEstrutura(config) {
  const funcoes = config.funcoes.map(f => `- ${f.id} (${f.nome}): padrão ${f.min ?? 1} a ${f.max ?? 1} pessoa(s)`).join('\n');
  const tipos = config.tipos_culto.filter(t => t.ativo !== false).map(t => {
    const p = [`- tipo "${t.id}": toda ${E.DIAS[t.dia_semana]}, nome "${t.nome}"`];
    for (const [n, nome] of Object.entries(t.nome_por_ocorrencia || {})) p.push(`  • ${n === 'ultimo' ? 'última' : n + 'ª'} ${E.DIAS[t.dia_semana].toLowerCase()} do mês se chama "${nome}"`);
    for (const [f, r] of Object.entries(t.funcoes || {})) p.push(`  • ${f}: ${r.min != null ? 'mín ' + r.min + ' ' : ''}${r.max != null ? 'máx ' + r.max : ''} pessoa(s) neste tipo`);
    for (const [f, m] of Object.entries(t.modelos || {})) p.push(`  • ${f} aparece na tabela como "${m}"`);
    return p.join('\n');
  }).join('\n');
  const regras = config.regras_gerais.filter(r => r.ativa !== false).map(r => `- [${r.id}] ${r.texto}`).join('\n') || '- (nenhuma)';
  return `## Funções em cada culto\n${funcoes}\n\n## Tipos de culto\n${tipos}\n- tipo "especial": culto extra adicionado manualmente\n\n## Regras gerais do pastor (siga sempre)\n${regras}`;
}

function textoEscala(escala, config) {
  return (escala.cultos || []).map(c => {
    const cel = config.funcoes.map(f => {
      const a = (c.atribuicoes || {})[f.id] || { pessoas: [] };
      return `${f.id}: ${(a.pessoas || []).join(', ') || '(vazio)'}${a.nota ? ` (nota: ${a.nota})` : ''}`;
    }).join(' | ');
    return `- [${c.id}] ${E.dataBR(c.data)} ${E.DIAS[E.diaSemana(c.data)]} – ${c.culto} | ${cel}${c.obs ? ` | obs: ${c.obs}` : ''}`;
  }).join('\n');
}

// ---------------- Geração da escala do mês ----------------

const FORMATO = `{
  "cultos": [
    {
      "id": "<id do culto, ex.: 2026-11-01-domingo>",
      "data": "AAAA-MM-DD",
      "tipo": "<quarta|sexta|domingo|especial>",
      "culto": "<nome do culto>",
      "<id da função>": ["<id do obreiro>", "..."],
      "notas": { "<id da função>": "<nota opcional, ex.: Palavra única>" },
      "obs": ""
    }
  ],
  "resumo": "<2 a 4 frases explicando as escolhas, citando as pessoas pelo nome com título (ex.: Pra. Evellyn), nunca pelo id>"
}`;

function normalizarGerada(json, base, config, obreiros, instrucoes) {
  const lista = Array.isArray(json.cultos) ? json.cultos : [];
  const porId = Object.fromEntries(base.map(c => [c.id, c]));
  const cultos = lista.map(item => {
    const b = porId[item.id] || base.find(x => x.data === item.data && x.tipo === item.tipo) || {};
    const data = item.data || b.data;
    const tipo = item.tipo || b.tipo || 'especial';
    const atribuicoes = {};
    for (const f of config.funcoes) {
      const bruto = item[f.id] ?? (item.atribuicoes && item.atribuicoes[f.id] && item.atribuicoes[f.id].pessoas) ?? [];
      const pessoas = (Array.isArray(bruto) ? bruto : [bruto]).filter(Boolean).map(p => ops.resolverPessoa(String(p), obreiros) || String(p));
      atribuicoes[f.id] = { pessoas };
      const nota = item.notas && item.notas[f.id];
      if (nota) atribuicoes[f.id].nota = String(nota);
    }
    return { id: item.id || b.id || `${data}-${tipo}`, data, tipo, culto: String(item.culto || b.culto || 'CULTO').toUpperCase(), atribuicoes, obs: item.obs || '' };
  }).filter(c => /^\d{4}-\d{2}-\d{2}$/.test(c.data || ''));
  for (const b of base) {
    if (cultos.some(c => c.id === b.id)) continue;
    if (b.especial) cultos.push(JSON.parse(JSON.stringify(b.especial)));
    else if (!instrucoes) cultos.push({ id: b.id, data: b.data, tipo: b.tipo, culto: b.culto, atribuicoes: Object.fromEntries(config.funcoes.map(f => [f.id, { pessoas: [] }])), obs: '' });
  }
  return cultos.sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
}

async function gerarEscala(mes, instrucoes = '', info = {}) {
  store.validarMes(mes);
  const config = store.config();
  const obreiros = store.obreiros();
  const anterior = store.escala(E.proximoMes(mes, -1));
  const atual = store.escala(mes);
  // Cultos especiais já cadastrados no mês continuam existindo ao gerar de novo
  const especiais = ((atual && atual.cultos) || []).filter(c => !config.tipos_culto.some(t => t.id === c.tipo));
  const base = E.cultosDoMes(mes, config).concat(especiais.map(c => ({ id: c.id, data: c.data, tipo: c.tipo, culto: c.culto, obs: c.obs || '', especial: c })))
    .sort((a, b) => a.data.localeCompare(b.data));

  const sistema = `Você monta a escala mensal de cultos da ${config.igreja}. Para cada culto você escolhe quem faz cada função.
Responda SEMPRE apenas com um objeto JSON válido, no formato pedido.

REGRAS OBRIGATÓRIAS (o sistema confere e recusa se quebrar):
1. Use apenas obreiros com status "ativo", sempre pelo id.
2. Uma pessoa só pode receber uma função que esteja nas "funções" dela.
3. Respeite os dias disponíveis e as indisponibilidades de cada obreiro.
4. Respeite os limites mensais. Cada função em cada culto conta como 1 tarefa (dirigir e fazer ofertas no mesmo culto = 2 tarefas). "cultos/mês" conta cultos distintos.
5. Respeite o mínimo e o máximo de pessoas por função de cada tipo de culto. Nenhuma função obrigatória pode ficar vazia.

REGRAS DE BOM SENSO (siga ao máximo):
- Siga as regras gerais do pastor e as regras específicas de cada obreiro.
- Imite o estilo das escalas anteriores (quem costuma fazer o quê), mas distribua bem as oportunidades: varie os pregadores e não sobrecarregue ninguém.
- Para funções feitas em casal/dupla, use o parceiro cadastrado.
- Antes de responder, conte quantas tarefas cada pessoa recebeu e confira os limites.`;

  const usuario = `${textoEstrutura(config)}

## Obreiros ativos
${textoObreiros(obreiros, config, { soAtivos: true })}

## Escala do mês anterior (${E.nomeMes(E.proximoMes(mes, -1))}) — referência de estilo e equilíbrio
${anterior ? textoEscala(anterior, config) : '(não há)'}

${atual ? `## Versão atual deste mês (será substituída)\n${textoEscala(atual, config)}\n\n` : ''}## Cultos de ${E.nomeMes(mes)} (preencha todos)
${base.map(c => `- id: ${c.id} | ${E.dataBR(c.data)} ${E.DIAS[E.diaSemana(c.data)]} | tipo: ${c.tipo} | nome: ${c.culto}${c.obs ? ` | obs: ${c.obs}` : ''}${c.especial ? ` | CULTO ESPECIAL já combinado — mantenha a equipe atual: ${config.funcoes.map(f => `${f.id}: ${((c.especial.atribuicoes || {})[f.id] || { pessoas: [] }).pessoas.join(', ') || '(vazio)'}`).join('; ')}` : ''}`).join('\n')}

## Instruções extras para este mês
${instrucoes ? instrucoes : '(nenhuma)'}
${instrucoes ? '(Se as instruções pedirem para adicionar, remover ou renomear cultos, faça isso na lista.)' : ''}

Devolva o JSON exatamente neste formato (uma chave por função: ${config.funcoes.map(f => f.id).join(', ')}):
${FORMATO}`;

  const msgs = [{ role: 'system', content: sistema }, { role: 'user', content: usuario }];
  let melhor = null;
  const tentativas = [];
  for (let rodada = 0; rodada < 4; rodada++) {
    const resp = await chamar(msgs, { json: true, esforco: 'high' });
    let json;
    try {
      json = extrairJSON(resp.content);
    } catch (e) {
      msgs.push({ role: 'assistant', content: resp.content || '' }, { role: 'user', content: 'Isso não é um JSON válido. Devolva apenas o objeto JSON completo no formato pedido.' });
      tentativas.push({ rodada, erros: ['JSON inválido'] });
      continue;
    }
    const cultos = normalizarGerada(json, base, config, obreiros, instrucoes);
    const v = E.validar({ mes, cultos }, obreiros, config);
    tentativas.push({ rodada, erros: v.erros.map(e => e.msg) });
    if (!melhor || v.erros.length < melhor.v.erros.length) melhor = { cultos, v, resumo: json.resumo || '' };
    if (v.ok) break;
    msgs.push({ role: 'assistant', content: resp.content });
    msgs.push({ role: 'user', content: `O sistema conferiu e encontrou estes problemas:\n${v.erros.map(e => '- ' + e.msg).join('\n')}\n\nUso atual por pessoa: ${Object.entries(v.uso).map(([id, u]) => `${id}=${u.tarefas} tarefas/${u.cultos} cultos`).join(', ')}.\nCorrija TODOS, mexendo só no necessário, e devolva o JSON completo no mesmo formato.` });
  }
  if (!melhor) throw ops.erro('A IA não conseguiu montar a escala. Tente de novo.', 502);
  const salvo = ops.salvarEscalaGerada(mes, melhor.cultos, Object.assign({ instrucoes }, info));
  return { mes, resumo: melhor.resumo, validacao: ops.resumoValidacao(salvo.validacao), rodadas: tentativas.length, tentativas };
}

// ---------------- Chat (agente com ferramentas) ----------------

function ferramentas(config) {
  const funcoes = config.funcoes.map(f => f.id);
  const tipos = config.tipos_culto.map(t => t.id).concat('especial');
  const mes = { type: 'string', description: 'Mês AAAA-MM. Se omitido, usa o mês aberto no app.' };
  const motivo = { type: 'string', description: 'Motivo curto da mudança (fica no histórico).' };
  return [
    { type: 'function', function: {
      name: 'alterar_escala',
      description: 'Altera quem faz uma ou mais funções em cultos da escala. Cada item substitui a lista inteira de pessoas daquela célula. Para trocar duas pessoas de lugar, mande as duas células. Recusa (sem aplicar nada) se a mudança criar violações de regras, a não ser que confirmar_violacao=true.',
      parameters: { type: 'object', properties: {
        mes,
        alteracoes: { type: 'array', items: { type: 'object', properties: {
          culto_id: { type: 'string', description: 'id do culto, ex.: 2026-10-16-sexta' },
          funcao: { type: 'string', enum: funcoes },
          pessoas: { type: 'array', items: { type: 'string' }, description: 'ids dos obreiros, na ordem (na pregação: 1°, 2°...)' },
          nota: { type: 'string', description: 'Opcional. Ex.: "Palavra única". String vazia remove a nota.' },
        }, required: ['culto_id', 'funcao', 'pessoas'] } },
        motivo,
        confirmar_violacao: { type: 'boolean', description: 'true SOMENTE depois que o usuário confirmou explicitamente que quer quebrar a regra.' },
      }, required: ['alteracoes', 'motivo'] } } },
    { type: 'function', function: {
      name: 'gerenciar_culto',
      description: 'Adiciona um culto extra/especial, remove um culto (ex.: cancelado) ou edita nome/data/observação de um culto.',
      parameters: { type: 'object', properties: {
        mes,
        acao: { type: 'string', enum: ['adicionar', 'remover', 'editar'] },
        culto_id: { type: 'string', description: 'Para remover/editar.' },
        data: { type: 'string', description: 'AAAA-MM-DD, para adicionar.' },
        tipo: { type: 'string', enum: tipos, description: 'Para adicionar.' },
        nome: { type: 'string', description: 'Nome do culto (adicionar/editar).' },
        nova_data: { type: 'string', description: 'Para editar a data (AAAA-MM-DD).' },
        obs: { type: 'string' },
        motivo,
      }, required: ['acao', 'motivo'] } } },
    { type: 'function', function: {
      name: 'gerar_escala',
      description: 'Gera (ou gera de novo) a escala INTEIRA de um mês com base nas regras. Demora cerca de 1 minuto. Se o mês já tiver escala, só use com substituir=true depois que o usuário confirmar (a versão anterior fica guardada).',
      parameters: { type: 'object', properties: {
        mes: { type: 'string', description: 'AAAA-MM' },
        instrucoes: { type: 'string', description: 'Pedidos especiais para este mês (eventos, ausências, preferências).' },
        substituir: { type: 'boolean' },
      }, required: ['mes'] } } },
    { type: 'function', function: {
      name: 'atualizar_obreiro',
      description: 'Muda o cadastro/regras PERMANENTES de um obreiro (vale para os próximos meses). Envie só os campos que mudam.',
      parameters: { type: 'object', properties: {
        id: { type: 'string' },
        campos: { type: 'object', properties: {
          titulo: { type: 'string', description: 'Pr., Pra., Aux., Dc., Dca., Ev., Pb., Miss. ou vazio' },
          nome: { type: 'string' }, nome_completo: { type: 'string' }, telefone: { type: 'string' }, endereco: { type: 'string' },
          email: { type: 'string' }, nascimento: { type: 'string', description: 'AAAA-MM-DD' }, cargo: { type: 'string' },
          status: { type: 'string', enum: ['ativo', 'inativo', 'a confirmar'] },
          funcoes: { type: 'array', items: { type: 'string', enum: funcoes }, description: 'Lista COMPLETA de funções que a pessoa pode fazer.' },
          dias: { type: 'array', items: { type: 'integer' }, description: 'Dias da semana disponíveis (0=domingo, 3=quarta, 5=sexta). Lista completa.' },
          limites: { type: 'object', properties: {
            tarefas_mes: { type: ['integer', 'null'] }, cultos_mes: { type: ['integer', 'null'] },
            por_funcao: { type: 'object', description: 'ex.: {"pregacao": 1}. null remove o limite da função.' },
          } },
          parceiro_id: { type: ['string', 'null'] },
          indisponibilidades: { type: 'array', description: 'Lista COMPLETA de períodos indisponíveis.', items: { type: 'object', properties: {
            inicio: { type: 'string' }, fim: { type: 'string' }, motivo: { type: 'string' } }, required: ['inicio'] } },
          regras: { type: 'string', description: 'Regras específicas em texto livre (texto completo).' },
          observacoes: { type: 'string' },
        } },
        motivo,
      }, required: ['id', 'campos', 'motivo'] } } },
    { type: 'function', function: {
      name: 'cadastrar_obreiro',
      description: 'Torna um membro obreiro (se a pessoa ainda não estiver no cadastro de membros, ela é cadastrada como membro também).',
      parameters: { type: 'object', properties: {
        nome: { type: 'string' }, titulo: { type: 'string' }, telefone: { type: 'string' },
        funcoes: { type: 'array', items: { type: 'string', enum: funcoes } },
        dias: { type: 'array', items: { type: 'integer' } },
        limites: { type: 'object', properties: { tarefas_mes: { type: ['integer', 'null'] }, cultos_mes: { type: ['integer', 'null'] }, por_funcao: { type: 'object' } } },
        regras: { type: 'string' }, motivo,
      }, required: ['nome', 'funcoes'] } } },
    { type: 'function', function: {
      name: 'regras_gerais',
      description: 'Adiciona, edita, remove, ativa ou desativa uma regra geral do pastor (vale para todas as escalas).',
      parameters: { type: 'object', properties: {
        acao: { type: 'string', enum: ['adicionar', 'editar', 'remover', 'ativar', 'desativar'] },
        id: { type: 'string', description: 'id da regra (ex.: r3), exceto para adicionar.' },
        texto: { type: 'string' }, motivo,
      }, required: ['acao'] } } },
    { type: 'function', function: {
      name: 'ver_escala',
      description: 'Mostra a escala, a validação e o uso por pessoa de outro mês.',
      parameters: { type: 'object', properties: { mes: { type: 'string' } }, required: ['mes'] } } },
    { type: 'function', function: {
      name: 'ver_historico',
      description: 'Lista as alterações registradas na escala de um mês e nas regras/cadastros.',
      parameters: { type: 'object', properties: { mes: { type: 'string' } } } } },
  ];
}

function resumoMes(mes, config, obreiros) {
  const escala = store.escala(mes);
  if (!escala) return { existe: false, texto: `(Ainda não existe escala para ${E.nomeMes(mes)}.)` };
  const v = E.validar(escala, obreiros, config, { aPartirDe: store.hoje() });
  return {
    existe: true,
    texto: `${textoEscala(escala, config)}\n\nValidação (cultos de hoje em diante): ${v.ok ? 'todas as regras do cadastro atendidas.' : 'PROBLEMAS:\n' + v.erros.map(e => '- ' + e.msg).join('\n')}${v.avisos.length ? '\nAvisos:\n' + v.avisos.map(e => '- ' + e.msg).join('\n') : ''}`,
    uso: v.uso,
  };
}

function textoHistorico(mes, limite = 30) {
  const escala = mes && store.escala(mes);
  const itens = [];
  for (const h of (escala && escala.historico) || []) {
    if (h.tipo === 'atribuicao') itens.push({ q: h.quando, t: `${E.dataBR(h.data)} ${h.culto} – ${h.funcao_nome}: "${h.antes.texto}" → "${h.depois.texto}"${h.motivo ? ` (motivo: ${h.motivo})` : ''}${h.desfeito_por ? ' [desfeita]' : ''}` });
    else itens.push({ q: h.quando, t: `${h.resumo}${h.motivo ? ` (motivo: ${h.motivo})` : ''}` });
  }
  for (const h of store.historicoRegras()) {
    const det = (h.mudancas || []).map(m => `${m.campo}: "${m.antes}" → "${m.depois}"`).join('; ');
    itens.push({ q: h.quando, t: `[regras] ${h.resumo}${det ? ': ' + det : ''}${h.depois && h.tipo === 'regra' ? `: "${h.depois}"` : ''}` });
  }
  itens.sort((a, b) => a.q.localeCompare(b.q));
  return itens.slice(-limite).map(i => `- ${new Date(i.q).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}: ${i.t}`).join('\n') || '(nenhuma alteração registrada)';
}

function textoEventos(hoje) {
  const lista = store.eventos().filter(e => (e.data_fim || e.data_inicio) >= hoje).slice(0, 25);
  return lista.map(e => `- ${E.dataBR(e.data_inicio)}${e.data_fim ? ' a ' + E.dataBR(e.data_fim) : ''}${e.hora_inicio ? ' ' + e.hora_inicio : ''} – ${e.titulo}${e.local ? ' (' + e.local + ')' : ''}${e.categoria ? ' [' + e.categoria + ']' : ''}${e.descricao ? ': ' + e.descricao : ''}`).join('\n') || '(nenhum evento cadastrado)';
}

async function executarFerramenta(nome, args, mesFoco, info) {
  const mes = args.mes || mesFoco;
  const motivo = args.motivo || '';
  const meta = Object.assign({}, info, { motivo });
  switch (nome) {
    case 'alterar_escala':
      return ops.alterarAtribuicoes(mes, args.alteracoes, meta, !!args.confirmar_violacao);
    case 'gerenciar_culto':
      return ops.gerenciarCulto(mes, args, meta);
    case 'gerar_escala': {
      if (store.escala(args.mes) && !args.substituir) {
        return { aplicado: false, mensagem: `Já existe escala para ${E.nomeMes(args.mes)}. Confirme com o usuário e chame de novo com substituir=true.` };
      }
      const r = await gerarEscala(args.mes, args.instrucoes || '', meta);
      return { aplicado: true, mes: r.mes, resumo: r.resumo, validacao: r.validacao, escala: resumoMes(args.mes, store.config(), store.obreiros()).texto };
    }
    case 'atualizar_obreiro': {
      const r = ops.atualizarObreiro(args.id, args.campos || {}, meta);
      return { aplicado: r.aplicado, mudancas: r.mudancas, mensagem: r.mensagem };
    }
    case 'cadastrar_obreiro': {
      const o = ops.criarObreiro(args, meta);
      return { aplicado: true, id: o.id, nome: E.nomeCurto(o) };
    }
    case 'regras_gerais':
      return ops.regraGeral(args, meta);
    case 'ver_escala':
      return resumoMes(store.validarMes(args.mes), store.config(), store.obreiros()).texto;
    case 'ver_historico':
      return textoHistorico(args.mes || mesFoco, 60);
    default:
      return { erro: `Ferramenta desconhecida: ${nome}` };
  }
}

const ALTERA = new Set(['alterar_escala', 'gerenciar_culto', 'gerar_escala', 'atualizar_obreiro', 'cadastrar_obreiro', 'regras_gerais']);

async function conversar(mesFoco, mensagem) {
  store.validarMes(mesFoco);
  const config = store.config();
  const obreiros = store.obreiros();
  const hoje = hojeISO();
  const atual = resumoMes(mesFoco, config, obreiros);

  const sistema = `Você é o assistente de escalas da ${config.igreja}. Você conversa com a liderança (pastores) pelo app de escalas.
Hoje é ${E.DIAS[E.diaSemana(hoje)].toLowerCase()}, ${E.dataBR(hoje)}. O mês aberto no app é ${E.nomeMes(mesFoco)} (${mesFoco}).

COMO AGIR
- Responda em português do Brasil, curto e direto, com markdown leve (negrito e listas). Nada de tabelas grandes.
- Para mudar qualquer coisa use as ferramentas. Nunca diga que mudou algo sem a ferramenta responder aplicado=true.
- Identifique o culto pelo culto_id (ex.: "dia 16" → o culto do dia 16 do mês aberto; "próxima sexta" → a partir de hoje).
- Antes de alterar, confira as regras (funções de cada um, dias, limites, indisponibilidades, regras gerais e específicas).
- Se a ferramenta recusar por violação de regra, explique em linguagem simples e ofereça alternativas que respeitem as regras. Só reenvie com confirmar_violacao=true depois que o usuário confirmar claramente que quer assim mesmo.
- Altere só o que foi pedido. Se perceber que outra célula deveria mudar junto (ex.: na sexta quem dirige costuma fazer ofertas e finalização), sugira e pergunte.
- Mudanças permanentes de alguém (limite, funções, dias, férias/viagem) → atualizar_obreiro. Regras que valem para todos → regras_gerais. Mudar regra NÃO altera a escala pronta: depois, confira se a escala do mês passou a quebrar a regra e ofereça ajustar.
- gerar_escala substitui o mês inteiro; se já existir escala, peça confirmação antes.
- Se um nome for ambíguo ou não existir no cadastro, pergunte. Não invente pessoas.
- Depois de alterar, confirme no formato: **dd/mm – Função:** antes → depois.
- Você também responde dúvidas: quem prega quando, quantas vezes alguém foi escalado, o que mudou (ver_historico), quais eventos estão no calendário etc. (O calendário é só leitura para você por enquanto.)

${textoEstrutura(config)}

## Obreiros (cadastro completo)
${textoObreiros(obreiros, config, { uso: atual.uso })}

## Escala de ${E.nomeMes(mesFoco)}
${atual.texto}

## Calendário da igreja (próximos eventos)
${textoEventos(hoje)}

## Últimas alterações registradas
${textoHistorico(mesFoco, 12)}`;

  const anteriores = store.chat(mesFoco).slice(-16).map(m => ({ role: m.papel === 'usuario' ? 'user' : 'assistant', content: m.texto }));
  const msgs = [{ role: 'system', content: sistema }, ...anteriores, { role: 'user', content: mensagem }];
  const tools = ferramentas(config);
  const acoes = [];
  const info = { origem: 'chat', pedido: mensagem };
  let resposta = '';

  for (let passo = 0; passo < 8; passo++) {
    const r = await chamar(msgs, { tools, esforco: 'high', maxTokens: 8000 });
    if (!r.tool_calls || !r.tool_calls.length) {
      resposta = r.content || '';
      break;
    }
    msgs.push({ role: 'assistant', content: r.content || '', reasoning_content: r.reasoning_content, tool_calls: r.tool_calls });
    for (const call of r.tool_calls) {
      let args = {};
      let saida;
      try {
        args = JSON.parse(call.function.arguments || '{}');
        saida = await executarFerramenta(call.function.name, args, mesFoco, info);
        if (store.persistir) await store.persistir();
      } catch (e) {
        saida = { erro: e.message };
      }
      acoes.push({ ferramenta: call.function.name, ok: !!(saida && saida.aplicado), args, resultado: saida });
      msgs.push({ role: 'tool', tool_call_id: call.id, content: typeof saida === 'string' ? saida : JSON.stringify(saida) });
    }
  }
  if (!resposta) resposta = 'Fiz o que consegui, mas precisei parar. Confira a escala e me diga se falta algo.';

  const quando = new Date().toISOString();
  const resumoAcoes = acoes.filter(a => ALTERA.has(a.ferramenta)).map(a => ({ ferramenta: a.ferramenta, ok: a.ok }));
  const hist = store.chat(mesFoco);
  hist.push({ papel: 'usuario', texto: mensagem, quando }, { papel: 'ia', texto: resposta, quando: new Date().toISOString(), acoes: resumoAcoes });
  store.salvarChat(mesFoco, hist.slice(-200));
  return { resposta, acoes, alterou: acoes.some(a => a.ok && ALTERA.has(a.ferramenta)) };
}

module.exports = { gerarEscala, conversar, hojeISO };
