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

const CAMPOS_EVENTO = ['titulo', 'data_inicio', 'data_fim', 'hora_inicio', 'hora_fim', 'local', 'categoria', 'publico', 'descricao'];

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
  salvarEvento, removerEvento, regraGeral, atualizarConfig, resolverContato, erro,
};
