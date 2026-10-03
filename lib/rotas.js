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
