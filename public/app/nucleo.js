/* Gerado por scripts/montar.js — não edite à mão (edite lib/ e rode o script). */
(function () {
  const definicoes = {};
  const prontos = {};
  function requerer(nome) {
    if (nome === '../public/shared.js') return window.Escala;
    if (prontos[nome]) return prontos[nome].exports;
    const m = (prontos[nome] = { exports: {} });
    definicoes[nome](m, m.exports, requerer);
    return m.exports;
  }
  definicoes["./store"] = function (module, exports, require) {
// Armazenamento no Supabase (usado no navegador, na versão online).
// Mantém a mesma interface do store.js (ler/salvar síncronos sobre um cache em memória);
// persistir() grava no banco só o que mudou.
const CAMPOS_OBREIRO = ['id', 'membro_id', 'status', 'funcoes', 'dias', 'limites', 'parceiro_id', 'indisponibilidades',
  'regras', 'observacoes', 'criado_em', 'atualizado_em'];
const CAMPOS_DO_MEMBRO = ['nome', 'titulo', 'nome_completo', 'telefone', 'whatsapp_nome', 'email', 'endereco', 'nascimento', 'cargo', 'sexo'];

// Tabelas "uma linha por item"
const TABELAS = {
  'membros.json': {
    tabela: 'membros',
    colunas: ['id', 'nome', 'nome_completo', 'titulo', 'cargo', 'sexo', 'nascimento', 'estado_civil', 'conjuge_id', 'telefone', 'whatsapp_nome',
      'email', 'endereco', 'bairro', 'cidade', 'cep', 'batismo', 'membro_desde', 'status', 'observacoes', 'criado_em', 'atualizado_em'],
    datas: ['nascimento', 'batismo', 'membro_desde'], nulos: ['conjuge_id'],
  },
  'obreiros.json': { tabela: 'obreiros', colunas: CAMPOS_OBREIRO, datas: [], nulos: ['parceiro_id'] },
  'contatos.json': { tabela: 'contatos', colunas: ['id', 'whatsapp_nome', 'telefone', 'obs'], datas: [], nulos: [] },
  'eventos.json': {
    tabela: 'eventos',
    colunas: ['id', 'titulo', 'data_inicio', 'data_fim', 'hora_inicio', 'hora_fim', 'local', 'categoria', 'publico', 'destaque', 'descricao', 'criado_em', 'atualizado_em'],
    datas: ['data_fim'], nulos: [],
  },
};

let sb = null;
let chamarFuncaoIA = null;
const cache = {};
const sincronizado = {};
const pendentes = new Set();

const clone = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
const erro = (msg, status = 400) => Object.assign(new Error(msg), { status });

function paraObjeto(def, linha) {
  const o = {};
  for (const c of def.colunas) {
    let v = linha[c];
    if (v === null || v === undefined) v = def.nulos.includes(c) ? null : (['criado_em', 'atualizado_em'].includes(c) ? undefined : '');
    if (v !== undefined) o[c] = v;
  }
  return o;
}

function paraLinha(def, obj) {
  const l = {};
  for (const c of def.colunas) {
    if (obj[c] === undefined) continue;
    let v = obj[c];
    if (def.datas.includes(c) && !v) v = null;
    if (def.nulos.includes(c) && !v) v = null;
    l[c] = v;
  }
  return l;
}

async function consulta(promessa) {
  const { data, error } = await promessa;
  if (error) throw erro('Erro no banco de dados: ' + error.message, 500);
  return data;
}

/** Carrega todo o conteúdo do banco para a memória. */
async function carregar() {
  const [config, site, escalas, chats, historico, ...listas] = await Promise.all([
    consulta(sb.from('config').select('dados').eq('id', 1).maybeSingle()),
    consulta(sb.from('site').select('dados').eq('id', 1).maybeSingle()),
    consulta(sb.from('escalas').select('mes,dados')),
    consulta(sb.from('chats').select('mes,mensagens')),
    consulta(sb.from('historico').select('dados').order('quando')),
    ...Object.values(TABELAS).map(d => consulta(sb.from(d.tabela).select('*'))),
  ]);
  for (const k of Object.keys(cache)) delete cache[k];
  cache['config.json'] = config ? config.dados : null;
  cache['site.json'] = site ? site.dados : {};
  for (const e of escalas) cache[`escalas/${e.mes}.json`] = e.dados;
  for (const c of chats) cache[`chat/${c.mes}.json`] = c.mensagens;
  cache['historico_regras.json'] = historico.map(h => h.dados);
  Object.entries(TABELAS).forEach(([rel, def], i) => { cache[rel] = listas[i].map(l => paraObjeto(def, l)); });
  for (const k of Object.keys(sincronizado)) delete sincronizado[k];
  for (const [k, v] of Object.entries(cache)) sincronizado[k] = JSON.stringify(v);
  pendentes.clear();
}

/** Grava no banco tudo o que mudou desde a última sincronização. */
async function persistir() {
  for (const rel of [...pendentes]) {
    const atual = cache[rel];
    const antes = sincronizado[rel] ? JSON.parse(sincronizado[rel]) : null;
    const def = TABELAS[rel];
    if (def) {
      const antigos = Object.fromEntries((antes || []).map(o => [o.id, JSON.stringify(o)]));
      const mudados = atual.filter(o => antigos[o.id] !== JSON.stringify(o)).map(o => paraLinha(def, o));
      const ids = new Set(atual.map(o => o.id));
      const removidos = Object.keys(antigos).filter(id => !ids.has(id));
      if (mudados.length) await consulta(sb.from(def.tabela).upsert(mudados));
      if (removidos.length) await consulta(sb.from(def.tabela).delete().in('id', removidos));
    } else if (rel === 'config.json' || rel === 'site.json') {
      await consulta(sb.from(rel.replace('.json', '')).upsert({ id: 1, dados: atual, atualizado_em: new Date().toISOString() }));
    } else if (rel.startsWith('escalas/')) {
      await consulta(sb.from('escalas').upsert({ mes: rel.slice(8, 15), dados: atual, atualizado_em: new Date().toISOString() }));
    } else if (rel.startsWith('chat/')) {
      await consulta(sb.from('chats').upsert({ mes: rel.slice(5, 12), mensagens: atual, atualizado_em: new Date().toISOString() }));
    } else if (rel === 'historico_regras.json') {
      const vistos = new Set((antes || []).map(h => h.id));
      const novos = atual.filter(h => !vistos.has(h.id)).map(h => ({ id: h.id, quando: h.quando, dados: h }));
      if (novos.length) await consulta(sb.from('historico').upsert(novos));
    }
    sincronizado[rel] = JSON.stringify(atual);
    pendentes.delete(rel);
  }
}

function ler(rel, padrao) {
  return rel in cache && cache[rel] !== null ? clone(cache[rel]) : padrao;
}

function salvar(rel, obj) {
  cache[rel] = clone(obj);
  pendentes.add(rel);
}

const validarMes = mes => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes || '')) throw erro('Mês inválido: ' + mes);
  return mes;
};

function hoje() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

const membros = () => ler('membros.json', []);

function obreiros() {
  const porId = Object.fromEntries(membros().map(m => [m.id, m]));
  return ler('obreiros.json', []).map(o => {
    const m = porId[o.membro_id] || { nome: o.id, titulo: '', status: 'inativo' };
    const junto = Object.assign({}, o);
    for (const c of CAMPOS_DO_MEMBRO) junto[c] = m[c] ?? '';
    junto.membro_status = m.status;
    if (m.status && m.status !== 'ativo' && junto.status === 'ativo') junto.status = 'inativo';
    return junto;
  });
}

function salvarObreiros(lista) {
  const statusSalvo = Object.fromEntries(ler('obreiros.json', []).map(o => [o.id, o.status]));
  salvar('obreiros.json', lista.map(o => {
    const limpo = {};
    for (const c of CAMPOS_OBREIRO) if (o[c] !== undefined) limpo[c] = o[c];
    if (o.membro_status && o.membro_status !== 'ativo' && o.status === 'inativo' && statusSalvo[o.id]) limpo.status = statusSalvo[o.id];
    return limpo;
  }));
}

module.exports = {
  iniciar(cliente, opcoes = {}) { sb = cliente; chamarFuncaoIA = opcoes.chamarIA || null; },
  carregar,
  persistir,
  temPendencias: () => pendentes.size > 0,
  chamarIA: corpo => chamarFuncaoIA(corpo),
  hoje,
  ler,
  salvar,
  validarMes,
  CAMPOS_DO_MEMBRO,
  config: () => ler('config.json'),
  salvarConfig: c => salvar('config.json', c),
  membros,
  salvarMembros: l => salvar('membros.json', l),
  obreiros,
  obreirosCrus: () => ler('obreiros.json', []),
  salvarObreiros,
  contatos: () => ler('contatos.json', []),
  salvarContatos: l => salvar('contatos.json', l),
  eventos: () => ler('eventos.json', []),
  salvarEventos: l => salvar('eventos.json', l),
  site: () => ler('site.json', {}),
  salvarSite: s => salvar('site.json', s),
  escala: mes => ler(`escalas/${validarMes(mes)}.json`, null),
  salvarEscala: e => salvar(`escalas/${validarMes(e.mes)}.json`, e),
  meses: () => Object.keys(cache).filter(k => /^escalas\/\d{4}-\d{2}\.json$/.test(k)).map(k => k.slice(8, 15)).sort(),
  chat: mes => ler(`chat/${validarMes(mes)}.json`, []),
  salvarChat: (mes, l) => salvar(`chat/${validarMes(mes)}.json`, l),
  historicoRegras: () => ler('historico_regras.json', []),
  salvarHistoricoRegras: l => salvar('historico_regras.json', l),
};

  };
  definicoes["./operacoes"] = function (module, exports, require) {
// Todas as mudanças de dados passam por aqui — assim tudo fica registrado no histórico.
const store = require('./store');
const E = require('../public/shared.js');

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clone = o => JSON.parse(JSON.stringify(o));
const agora = () => new Date().toISOString();
const erro = (msg, status = 400) => Object.assign(new Error(msg), { status });
const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function contexto() {
  const config = store.config();
  const obreiros = store.obreiros();
  return { config, obreiros, mapa: E.mapaObreiros(obreiros) };
}

/** Aceita id ("mario"), nome ("Mário"), nome com título ("Pr. Gilney") ou nome do WhatsApp. */
function resolverPessoa(texto, obreiros) {
  const alvo = semAcento(texto);
  if (!alvo) return null;
  const exato = obreiros.find(o => o.id === texto || semAcento(o.id) === alvo);
  if (exato) return exato.id;
  const candidatos = obreiros.filter(o =>
    [o.nome, E.nomeCurto(o), o.nome_completo, o.whatsapp_nome].some(v => v && semAcento(v) === alvo));
  if (candidatos.length === 1) return candidatos[0].id;
  const parciais = obreiros.filter(o => semAcento(o.nome).startsWith(alvo) || alvo.endsWith(' ' + semAcento(o.nome)));
  return parciais.length === 1 ? parciais[0].id : null;
}

function textoCelula(culto, funcao, ctx) {
  return E.linhasCelula(culto, funcao, ctx.config, ctx.mapa).join(' / ') || '(vazio)';
}

function acharCulto(escala, ref) {
  if (!ref) return null;
  return escala.cultos.find(c => c.id === ref) ||
    (escala.cultos.filter(c => c.data === ref).length === 1 ? escala.cultos.find(c => c.data === ref) : null);
}

function escalaOuErro(mes) {
  const escala = store.escala(mes);
  if (!escala) throw erro(`Ainda não existe escala para ${E.nomeMes(mes)}.`, 404);
  escala.historico = escala.historico || [];
  escala.versoes_anteriores = escala.versoes_anteriores || [];
  return escala;
}

function resumoValidacao(v) {
  return { ok: v.ok, erros: v.erros.map(e => e.msg), avisos: v.avisos.map(e => e.msg) };
}

// ---------------- Escala ----------------

/**
 * Altera células da escala. Se a mudança criar violações novas das regras,
 * NÃO aplica (a menos que forcar=true) e devolve as violações.
 */
function alterarAtribuicoes(mes, alteracoes, info = {}, forcar = false) {
  const ctx = contexto();
  const escala = escalaOuErro(mes);
  const antesVal = E.validar(escala, ctx.obreiros, ctx.config, { aPartirDe: store.hoje() });
  const nova = clone(escala);
  const mudancas = [];

  for (const alt of alteracoes || []) {
    const culto = acharCulto(nova, alt.culto_id || alt.data);
    if (!culto) throw erro(`Culto "${alt.culto_id || alt.data}" não encontrado em ${E.nomeMes(mes)}.`);
    const funcao = ctx.config.funcoes.find(f => f.id === alt.funcao || semAcento(f.nome) === semAcento(alt.funcao));
    if (!funcao) throw erro(`Função "${alt.funcao}" não existe. Use: ${ctx.config.funcoes.map(f => f.id).join(', ')}.`);
    const pessoas = (alt.pessoas || []).map(p => {
      const id = resolverPessoa(p, ctx.obreiros);
      if (!id) throw erro(`Não encontrei o obreiro "${p}" no cadastro.`);
      return id;
    });
    culto.atribuicoes = culto.atribuicoes || {};
    const atual = culto.atribuicoes[funcao.id] || { pessoas: [] };
    const novo = Object.assign({}, atual, { pessoas });
    if (alt.nota !== undefined && alt.nota !== null) {
      if (alt.nota) novo.nota = alt.nota; else delete novo.nota;
    }
    if (JSON.stringify(atual) === JSON.stringify(novo)) continue;
    const antesTexto = textoCelula(culto, funcao, ctx);
    culto.atribuicoes[funcao.id] = novo;
    mudancas.push({
      culto, funcao,
      antes: { pessoas: atual.pessoas || [], nota: atual.nota || '', texto: antesTexto },
      depois: { pessoas, nota: novo.nota || '', texto: textoCelula(culto, funcao, ctx) },
    });
  }
  if (!mudancas.length) return { aplicado: false, mensagem: 'Nada mudou: as células já estavam assim.' };

  const depoisVal = E.validar(nova, ctx.obreiros, ctx.config, { aPartirDe: store.hoje() });
  const ja = new Set(antesVal.erros.map(e => e.msg));
  const novas = depoisVal.erros.filter(e => !ja.has(e.msg)).map(e => e.msg);
  if (novas.length && !forcar) {
    return { aplicado: false, violacoes: novas, mensagem: 'A alteração quebra regras do cadastro. Nada foi aplicado.' };
  }

  const quando = agora();
  for (const m of mudancas) {
    nova.historico.push({
      id: uid(), quando, tipo: 'atribuicao', origem: info.origem || 'tela',
      culto_id: m.culto.id, data: m.culto.data, culto: m.culto.culto,
      funcao: m.funcao.id, funcao_nome: m.funcao.nome,
      antes: m.antes, depois: m.depois,
      motivo: info.motivo || '', pedido: info.pedido || '',
      violou_regras: novas.length ? novas : undefined,
    });
  }
  store.salvarEscala(nova);
  return {
    aplicado: true,
    mudancas: mudancas.map(m => ({ data: E.dataBR(m.culto.data), culto: m.culto.culto, funcao: m.funcao.nome, antes: m.antes.texto, depois: m.depois.texto })),
    regras_quebradas_com_confirmacao: novas,
    validacao: resumoValidacao(depoisVal),
  };
}

function gerenciarCulto(mes, op, info = {}) {
  const ctx = contexto();
  const escala = escalaOuErro(mes);
  const entrada = { id: uid(), quando: agora(), tipo: 'culto', origem: info.origem || 'tela', motivo: info.motivo || '', pedido: info.pedido || '' };

  if (op.acao === 'adicionar') {
    if (!op.data || !op.data.startsWith(mes)) throw erro(`A data precisa estar dentro de ${E.nomeMes(mes)} (AAAA-MM-DD).`);
    const tipo = ctx.config.tipos_culto.find(t => t.id === op.tipo) ? op.tipo : 'especial';
    const tipoCfg = ctx.config.tipos_culto.find(t => t.id === tipo);
    let id = `${op.data}-${tipo}`;
    for (let n = 2; escala.cultos.some(c => c.id === id); n++) id = `${op.data}-${tipo}-${n}`;
    const culto = {
      id, data: op.data, tipo, culto: (op.nome || (tipoCfg && tipoCfg.nome) || 'CULTO ESPECIAL').toUpperCase(),
      atribuicoes: Object.fromEntries(ctx.config.funcoes.map(f => [f.id, { pessoas: [] }])), obs: op.obs || '',
    };
    escala.cultos.push(culto);
    escala.cultos.sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
    Object.assign(entrada, { acao: 'adicionado', culto_id: id, data: op.data, culto: culto.culto, depois_culto: clone(culto),
      resumo: `Culto adicionado: ${E.dataBR(op.data)} – ${culto.culto}` });
  } else if (op.acao === 'remover') {
    const culto = acharCulto(escala, op.culto_id || op.data);
    if (!culto) throw erro(`Culto "${op.culto_id || op.data}" não encontrado.`);
    escala.cultos = escala.cultos.filter(c => c !== culto);
    Object.assign(entrada, { acao: 'removido', culto_id: culto.id, data: culto.data, culto: culto.culto, antes_culto: clone(culto),
      resumo: `Culto removido: ${E.dataBR(culto.data)} – ${culto.culto}` });
  } else if (op.acao === 'editar') {
    const culto = acharCulto(escala, op.culto_id || op.data);
    if (!culto) throw erro(`Culto "${op.culto_id || op.data}" não encontrado.`);
    const antes = clone(culto);
    if (op.nome) culto.culto = op.nome.toUpperCase();
    if (op.obs !== undefined) culto.obs = op.obs;
    if (op.nova_data) {
      if (!op.nova_data.startsWith(mes)) throw erro('A nova data precisa estar no mesmo mês.');
      culto.data = op.nova_data;
      escala.cultos.sort((a, b) => a.data.localeCompare(b.data));
    }
    const partes = [];
    if (antes.culto !== culto.culto) partes.push(`nome "${antes.culto}" → "${culto.culto}"`);
    if (antes.data !== culto.data) partes.push(`data ${E.dataBR(antes.data)} → ${E.dataBR(culto.data)}`);
    if ((antes.obs || '') !== (culto.obs || '')) partes.push(`observação "${antes.obs || ''}" → "${culto.obs || ''}"`);
    if (!partes.length) return { aplicado: false, mensagem: 'Nada mudou.' };
    Object.assign(entrada, { acao: 'editado', culto_id: culto.id, data: culto.data, culto: culto.culto, antes_culto: antes, depois_culto: clone(culto),
      resumo: `Culto ${E.dataBR(antes.data)} editado: ${partes.join('; ')}` });
  } else {
    throw erro('Ação inválida. Use adicionar, remover ou editar.');
  }
  escala.historico.push(entrada);
  store.salvarEscala(escala);
  return { aplicado: true, resumo: entrada.resumo, culto_id: entrada.culto_id, validacao: resumoValidacao(E.validar(escala, ctx.obreiros, ctx.config, { aPartirDe: store.hoje() })) };
}

/** Salva uma escala nova (ou substitui a do mês guardando a versão anterior). */
function salvarEscalaGerada(mes, cultos, info = {}) {
  const ctx = contexto();
  const existente = store.escala(mes);
  const quando = agora();
  const escala = existente || { mes, criada_em: quando, origem: 'Gerada pela IA', cultos: [], historico: [], versoes_anteriores: [] };
  escala.historico = escala.historico || [];
  escala.versoes_anteriores = escala.versoes_anteriores || [];
  let versaoIdx = null;
  if (existente) {
    escala.versoes_anteriores.push({ quando, cultos: existente.cultos });
    versaoIdx = escala.versoes_anteriores.length - 1;
  }
  escala.cultos = cultos;
  escala.atualizada_em = quando;
  const v = E.validar(escala, ctx.obreiros, ctx.config, { aPartirDe: store.hoje() });
  escala.historico.push({
    id: uid(), quando, tipo: 'geracao', origem: info.origem || 'tela',
    acao: existente ? 'regerada' : 'criada', versao_idx: versaoIdx,
    resumo: existente ? `Escala de ${E.nomeMes(mes)} gerada novamente pela IA (versão anterior guardada)` : `Escala de ${E.nomeMes(mes)} criada pela IA`,
    motivo: info.motivo || '', pedido: info.pedido || '', instrucoes: info.instrucoes || '',
    pendencias: v.erros.map(e => e.msg),
  });
  store.salvarEscala(escala);
  return { escala, validacao: v };
}

function desfazer(mes, logId, info = {}) {
  const escala = escalaOuErro(mes);
  const ent = escala.historico.find(h => h.id === logId);
  if (!ent) throw erro('Registro não encontrado.', 404);
  if (ent.desfeito_por) throw erro('Essa alteração já foi desfeita.');
  const base = { origem: 'desfazer', motivo: `Desfazendo alteração de ${new Date(ent.quando).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, pedido: info.pedido || '' };
  let res;

  if (ent.tipo === 'atribuicao') {
    const culto = acharCulto(escala, ent.culto_id);
    const cel = culto && (culto.atribuicoes || {})[ent.funcao];
    if (!cel || JSON.stringify(cel.pessoas || []) !== JSON.stringify(ent.depois.pessoas) || (cel.nota || '') !== (ent.depois.nota || '')) {
      throw erro('Essa célula foi alterada de novo depois; desfaça as mudanças mais recentes primeiro.');
    }
    res = alterarAtribuicoes(mes, [{ culto_id: ent.culto_id, funcao: ent.funcao, pessoas: ent.antes.pessoas, nota: ent.antes.nota || '' }], base, true);
  } else if (ent.tipo === 'culto') {
    if (ent.acao === 'adicionado') {
      res = gerenciarCulto(mes, { acao: 'remover', culto_id: ent.culto_id }, base);
    } else {
      const atual = escalaOuErro(mes);
      if (ent.acao === 'editado') atual.cultos = atual.cultos.filter(c => c.id !== ent.culto_id);
      atual.cultos.push(clone(ent.antes_culto));
      atual.cultos.sort((a, b) => a.data.localeCompare(b.data));
      atual.historico.push({ id: uid(), quando: agora(), tipo: 'culto', acao: ent.acao === 'removido' ? 'restaurado' : 'editado',
        culto_id: ent.culto_id, data: ent.antes_culto.data, culto: ent.antes_culto.culto, ...base,
        resumo: `Desfeito: ${ent.resumo}` });
      store.salvarEscala(atual);
      res = { aplicado: true };
    }
  } else if (ent.tipo === 'geracao' && ent.versao_idx != null) {
    const atual = escalaOuErro(mes);
    const anterior = atual.versoes_anteriores[ent.versao_idx];
    atual.versoes_anteriores.push({ quando: agora(), cultos: atual.cultos });
    atual.cultos = clone(anterior.cultos);
    atual.historico.push({ id: uid(), quando: agora(), tipo: 'geracao', acao: 'restaurada', ...base,
      versao_idx: atual.versoes_anteriores.length - 1, resumo: 'Versão anterior da escala restaurada' });
    store.salvarEscala(atual);
    res = { aplicado: true };
  } else {
    throw erro('Esse tipo de registro não pode ser desfeito.');
  }
  const final = store.escala(mes);
  const marcado = final.historico.find(h => h.id === logId);
  marcado.desfeito_por = final.historico[final.historico.length - 1].id;
  store.salvarEscala(final);
  return res;
}

// ---------------- Membros ----------------

const CAMPOS_MEMBRO = ['nome', 'nome_completo', 'titulo', 'cargo', 'sexo', 'nascimento', 'estado_civil', 'conjuge_id', 'telefone',
  'whatsapp_nome', 'email', 'endereco', 'bairro', 'cidade', 'cep', 'batismo', 'membro_desde', 'status', 'observacoes'];
const ROTULOS_MEMBRO = { nome: 'Nome', nome_completo: 'Nome completo', titulo: 'Título', cargo: 'Cargo', sexo: 'Sexo', nascimento: 'Nascimento',
  estado_civil: 'Estado civil', conjuge_id: 'Cônjuge', telefone: 'Telefone', whatsapp_nome: 'Nome no WhatsApp', email: 'E-mail',
  endereco: 'Endereço', bairro: 'Bairro', cidade: 'Cidade', cep: 'CEP', batismo: 'Batismo', membro_desde: 'Membro desde',
  status: 'Situação', observacoes: 'Observações' };
const STATUS_MEMBRO = ['ativo', 'visitante', 'afastado', 'inativo'];

function registrarRegra(entrada) {
  const h = store.historicoRegras();
  h.push(Object.assign({ id: uid(), quando: agora() }, entrada));
  store.salvarHistoricoRegras(h);
}

function slug(nome, listas) {
  const base = semAcento(nome).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pessoa';
  let id = base;
  for (let n = 2; listas.some(l => l.some(o => o.id === id)); n++) id = `${base}-${n}`;
  return id;
}

function normalizarMembro(m, membros) {
  for (const c of CAMPOS_MEMBRO) if (typeof m[c] === 'string') m[c] = m[c].trim();
  m.status = STATUS_MEMBRO.includes(m.status) ? m.status : 'ativo';
  m.sexo = ['M', 'F'].includes(m.sexo) ? m.sexo : '';
  m.conjuge_id = m.conjuge_id && membros.some(x => x.id === m.conjuge_id && x.id !== m.id) ? m.conjuge_id : null;
  return m;
}

function textoMembro(campo, valor, mapaM) {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (campo === 'conjuge_id') return mapaM[valor] ? E.nomeCurto(mapaM[valor]) : valor;
  if (['nascimento', 'batismo', 'membro_desde'].includes(campo) && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return E.dataBR(valor);
  if (campo === 'sexo') return valor === 'M' ? 'Masculino' : 'Feminino';
  return String(valor);
}

function sincronizarConjuge(membros, m, antigo) {
  if (antigo && antigo !== m.conjuge_id) {
    const a = membros.find(x => x.id === antigo);
    if (a && a.conjuge_id === m.id) a.conjuge_id = null;
  }
  const c = membros.find(x => x.id === m.conjuge_id);
  if (c) {
    if (c.conjuge_id && c.conjuge_id !== m.id) {
      const ex = membros.find(x => x.id === c.conjuge_id);
      if (ex && ex.conjuge_id === c.id) ex.conjuge_id = null;
    }
    c.conjuge_id = m.id;
  }
}

function criarMembro(dados, info = {}) {
  const membros = store.membros();
  if (!dados.nome || !String(dados.nome).trim()) throw erro('Informe o nome.');
  const m = { id: slug(dados.nome, [membros, store.obreirosCrus()]), criado_em: agora() };
  for (const c of CAMPOS_MEMBRO) m[c] = dados[c] !== undefined ? dados[c] : (c === 'conjuge_id' ? null : '');
  normalizarMembro(m, membros);
  m.atualizado_em = m.criado_em;
  membros.push(m);
  if (m.conjuge_id) sincronizarConjuge(membros, m);
  store.salvarMembros(membros);
  registrarRegra({ tipo: 'membro', acao: 'cadastrado', origem: info.origem || 'tela', membro_id: m.id, resumo: `${E.nomeCurto(m)} cadastrado(a) como membro`, motivo: info.motivo || '', pedido: info.pedido || '' });
  return m;
}

function atualizarMembro(id, campos, info = {}) {
  const membros = store.membros();
  const mapaM = E.mapaObreiros(membros);
  const m = membros.find(x => x.id === id);
  if (!m) throw erro('Membro não encontrado.', 404);
  const antes = clone(m);
  for (const c of CAMPOS_MEMBRO) if (campos[c] !== undefined) m[c] = campos[c];
  normalizarMembro(m, membros);
  if (!m.nome) throw erro('O nome não pode ficar vazio.');
  const mudancas = CAMPOS_MEMBRO.filter(c => JSON.stringify(antes[c] ?? null) !== JSON.stringify(m[c] ?? null))
    .map(c => ({ campo: ROTULOS_MEMBRO[c], antes: textoMembro(c, antes[c], mapaM), depois: textoMembro(c, m[c], mapaM) }));
  if (!mudancas.length) return { aplicado: false, mensagem: 'Nada mudou.', membro: m };
  if (antes.conjuge_id !== m.conjuge_id) sincronizarConjuge(membros, m, antes.conjuge_id);
  m.atualizado_em = agora();
  store.salvarMembros(membros);
  registrarRegra({ tipo: 'membro', acao: 'alterado', origem: info.origem || 'tela', membro_id: m.id, mudancas,
    resumo: `Cadastro de ${E.nomeCurto(m)} alterado`, motivo: info.motivo || '', pedido: info.pedido || '' });
  return { aplicado: true, mudancas, membro: m };
}

function removerMembro(id, info = {}) {
  const membros = store.membros();
  const m = membros.find(x => x.id === id);
  if (!m) throw erro('Membro não encontrado.', 404);
  if (store.obreirosCrus().some(o => o.membro_id === id)) {
    throw erro(`${E.nomeCurto(m)} é obreiro(a). Tire primeiro da lista de obreiros, ou mude a situação para "inativo".`);
  }
  for (const x of membros) if (x.conjuge_id === id) x.conjuge_id = null;
  store.salvarMembros(membros.filter(x => x !== m));
  registrarRegra({ tipo: 'membro', acao: 'removido', origem: info.origem || 'tela', membro_id: id, resumo: `${E.nomeCurto(m)} removido(a) do cadastro de membros`, antes: m, motivo: info.motivo || '' });
  return { aplicado: true };
}

// ---------------- Obreiros (dados da escala; os dados pessoais ficam no membro) ----------------

const CAMPOS_OBREIRO = ['status', 'funcoes', 'dias', 'limites', 'parceiro_id', 'indisponibilidades', 'regras', 'observacoes'];
const ROTULOS = { status: 'Status na escala', funcoes: 'Funções', dias: 'Dias disponíveis', limites: 'Limites',
  parceiro_id: 'Parceiro(a)/dupla', indisponibilidades: 'Indisponibilidades', regras: 'Regras específicas', observacoes: 'Observações' };

function normalizarObreiro(o, config, obreiros) {
  const num = v => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Math.max(0, Math.round(Number(v))));
  const funcoesValidas = config.funcoes.map(f => f.id);
  const lim = o.limites || {};
  const porFuncao = {};
  for (const [k, v] of Object.entries(lim.por_funcao || {})) if (funcoesValidas.includes(k) && num(v) !== null) porFuncao[k] = num(v);
  return Object.assign(o, {
    status: ['ativo', 'inativo', 'a confirmar'].includes(o.status) ? o.status : 'ativo',
    funcoes: [...new Set((o.funcoes || []).filter(f => funcoesValidas.includes(f)))],
    dias: [...new Set((o.dias || []).map(Number).filter(d => d >= 0 && d <= 6))].sort(),
    limites: { tarefas_mes: num(lim.tarefas_mes), cultos_mes: num(lim.cultos_mes), por_funcao: porFuncao },
    parceiro_id: o.parceiro_id && obreiros.some(x => x.id === o.parceiro_id && x.id !== o.id) ? o.parceiro_id : null,
    indisponibilidades: (o.indisponibilidades || []).filter(i => i && i.inicio).map(i => ({ inicio: i.inicio, fim: i.fim || i.inicio, motivo: i.motivo || '' })),
  });
}

function textoCampo(campo, valor, config, mapa) {
  if (valor === null || valor === undefined || valor === '') return '—';
  const nomeF = id => (config.funcoes.find(f => f.id === id) || { nome: id }).nome;
  switch (campo) {
    case 'funcoes': return valor.length ? valor.map(nomeF).join(', ') : 'nenhuma';
    case 'dias': return valor.length ? valor.map(d => E.DIAS[d]).join(', ') : 'todos';
    case 'parceiro_id': return mapa[valor] ? E.nomeCurto(mapa[valor]) : valor;
    case 'limites': {
      const p = [];
      if (valor.tarefas_mes != null) p.push(`${valor.tarefas_mes} tarefas/mês`);
      if (valor.cultos_mes != null) p.push(`${valor.cultos_mes} cultos/mês`);
      for (const [k, v] of Object.entries(valor.por_funcao || {})) p.push(`${nomeF(k)}: ${v}/mês`);
      return p.length ? p.join('; ') : 'sem limite';
    }
    case 'indisponibilidades': return valor.length ? valor.map(i => `${E.dataBR(i.inicio)}${i.fim && i.fim !== i.inicio ? ' a ' + E.dataBR(i.fim) : ''}${i.motivo ? ' (' + i.motivo + ')' : ''}`).join('; ') : 'nenhuma';
    default: return String(valor);
  }
}

function sincronizarParceiro(obreiros, o) {
  for (const x of obreiros) {
    if (x.id !== o.id && x.parceiro_id === o.id && o.parceiro_id !== x.id) x.parceiro_id = null;
  }
  const p = obreiros.find(x => x.id === o.parceiro_id);
  if (p) p.parceiro_id = o.id;
}

/** Transforma um membro em obreiro. Aceita membro_id, ou nome (acha o membro ou cadastra um novo). */
function criarObreiro(dados, info = {}) {
  const { config, obreiros } = contexto();
  let membro = dados.membro_id && store.membros().find(m => m.id === dados.membro_id);
  if (!membro && dados.nome) {
    const membros = store.membros();
    const id = resolverPessoa(dados.nome, membros);
    membro = id ? membros.find(m => m.id === id) : criarMembro({ nome: dados.nome, titulo: dados.titulo || '', telefone: dados.telefone || '', cargo: dados.cargo || 'Obreiro(a)', status: 'ativo' }, info);
  }
  if (!membro) throw erro('Escolha o membro que vai ser obreiro.');
  if (obreiros.some(o => o.membro_id === membro.id)) throw erro(`${E.nomeCurto(membro)} já é obreiro(a).`);
  const o = { id: slug(membro.id, [obreiros]), membro_id: membro.id, status: 'ativo', funcoes: [], dias: [], indisponibilidades: [], regras: '', observacoes: '', criado_em: agora() };
  if (!obreiros.some(x => x.id === membro.id)) o.id = membro.id;
  for (const c of CAMPOS_OBREIRO) if (dados[c] !== undefined) o[c] = dados[c];
  normalizarObreiro(o, config, obreiros);
  o.atualizado_em = o.criado_em;
  obreiros.push(o);
  if (o.parceiro_id) sincronizarParceiro(obreiros, o);
  store.salvarObreiros(obreiros);
  const nome = E.nomeCurto(membro);
  registrarRegra({ tipo: 'obreiro', acao: 'cadastrado', origem: info.origem || 'tela', obreiro_id: o.id, obreiro_nome: nome,
    resumo: `${nome} agora é obreiro(a)`, motivo: info.motivo || '', pedido: info.pedido || '' });
  return Object.assign({}, membro, o);
}

function atualizarObreiro(id, campos, info = {}) {
  const { config, obreiros, mapa } = contexto();
  const o = obreiros.find(x => x.id === id) || obreiros.find(x => x.id === resolverPessoa(id, obreiros));
  if (!o) throw erro(`Obreiro "${id}" não encontrado.`, 404);
  // Dados pessoais (nome, telefone, título…) vão para o cadastro de membro
  const pessoais = {};
  for (const c of store.CAMPOS_DO_MEMBRO) if (campos[c] !== undefined) pessoais[c] = campos[c];
  let mudancasMembro = [];
  if (Object.keys(pessoais).length) {
    const r = atualizarMembro(o.membro_id, pessoais, info);
    mudancasMembro = r.mudancas || [];
  }
  const antes = clone(o);
  for (const c of CAMPOS_OBREIRO) {
    if (campos[c] === undefined) continue;
    if (c === 'limites') o.limites = Object.assign({}, o.limites, campos.limites, { por_funcao: Object.assign({}, (o.limites || {}).por_funcao, (campos.limites || {}).por_funcao) });
    else if (c === 'parceiro_id') o.parceiro_id = campos.parceiro_id ? resolverPessoa(campos.parceiro_id, obreiros) : null;
    else o[c] = campos[c];
  }
  if (campos.limites && campos.limites.por_funcao) {
    for (const [k, v] of Object.entries(campos.limites.por_funcao)) if (v === null || v === '') delete o.limites.por_funcao[k];
  }
  normalizarObreiro(o, config, obreiros);
  const mudancas = CAMPOS_OBREIRO.filter(c => JSON.stringify(antes[c] ?? null) !== JSON.stringify(o[c] ?? null))
    .map(c => ({ campo: ROTULOS[c], antes: textoCampo(c, antes[c], config, mapa), depois: textoCampo(c, o[c], config, mapa) }));
  if (!mudancas.length) return { aplicado: !!mudancasMembro.length, mudancas: mudancasMembro, mensagem: mudancasMembro.length ? undefined : 'Nada mudou.', obreiro: o };
  if (JSON.stringify(antes.parceiro_id) !== JSON.stringify(o.parceiro_id)) {
    const antigo = obreiros.find(x => x.id === antes.parceiro_id);
    if (antigo && antigo.parceiro_id === o.id) antigo.parceiro_id = null;
    sincronizarParceiro(obreiros, o);
  }
  o.atualizado_em = agora();
  store.salvarObreiros(obreiros);
  registrarRegra({ tipo: 'obreiro', acao: 'alterado', origem: info.origem || 'tela', obreiro_id: o.id, obreiro_nome: E.nomeCurto(o),
    mudancas, resumo: `Regras de ${E.nomeCurto(o)} na escala alteradas`, motivo: info.motivo || '', pedido: info.pedido || '' });
  return { aplicado: true, mudancas: mudancasMembro.concat(mudancas), obreiro: o };
}

function removerObreiro(id, info = {}) {
  const obreiros = store.obreiros();
  const o = obreiros.find(x => x.id === id);
  if (!o) throw erro('Obreiro não encontrado.', 404);
  const usado = store.meses().filter(m => (store.escala(m).cultos || []).some(c => Object.values(c.atribuicoes || {}).some(a => (a.pessoas || []).includes(id))));
  if (usado.length) throw erro(`${E.nomeCurto(o)} aparece nas escalas de ${usado.map(E.nomeMes).join(', ')}. Mude o status na escala para "inativo" em vez de remover.`);
  for (const x of obreiros) if (x.parceiro_id === id) x.parceiro_id = null;
  store.salvarObreiros(obreiros.filter(x => x.id !== id));
  registrarRegra({ tipo: 'obreiro', acao: 'removido', origem: info.origem || 'tela', obreiro_id: id, obreiro_nome: E.nomeCurto(o),
    resumo: `${E.nomeCurto(o)} deixou de ser obreiro(a) (continua como membro)`, motivo: info.motivo || '' });
  return { aplicado: true };
}

// ---------------- Calendário de eventos ----------------

const CAMPOS_EVENTO = ['titulo', 'data_inicio', 'data_fim', 'hora_inicio', 'hora_fim', 'local', 'categoria', 'publico', 'destaque', 'descricao'];

function normalizarEvento(ev) {
  const data = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');
  const hora = v => (/^\d{2}:\d{2}$/.test(v || '') ? v : '');
  ev.titulo = String(ev.titulo || '').trim();
  if (!ev.titulo) throw erro('Dê um nome para o evento.');
  ev.data_inicio = data(ev.data_inicio);
  if (!ev.data_inicio) throw erro('Informe a data do evento.');
  ev.data_fim = data(ev.data_fim);
  if (ev.data_fim && ev.data_fim < ev.data_inicio) throw erro('A data final é antes da data inicial.');
  if (ev.data_fim === ev.data_inicio) ev.data_fim = '';
  ev.hora_inicio = hora(ev.hora_inicio);
  ev.hora_fim = hora(ev.hora_fim);
  ev.publico = !!ev.publico;
  ev.destaque = !!ev.destaque && ev.publico; // só destaca o que aparece no site
  for (const c of ['local', 'categoria', 'descricao']) ev[c] = String(ev[c] || '').trim();
  return ev;
}

function salvarEvento(dados, info = {}) {
  const eventos = store.eventos();
  let ev = dados.id && eventos.find(e => e.id === dados.id);
  const novo = !ev;
  const antes = ev ? clone(ev) : null;
  if (novo) ev = { id: 'ev' + uid(), criado_em: agora() };
  for (const c of CAMPOS_EVENTO) if (dados[c] !== undefined) ev[c] = dados[c];
  normalizarEvento(ev);
  ev.atualizado_em = agora();
  if (novo) eventos.push(ev);
  eventos.sort((a, b) => (a.data_inicio + a.hora_inicio).localeCompare(b.data_inicio + b.hora_inicio));
  store.salvarEventos(eventos);
  const mudancas = novo ? [] : CAMPOS_EVENTO.filter(c => JSON.stringify(antes[c] ?? '') !== JSON.stringify(ev[c] ?? ''))
    .map(c => ({ campo: c, antes: String(antes[c] ?? '—'), depois: String(ev[c] ?? '—') }));
  registrarRegra({ tipo: 'evento', acao: novo ? 'criado' : 'alterado', origem: info.origem || 'tela', evento_id: ev.id,
    resumo: `${novo ? 'Evento criado' : 'Evento alterado'}: ${ev.titulo} (${E.dataBR(ev.data_inicio)})`, mudancas, motivo: info.motivo || '' });
  return ev;
}

function removerEvento(id, info = {}) {
  const eventos = store.eventos();
  const ev = eventos.find(e => e.id === id);
  if (!ev) throw erro('Evento não encontrado.', 404);
  store.salvarEventos(eventos.filter(e => e !== ev));
  registrarRegra({ tipo: 'evento', acao: 'removido', origem: info.origem || 'tela', evento_id: id, resumo: `Evento removido: ${ev.titulo} (${E.dataBR(ev.data_inicio)})`, antes: ev, motivo: info.motivo || '' });
  return { aplicado: true };
}

// ---------------- Regras gerais e configuração ----------------

function regraGeral(op, info = {}) {
  const config = store.config();
  const lista = config.regras_gerais;
  let resumo;
  let antes = '';
  let depois = '';
  const achar = () => {
    const r = lista.find(x => x.id === op.id);
    if (!r) throw erro(`Regra "${op.id}" não encontrada.`, 404);
    return r;
  };
  if (op.acao === 'adicionar') {
    if (!op.texto || !op.texto.trim()) throw erro('Escreva o texto da regra.');
    const id = 'r' + (Math.max(0, ...lista.map(r => Number(r.id.slice(1)) || 0)) + 1);
    lista.push({ id, texto: op.texto.trim(), ativa: true });
    resumo = 'Regra geral adicionada';
    depois = op.texto.trim();
  } else if (op.acao === 'editar') {
    const r = achar();
    antes = r.texto;
    r.texto = (op.texto || '').trim() || r.texto;
    depois = r.texto;
    if (antes === depois) return { aplicado: false, mensagem: 'Nada mudou.' };
    resumo = 'Regra geral editada';
  } else if (op.acao === 'remover') {
    const r = achar();
    antes = r.texto;
    config.regras_gerais = lista.filter(x => x !== r);
    resumo = 'Regra geral removida';
  } else if (op.acao === 'ativar' || op.acao === 'desativar') {
    const r = achar();
    r.ativa = op.acao === 'ativar';
    antes = r.texto;
    depois = r.texto;
    resumo = op.acao === 'ativar' ? 'Regra geral ativada' : 'Regra geral desativada';
  } else {
    throw erro('Ação inválida.');
  }
  store.salvarConfig(config);
  registrarRegra({ tipo: 'regra', acao: op.acao, origem: info.origem || 'tela', resumo, antes, depois, motivo: info.motivo || '', pedido: info.pedido || '' });
  return { aplicado: true, resumo, regras_gerais: config.regras_gerais };
}

function atualizarConfig(parcial, info = {}) {
  const config = store.config();
  const chaves = ['igreja', 'titulo_escala', 'aviso_dias_antes', 'funcoes', 'tipos_culto'];
  const mudou = [];
  for (const k of chaves) {
    if (parcial[k] === undefined) continue;
    if (JSON.stringify(config[k]) !== JSON.stringify(parcial[k])) {
      mudou.push(k);
      config[k] = parcial[k];
    }
  }
  if (!mudou.length) return { aplicado: false, config };
  store.salvarConfig(config);
  const nomes = { igreja: 'nome da igreja', titulo_escala: 'título da escala', aviso_dias_antes: 'dias do aviso', funcoes: 'funções', tipos_culto: 'tipos de culto' };
  registrarRegra({ tipo: 'config', acao: 'alterado', origem: info.origem || 'tela', resumo: `Configuração alterada: ${mudou.map(k => nomes[k]).join(', ')}`, motivo: info.motivo || '' });
  return { aplicado: true, config };
}

// ---------------- Página inicial (site) ----------------

const CAMPOS_SITE = { chamada: 'Frase do início', sobre: 'Quem somos', horarios: 'Horários dos cultos', pastores: 'Pastores', versiculo: 'Versículo',
  endereco: 'Endereço', mapa_link: 'Link do mapa', whatsapp: 'WhatsApp', instagram: 'Instagram', youtube: 'YouTube', email: 'E-mail', pix: 'PIX' };

function atualizarSite(parcial, info = {}) {
  const site = store.site();
  const mudou = [];
  for (const k of Object.keys(CAMPOS_SITE)) {
    if (parcial[k] === undefined || JSON.stringify(site[k] ?? null) === JSON.stringify(parcial[k])) continue;
    site[k] = parcial[k];
    mudou.push(CAMPOS_SITE[k]);
  }
  if (!mudou.length) return { aplicado: false, mensagem: 'Nada mudou.' };
  store.salvarSite(site);
  registrarRegra({ tipo: 'site', acao: 'alterado', origem: info.origem || 'tela', resumo: `Página inicial atualizada: ${mudou.join(', ')}`, motivo: info.motivo || '' });
  return { aplicado: true, site };
}

/** Pega o código do vídeo de qualquer formato de link do YouTube (watch, youtu.be, shorts, live, embed). */
function idYoutube(url) {
  const t = String(url || '').trim();
  const m = t.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|v\/))([\w-]{11})/i);
  if (m) return m[1];
  return /^[\w-]{11}$/.test(t) ? t : null;
}

function publicarVideo(dados, info = {}) {
  const codigo = idYoutube(dados.url);
  if (!codigo) throw erro('Não reconheci esse link. Cole o endereço do vídeo do YouTube (ex.: https://youtube.com/shorts/... ou https://youtu.be/...).');
  const site = store.site();
  site.videos = site.videos || [];
  const v = {
    id: 'v' + uid(), youtube: codigo, url: String(dados.url).trim(),
    formato: /shorts\//i.test(dados.url) || dados.formato === 'vertical' ? 'vertical' : 'horizontal',
    titulo: String(dados.titulo || '').trim(), data: /^\d{4}-\d{2}-\d{2}$/.test(dados.data || '') ? dados.data : store.hoje(),
    criado_em: agora(),
  };
  site.videos.unshift(v);
  site.videos.sort((a, b) => b.data.localeCompare(a.data) || b.criado_em.localeCompare(a.criado_em));
  site.videos = site.videos.slice(0, 60);
  store.salvarSite(site);
  registrarRegra({ tipo: 'site', acao: 'video', origem: info.origem || 'tela', resumo: `Palavra do dia publicada: ${v.titulo || 'vídeo'} (${E.dataBR(v.data)})`, motivo: info.motivo || '' });
  return v;
}

function removerVideo(id, info = {}) {
  const site = store.site();
  const v = (site.videos || []).find(x => x.id === id);
  if (!v) throw erro('Vídeo não encontrado.', 404);
  site.videos = site.videos.filter(x => x !== v);
  store.salvarSite(site);
  registrarRegra({ tipo: 'site', acao: 'video-removido', origem: info.origem || 'tela', resumo: `Vídeo removido do site: ${v.titulo || v.youtube} (${E.dataBR(v.data)})`, motivo: info.motivo || '' });
  return { aplicado: true };
}

// ---------------- Contatos do WhatsApp ainda sem vínculo ----------------

function resolverContato(contatoId, acao, membroId, info = {}) {
  const contatos = store.contatos();
  const c = contatos.find(x => x.id === contatoId);
  if (!c) throw erro('Contato não encontrado.', 404);
  let membro = null;
  if (acao === 'vincular') {
    const m = store.membros().find(x => x.id === membroId);
    if (!m) throw erro('Membro não encontrado.', 404);
    const campos = { whatsapp_nome: c.whatsapp_nome };
    if (c.telefone && !m.telefone) campos.telefone = c.telefone;
    membro = atualizarMembro(m.id, campos, Object.assign({ motivo: `Vinculado ao contato "${c.whatsapp_nome}" do WhatsApp` }, info)).membro;
  } else if (acao === 'cadastrar') {
    membro = criarMembro({ nome: c.whatsapp_nome, whatsapp_nome: c.whatsapp_nome, telefone: c.telefone, cargo: 'Membro', status: 'ativo',
      observacoes: ['Veio da lista do grupo do WhatsApp — completar o cadastro.', c.obs].filter(Boolean).join(' ') }, info);
  } else if (acao !== 'descartar') {
    throw erro('Ação inválida.');
  }
  store.salvarContatos(contatos.filter(x => x !== c));
  return { aplicado: true, membro };
}

module.exports = {
  resolverPessoa, alterarAtribuicoes, gerenciarCulto, salvarEscalaGerada, desfazer, resumoValidacao,
  criarMembro, atualizarMembro, removerMembro, criarObreiro, atualizarObreiro, removerObreiro,
  salvarEvento, removerEvento, atualizarSite, publicarVideo, removerVideo, idYoutube, regraGeral, atualizarConfig, resolverContato, erro,
};

  };
  definicoes["./ia"] = function (module, exports, require) {
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

  };
  definicoes["./rotas"] = function (module, exports, require) {
// "API" do sistema rodando no navegador: mesmas rotas do servidor local, mas os dados vão para o Supabase.
const store = require('./store');
const ops = require('./operacoes');
const ia = require('./ia');
const E = require('../public/shared.js');

function avisos(hoje, config) {
  const lista = [];
  const mesAtual = hoje.slice(0, 7);
  const prox = E.proximoMes(mesAtual);
  const restantes = E.diasNoMes(mesAtual) - Number(hoje.slice(8, 10));
  if (!store.escala(mesAtual)) {
    lista.push({ tipo: 'urgente', mes: mesAtual, texto: `Ainda não existe escala para ${E.nomeMes(mesAtual)}.` });
  }
  if (restantes <= (config.aviso_dias_antes ?? 5) && !store.escala(prox)) {
    const quando = restantes === 0 ? 'Hoje é o último dia do mês' : `Falta${restantes > 1 ? 'm' : ''} ${restantes} dia${restantes > 1 ? 's' : ''} para o fim de ${E.MESES[Number(mesAtual.slice(5)) - 1].toLowerCase()}`;
    lista.push({ tipo: 'proximo', mes: prox, texto: `${quando}. Precisamos gerar a escala de ${E.nomeMes(prox)}.` });
  }
  return lista;
}

function estado(mes) {
  const hoje = store.hoje();
  mes = mes || hoje.slice(0, 7);
  store.validarMes(mes);
  const config = store.config();
  if (!config) throw ops.erro('O banco de dados ainda não tem a configuração inicial.', 500);
  const obreiros = store.obreiros();
  const escala = store.escala(mes);
  let validacao = null;
  if (escala) {
    const v = E.validar(escala, obreiros, config, { aPartirDe: hoje });
    validacao = { ok: v.ok, erros: v.erros, avisos: v.avisos, uso: v.uso };
  }
  const proximos = [];
  for (const m of [hoje.slice(0, 7), E.proximoMes(hoje.slice(0, 7))]) {
    const e = store.escala(m);
    for (const c of (e && e.cultos) || []) if (c.data >= hoje) proximos.push(c);
  }
  return {
    hoje, mes, config, obreiros, escala, validacao,
    membros: store.membros(),
    site: store.site(),
    eventos: store.eventos(),
    contatos: store.contatos(),
    meses: store.meses(),
    proximos_cultos: proximos.slice(0, 6),
    avisos: avisos(hoje, config),
    ia_configurada: true,
  };
}

async function executar(metodo, caminho, corpo = {}) {
  const url = new URL(caminho, 'http://local');
  const p = url.pathname.split('/').filter(Boolean).slice(1).map(decodeURIComponent);
  const m = metodo;
  const tela = { origem: 'tela', motivo: corpo.motivo || '' };

  if (m === 'GET' && p[0] === 'estado') {
    if (!store.temPendencias()) await store.carregar();
    return estado(url.searchParams.get('mes'));
  }
  if (p[0] === 'escalas' && p[1]) {
    const mes = store.validarMes(p[1]);
    if (m === 'POST' && p[2] === 'gerar') return ia.gerarEscala(mes, corpo.instrucoes || '', tela);
    if (m === 'POST' && p[2] === 'alterar') return ops.alterarAtribuicoes(mes, corpo.alteracoes, tela, !!corpo.forcar);
    if (m === 'POST' && p[2] === 'cultos') return ops.gerenciarCulto(mes, corpo, tela);
    if (m === 'POST' && p[2] === 'desfazer' && p[3]) return ops.desfazer(mes, p[3], tela);
  }
  if (m === 'GET' && p[0] === 'historico') {
    const mes = url.searchParams.get('mes');
    const escala = mes ? store.escala(store.validarMes(mes)) : null;
    return { escala: (escala && escala.historico) || [], regras: store.historicoRegras() };
  }
  if (p[0] === 'chat') {
    if (m === 'POST') {
      if (!corpo.mensagem || !corpo.mensagem.trim()) throw ops.erro('Mensagem vazia.');
      return ia.conversar(store.validarMes(corpo.mes), corpo.mensagem.trim());
    }
    if (m === 'GET' && p[1]) return store.chat(p[1]);
    if (m === 'DELETE' && p[1]) { store.salvarChat(p[1], []); return { ok: true }; }
  }
  if (p[0] === 'membros') {
    if (m === 'POST' && !p[1]) return ops.criarMembro(corpo, tela);
    if (m === 'PUT' && p[1]) return ops.atualizarMembro(p[1], corpo, tela);
    if (m === 'DELETE' && p[1]) return ops.removerMembro(p[1], tela);
  }
  if (p[0] === 'obreiros') {
    if (m === 'POST' && !p[1]) return ops.criarObreiro(corpo, tela);
    if (m === 'PUT' && p[1]) return ops.atualizarObreiro(p[1], corpo, tela);
    if (m === 'DELETE' && p[1]) return ops.removerObreiro(p[1], tela);
  }
  if (p[0] === 'eventos') {
    if (m === 'POST' && !p[1]) return ops.salvarEvento(corpo, tela);
    if (m === 'PUT' && p[1]) return ops.salvarEvento(Object.assign({}, corpo, { id: p[1] }), tela);
    if (m === 'DELETE' && p[1]) return ops.removerEvento(p[1], tela);
  }
  if (p[0] === 'site') {
    if (m === 'PUT' && !p[1]) return ops.atualizarSite(corpo, tela);
    if (m === 'POST' && p[1] === 'videos') return ops.publicarVideo(corpo, tela);
    if (m === 'DELETE' && p[1] === 'videos' && p[2]) return ops.removerVideo(p[2], tela);
  }
  if (m === 'POST' && p[0] === 'regras') return ops.regraGeral(corpo, tela);
  if (m === 'PUT' && p[0] === 'config') return ops.atualizarConfig(corpo, tela);
  if (m === 'POST' && p[0] === 'contatos' && p[1]) return ops.resolverContato(p[1], corpo.acao, corpo.membro_id, tela);
  throw ops.erro('Rota não encontrada', 404);
}

/** Executa uma rota e grava no banco o que tiver mudado. Se algo falhar, recarrega do banco. */
async function chamar(metodo, caminho, corpo) {
  try {
    const r = await executar(metodo, caminho, corpo);
    await store.persistir();
    return r;
  } catch (e) {
    try { await store.persistir(); } catch { await store.carregar().catch(() => {}); }
    throw e;
  }
}

module.exports = { chamar, iniciar: store.iniciar, carregar: store.carregar };

  };
  window.Nucleo = requerer('./rotas');
})();
