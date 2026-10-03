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
