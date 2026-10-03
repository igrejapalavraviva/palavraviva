/* Sistema interno — Igreja Palavra Viva */
const E = window.Escala;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const toque = matchMedia('(pointer: coarse)').matches;
const ehCelular = () => matchMedia('(max-width: 960px)').matches;

let S = null; // estado vindo do servidor
const ui = {
  secao: 'painel', aba: 'escala', mes: null, filtro: 'ativo', busca: '', histAba: 'escala',
  mudou: new Set(), chat: [], enviando: false, rcfg: null, rasc: null, historico: null,
  membrosFiltro: 'ativo', membrosBusca: '', membrosCargo: '', mesCal: null, diaSel: null,
  camadas: { ev: true, an: true, cu: true },
};

const ICONES = {
  esq: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  dir: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  ok: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  alerta: '<svg viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01M10.3 3.9L2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
  sino: '<svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>',
  ia: '<svg viewBox="0 0 24 24"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>',
  imagem: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
  zap: '<svg viewBox="0 0 24 24"><path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-1 .8a4 4 0 0 1-2.1-2.1l.8-1-1-2z"/></svg>',
  imprimir: '<svg viewBox="0 0 24 24"><path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><rect x="6" y="14" width="12" height="7" rx="1"/></svg>',
  mais: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  lixo: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
  lapis: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
  busca: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  desfazer: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
  regenerar: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>',
  bolo: '<svg viewBox="0 0 24 24"><path d="M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M5 16c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0M12 12V8M12 5.5c.8-.6 1-1.6 0-2.5-1 .9-.8 1.9 0 2.5z"/></svg>',
  pessoas: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/></svg>',
  maos: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-4.4-9-9.2C1.6 8.4 3.9 5 7.2 5c2 0 3.6 1.2 4.8 3 1.2-1.8 2.8-3 4.8-3 3.3 0 5.6 3.4 4.2 6.8C19 16.6 12 21 12 21z"/></svg>',
  calendario: '<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
  seta: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  globo: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  copiar: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
};

// ---------------- Comunicação ----------------
// Os dados ficam no Supabase; o "núcleo" (nucleo.js) roda as mesmas regras do sistema aqui no navegador.
const SB = window.supabase.createClient(window.IPV_CONFIG.supabaseUrl, window.IPV_CONFIG.supabaseKey);
window.Nucleo.iniciar(SB, {
  // A IA é chamada pela função "ia" do Supabase, que guarda a chave em segredo
  chamarIA: async corpo => {
    const { data, error } = await SB.functions.invoke('ia', { body: corpo });
    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); msg = j.erro || msg; } catch { /* sem corpo */ }
      return { erro: msg };
    }
    return data;
  },
});
SB.auth.onAuthStateChange(evento => { if (evento === 'SIGNED_OUT') location.href = '/login/'; });

async function api(url, opcoes = {}) {
  try {
    return await window.Nucleo.chamar(opcoes.method || 'GET', url, opcoes.body || {});
  } catch (e) {
    if (/JWT|not authenticated|permission denied/i.test(e.message)) { location.href = '/login/'; }
    throw new Error(e.message || 'Algo deu errado');
  }
}

async function carregar(mes, { manterChat = false } = {}) {
  const mudouMes = mes && mes !== ui.mes;
  S = await api('/api/estado' + (mes ? `?mes=${mes}` : ''));
  ui.mes = S.mes;
  ui.mesCal = ui.mesCal || S.hoje.slice(0, 7);
  ui.mapa = E.mapaObreiros(S.obreiros);
  ui.mapaM = E.mapaObreiros(S.membros);
  if (!manterChat || mudouMes || !ui.chatCarregado) await carregarChat();
  if (ui.aba === 'historico') await carregarHistorico();
  render();
}

function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { t.hidden = true; }, ms);
}

// ---------------- Navegação ----------------
const SECOES = ['painel', 'membros', 'escala', 'calendario', 'site'];

function irSecao(secao, { aba, semHistorico } = {}) {
  ui.secao = secao;
  if (aba) ui.aba = aba;
  if (ui.aba !== 'regras') ui.rcfg = null;
  document.body.dataset.secao = secao;
  document.querySelectorAll('[data-secao]').forEach(b => b.classList.toggle('ativa', b.dataset.secao === secao));
  if (secao !== 'escala') fecharChat();
  if (!semHistorico) history.replaceState(null, '', '#' + secao + (secao === 'escala' && ui.aba !== 'escala' ? '/' + ui.aba : ''));
  if (secao === 'escala' && ui.aba === 'historico') carregarHistorico().then(render); else render();
  window.scrollTo({ top: 0 });
}

function irPara(aba) {
  if (aba === 'chat') return abrirChat();
  irSecao('escala', { aba });
}

function subabas() {
  const abas = [['escala', 'Escala do mês'], ['obreiros', 'Obreiros'], ['regras', 'Regras'], ['historico', 'Histórico']];
  return `<div class="subabas">${abas.map(([id, t]) => `<button data-aba="${id}" class="${ui.aba === id ? 'ativa' : ''}">${t}</button>`).join('')}</div>`;
}

function render() {
  if (!S) return;
  const alvo = $('#principal');
  if (ui.secao === 'painel') alvo.innerHTML = telaPainel();
  else if (ui.secao === 'membros') alvo.innerHTML = telaMembros();
  else if (ui.secao === 'calendario') alvo.innerHTML = telaCalendario();
  else if (ui.secao === 'site') alvo.innerHTML = telaSite();
  else {
    const telas = { escala: telaEscala, obreiros: telaObreiros, regras: telaRegras, historico: telaHistorico };
    alvo.innerHTML = subabas() + telas[ui.aba]();
  }
  $('#chat-sub').textContent = `Conversa de ${E.nomeMes(ui.mes)}`;
}

// ---------------- Tela: Escala ----------------
function telaAvisos() {
  return (S.avisos || []).map(a => `
    <div class="aviso ${a.tipo === 'urgente' ? 'urgente' : ''}">
      <div class="ic">${ICONES.sino}</div>
      <p>${esc(a.texto)}<small>A IA monta tudo seguindo as regras cadastradas — depois é só revisar.</small></p>
      <button class="btn primario" data-gerar="${a.mes}">${ICONES.ia} Gerar ${esc(E.MESES[Number(a.mes.slice(5)) - 1].toLowerCase())}</button>
    </div>`).join('');
}

function navMes() {
  const [a, m] = ui.mes.split('-').map(Number);
  return `<div class="mes-nav">
    <button class="icone" data-mes="${E.proximoMes(ui.mes, -1)}" aria-label="Mês anterior">${ICONES.esq}</button>
    <h1><span class="mes">${E.MESES[m - 1]}</span> ${a}</h1>
    <button class="icone" data-mes="${E.proximoMes(ui.mes, 1)}" aria-label="Próximo mês">${ICONES.dir}</button>
  </div>`;
}

function celula(c, f) {
  const linhas = E.linhasCelula(c, f, S.config, ui.mapa);
  const chave = `${c.id}|${f.id}`;
  const comErro = S.validacao && S.validacao.erros.some(e => e.culto === c.id && e.funcao === f.id);
  const classes = ['cel', linhas.length ? '' : 'vazia', comErro ? 'com-erro' : '', ui.mudou.has(chave) ? 'mudou' : ''].join(' ');
  return `<span class="${classes}" data-cel="${chave}" title="Clique para pedir uma alteração à IA">${linhas.length ? linhas.map(esc).join('<br>') : 'definir'}</span>`;
}

function telaEscala() {
  const escala = S.escala;
  const v = S.validacao;
  let status = '';
  if (escala) {
    status = v.ok
      ? `<span class="pilula ok">${ICONES.ok} Todas as regras atendidas</span>`
      : `<span class="pilula erro">${ICONES.alerta} ${v.erros.length} pendência${v.erros.length > 1 ? 's' : ''}</span>`;
  }
  const acoes = escala ? `<div class="direita">
      <button class="btn" data-acao="imagem">${ICONES.imagem} Imagem</button>
      <button class="btn" data-acao="whatsapp">${ICONES.zap} Texto</button>
      <button class="btn" data-acao="imprimir">${ICONES.imprimir} Imprimir</button>
      <button class="btn" data-gerar="${ui.mes}">${ICONES.regenerar} Gerar de novo</button>
    </div>` : '';

  let corpo;
  if (!escala) {
    corpo = `<div class="cartao vazio">
      <h2>Ainda não há escala para ${esc(E.nomeMes(ui.mes))}</h2>
      <p>A IA monta o mês inteiro em cerca de 1 minuto, seguindo as regras de cada obreiro.</p>
      <button class="btn primario" data-gerar="${ui.mes}">${ICONES.ia} Gerar escala com IA</button>
    </div>`;
  } else {
    const pend = v.ok ? '' : `<div class="cartao pendencias erro"><h3>O que precisa de atenção</h3><ul>${v.erros.map(e => `<li>${esc(e.msg)}</li>`).join('')}</ul></div>`;
    const cab = `<tr><th>Data</th><th>Culto</th>${S.config.funcoes.map(f => `<th>${esc(f.nome.toUpperCase() === f.nome ? f.nome : f.nome)}</th>`).join('')}</tr>`;
    const linhas = escala.cultos.map(c => {
      const cls = c.data === S.hoje ? 'hoje' : c.data < S.hoje ? 'passado' : '';
      return `<tr class="${cls}">
        <td class="data"><b>${E.dataBR(c.data).slice(0, 5)}</b><span>${E.DIAS[E.diaSemana(c.data)]}</span></td>
        <td class="culto">${esc(c.culto)}${c.obs ? `<small>${esc(c.obs)}</small>` : ''}</td>
        ${S.config.funcoes.map(f => `<td>${celula(c, f)}</td>`).join('')}
      </tr>`;
    }).join('');
    const cards = escala.cultos.map(c => {
      const [, m, d] = c.data.split('-');
      const cls = c.data < S.hoje ? 'passado' : '';
      return `<div class="cartao culto-card ${cls}">
        <div class="linha1">
          <div class="dia"><div><b>${d}</b><span>${E.DIAS[E.diaSemana(c.data)].slice(0, 3)}</span></div></div>
          <div><strong>${esc(c.culto)}</strong><small>${c.data === S.hoje ? 'Hoje · ' : ''}${E.DIAS[E.diaSemana(c.data)]}, ${d}/${m}${c.obs ? ' · ' + esc(c.obs) : ''}</small></div>
        </div>
        <dl>${S.config.funcoes.map(f => `<dt>${esc(f.nome)}</dt><dd>${celula(c, f)}</dd>`).join('')}</dl>
      </div>`;
    }).join('');
    corpo = `${pend}
      <div class="cartao tabela-wrap"><table class="escala"><thead>${cab}</thead><tbody>${linhas}</tbody></table></div>
      <div class="cultos-cards">${cards}</div>
      ${telaDistribuicao()}`;
  }
  return `${telaAvisos()}
    <div class="cabeca">${navMes()}${status}${acoes}</div>
    ${corpo}`;
}

function telaDistribuicao() {
  const uso = S.validacao.uso;
  const ativos = S.obreiros.filter(o => o.status === 'ativo' && (o.funcoes || []).length);
  const maxUso = Math.max(1, ...Object.values(uso).map(u => u.tarefas));
  const abrev = { direcao: 'Dir', pregacao: 'Preg', ofertas: 'Of', finalizacao: 'Fin' };
  const itens = ativos.map(o => ({ o, u: uso[o.id] || { tarefas: 0, cultos: 0, por_funcao: {} } }))
    .sort((a, b) => b.u.tarefas - a.u.tarefas || a.o.nome.localeCompare(b.o.nome));
  return `<div class="secao">
    <h2>Distribuição no mês</h2>
    <p class="sub">Quantas tarefas cada obreiro tem em ${esc(E.nomeMes(ui.mes))}, comparado ao limite cadastrado.</p>
    <div class="distrib">${itens.map(({ o, u }) => {
      const lim = (o.limites || {}).tarefas_mes;
      const pct = Math.min(100, Math.round(100 * u.tarefas / (lim || maxUso)));
      const detalhe = Object.entries(u.por_funcao).map(([k, n]) => `${abrev[k] || k} ${n}`).join(' · ') || 'sem tarefas';
      return `<div class="cartao pessoa-uso ${lim != null && u.tarefas > lim ? 'estourou' : ''} ${u.tarefas ? '' : 'zero'}">
        <div class="topo-uso"><b>${esc(E.nomeCurto(o))}</b><span>${u.tarefas}${lim != null ? ' / ' + lim : ''}</span></div>
        <div class="barra"><i style="width:${pct}%"></i></div>
        <small>${esc(detalhe)}${u.cultos ? ` · ${u.cultos} culto${u.cultos > 1 ? 's' : ''}` : ''}</small>
      </div>`;
    }).join('')}</div>
  </div>`;
}

// ---------------- Geração ----------------
function abrirGerar(mes) {
  const existe = S.meses.includes(mes);
  modal(`
    <div class="modal-cab"><h2>Gerar escala de ${esc(E.nomeMes(mes))}</h2><button class="icone" data-fechar>${ICONES.x}</button></div>
    <div class="modal-corpo form" id="gerar-corpo">
      <p class="sub" style="margin:0">A IA vai montar todos os cultos do mês seguindo as regras gerais e o cadastro de cada obreiro. O sistema confere o resultado e pede correção à IA se algo quebrar uma regra.</p>
      ${existe ? `<div class="aviso" style="margin:0"><div class="ic">${ICONES.alerta}</div><p>Este mês já tem escala.<small>Ela será substituída — a versão atual fica guardada e dá para voltar pelo Histórico.</small></p></div>` : ''}
      <label class="campo"><span>Instruções para este mês <small>(opcional)</small></span>
        <textarea id="gerar-instr" rows="4" placeholder="Ex.: dia 15 tem batismo, a pregação é do Pr. Gilney; o Herick estará viajando o mês todo; vigília no sábado 21."></textarea>
      </label>
    </div>
    <div class="modal-rodape" id="gerar-rodape">
      <button class="btn" data-fechar>Cancelar</button>
      <button class="btn primario" id="gerar-ok">${ICONES.ia} Gerar com IA</button>
    </div>`);
  $('#gerar-ok').onclick = () => gerar(mes, $('#gerar-instr').value.trim());
}

async function gerar(mes, instrucoes) {
  const frases = ['Lendo as regras e o cadastro…', 'Distribuindo as funções…', 'Conferindo limites de cada obreiro…', 'Revisando a escala…', 'Quase pronto…'];
  $('#gerar-corpo').innerHTML = `<div class="gerando"><div class="roda"></div><strong id="gerar-frase">${frases[0]}</strong><p class="sub">Isso leva cerca de 1 minuto. Pode deixar esta tela aberta.</p></div>`;
  $('#gerar-rodape').hidden = true;
  let i = 0;
  const timer = setInterval(() => { i = Math.min(i + 1, frases.length - 1); const el = $('#gerar-frase'); if (el) el.textContent = frases[i]; }, 12000);
  try {
    const r = await api(`/api/escalas/${mes}/gerar`, { method: 'POST', body: { instrucoes } });
    clearInterval(timer);
    ui.mudou = new Set();
    ui.aba = 'escala';
    await carregar(mes);
    irPara('escala');
    $('#gerar-corpo').innerHTML = `
      <div class="gerando" style="padding:10px 0 0">
        ${r.validacao.ok ? `<span class="pilula ok">${ICONES.ok} Escala pronta e dentro das regras</span>` : `<span class="pilula alerta">${ICONES.alerta} Pronta, com ${r.validacao.erros.length} pendência(s)</span>`}
      </div>
      ${r.resumo ? `<p style="margin:0">${esc(r.resumo)}</p>` : ''}
      ${r.validacao.ok ? '' : `<ul class="sub">${r.validacao.erros.map(e => `<li>${esc(e)}</li>`).join('')}</ul><p class="sub">Peça ao assistente para resolver as pendências.</p>`}`;
    $('#gerar-rodape').hidden = false;
    $('#gerar-rodape').innerHTML = '<button class="btn primario" data-fechar>Ver escala</button>';
  } catch (e) {
    clearInterval(timer);
    $('#gerar-corpo').innerHTML = `<div class="aviso urgente" style="margin:0"><div class="ic">${ICONES.alerta}</div><p>Não deu certo.<small>${esc(e.message)}</small></p></div>`;
    $('#gerar-rodape').hidden = false;
    $('#gerar-rodape').innerHTML = `<button class="btn" data-fechar>Fechar</button><button class="btn primario" id="gerar-ok">Tentar de novo</button>`;
    $('#gerar-ok').onclick = () => gerar(mes, instrucoes);
  }
}

// ---------------- Exportar ----------------
function textoWhatsApp() {
  const linhas = [`*${S.config.titulo_escala} – ${E.nomeMes(ui.mes)}*`, `_${S.config.igreja}_`, ''];
  for (const c of S.escala.cultos) {
    linhas.push(`📅 *${E.dataBR(c.data).slice(0, 5)} (${E.DIAS[E.diaSemana(c.data)]}) – ${c.culto}*${c.obs ? ` _(${c.obs})_` : ''}`);
    for (const f of S.config.funcoes) linhas.push(`${f.nome}: ${E.linhasCelula(c, f, S.config, ui.mapa).join(' / ') || '—'}`);
    linhas.push('');
  }
  return linhas.join('\n').trim();
}

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const t = document.createElement('textarea');
    t.value = texto;
    t.style.position = 'fixed';
    t.style.opacity = '0';
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  }
}

function quebrar(ctx, texto, largura) {
  const saida = [];
  for (const parte of String(texto).split('\n')) {
    let linha = '';
    for (const palavra of parte.split(' ')) {
      const teste = linha ? linha + ' ' + palavra : palavra;
      if (ctx.measureText(teste).width > largura && linha) { saida.push(linha); linha = palavra; } else linha = teste;
    }
    saida.push(linha);
  }
  return saida;
}

function desenharImagem() {
  const cfg = S.config;
  const larguras = { direcao: 135, pregacao: 165, ofertas: 115, finalizacao: 280 };
  const cols = [{ t: 'Data', w: 165 }, { t: 'Culto', w: 165 }, ...cfg.funcoes.map(f => ({ t: f.nome.toUpperCase() === 'DIREÇÃO' ? f.nome : f.nome, w: larguras[f.id] || 150, f }))];
  const margem = 24;
  const W = cols.reduce((s, c) => s + c.w, 0) + margem * 2;
  const fonte = '"Inter", "Roboto", Arial, sans-serif';
  const medida = document.createElement('canvas').getContext('2d');
  medida.font = `15px ${fonte}`;
  const LH = 25;
  const linhas = S.escala.cultos.map(c => {
    const celulas = [E.rotuloData(c.data), c.culto + (c.obs ? `\n(${c.obs})` : ''), ...cfg.funcoes.map(f => E.linhasCelula(c, f, cfg, ui.mapa).join('\n'))];
    const quebradas = celulas.map((t, i) => quebrar(medida, t, cols[i].w - 12));
    return { quebradas, h: Math.max(...quebradas.map(q => q.length)) * LH + 10 };
  });
  const topo = 90;
  const H = topo + 34 + linhas.reduce((s, l) => s + l.h, 0) + margem;
  const k = 2;
  const cv = document.createElement('canvas');
  cv.width = W * k;
  cv.height = H * k;
  const ctx = cv.getContext('2d');
  ctx.scale(k, k);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  // Título
  const [ano, mes] = ui.mes.split('-');
  const partes = [[`${cfg.titulo_escala} - `, '#111'], [E.MESES[Number(mes) - 1].toUpperCase(), '#16a34a'], [` ${ano}`, '#111']];
  ctx.font = `600 30px ${fonte}`;
  const total = partes.reduce((s, [t]) => s + ctx.measureText(t).width, 0);
  let x = (W - total) / 2;
  ctx.textBaseline = 'middle';
  for (const [t, cor] of partes) { ctx.fillStyle = cor; ctx.fillText(t, x, 48); x += ctx.measureText(t).width; }
  // Cabeçalho
  let y = topo;
  ctx.fillStyle = '#7a0000';
  ctx.fillRect(margem, y, W - margem * 2, 34);
  ctx.fillStyle = '#fff';
  ctx.font = `500 15px ${fonte}`;
  ctx.textAlign = 'center';
  x = margem;
  for (const c of cols) { ctx.fillText(c.t, x + c.w / 2, y + 17); x += c.w; }
  y += 34;
  // Linhas
  ctx.font = `15px ${fonte}`;
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  for (const l of linhas) {
    x = margem;
    l.quebradas.forEach((q, i) => {
      ctx.strokeRect(x + .5, y + .5, cols[i].w, l.h);
      ctx.fillStyle = '#111';
      q.forEach((t, j) => ctx.fillText(t, x + cols[i].w / 2, y + 5 + LH / 2 + j * LH));
      x += cols[i].w;
    });
    y += l.h;
  }
  return cv;
}

async function exportarImagem() {
  const cv = desenharImagem();
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const nome = `escala-${ui.mes}.png`;
  const arquivo = new File([blob], nome, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
    try { await navigator.share({ files: [arquivo], title: `Escala ${E.nomeMes(ui.mes)}` }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Imagem baixada');
}

// ---------------- Tela: Obreiros ----------------
function iniciais(o) {
  return (o.nome || '?').split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function textoLimite(o) {
  const l = o.limites || {};
  const p = [];
  if (l.tarefas_mes != null) p.push(`${l.tarefas_mes} tarefas/mês`);
  if (l.cultos_mes != null) p.push(`${l.cultos_mes} cultos/mês`);
  for (const [k, v] of Object.entries(l.por_funcao || {})) p.push(`${v}x ${(S.config.funcoes.find(f => f.id === k) || { nome: k }).nome.toLowerCase()}`);
  return p.join(' · ');
}

function gradeObreiros() {
  const termo = ui.busca.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const lista = S.obreiros
    .filter(o => ui.filtro === 'todos' || o.status === ui.filtro)
    .filter(o => !termo || [o.nome, o.titulo, o.nome_completo, o.telefone, o.whatsapp_nome, o.cargo].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(termo))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  if (!lista.length) return '<div class="vazio">Nenhum obreiro encontrado.</div>';
  return lista.map(o => {
    const lim = textoLimite(o);
    const ind = (o.indisponibilidades || []).find(i => (i.fim || i.inicio) >= S.hoje);
    return `<button class="cartao obreiro" data-obreiro="${o.id}">
      <div class="avatar">${esc(iniciais(o))}</div>
      <div class="info">
        <strong>${esc(E.nomeCurto(o))}</strong>
        <div class="linha">${esc([o.cargo, o.telefone].filter(Boolean).join(' · ') || o.nome_completo || 'Sem contato cadastrado')}</div>
        <div class="chips">
          ${o.status !== 'ativo' ? `<span class="chip st-${o.status.replace(' ', '-')}">${esc(o.status)}</span>` : ''}
          ${(o.funcoes || []).map(f => `<span class="chip f">${esc((S.config.funcoes.find(x => x.id === f) || { nome: f }).nome)}</span>`).join('')}
          ${lim ? `<span class="chip">máx ${esc(lim)}</span>` : ''}
          ${ind ? `<span class="chip st-a-confirmar">fora ${E.dataBR(ind.inicio).slice(0, 5)}–${E.dataBR(ind.fim || ind.inicio).slice(0, 5)}</span>` : ''}
        </div>
      </div>
    </button>`;
  }).join('');
}

function telaObreiros() {
  const cont = st => S.obreiros.filter(o => st === 'todos' || o.status === st).length;
  const seg = [['ativo', 'Ativos'], ['a confirmar', 'A confirmar'], ['inativo', 'Inativos'], ['todos', 'Todos']];
  return `<div class="cabeca">
      <div><h1>Obreiros</h1><p class="sub" style="margin:2px 0 0">${cont('ativo')} ativos na escala · os dados pessoais ficam no cadastro de Membros</p></div>
      <div class="direita"><button class="btn primario" data-novo-obreiro>${ICONES.mais} Adicionar obreiro</button></div>
    </div>
    <div class="barra-filtros">
      <label class="busca">${ICONES.busca}<input id="busca" class="busca-campo" placeholder="Buscar obreiro…" value="${esc(ui.busca)}"></label>
      <div class="segmentos">${seg.map(([v, t]) => `<button data-filtro="${v}" class="${ui.filtro === v ? 'ativa' : ''}">${t} <span class="sub">${cont(v)}</span></button>`).join('')}</div>
    </div>
    <div class="grade-obreiros" id="grade">${gradeObreiros()}</div>`;
}

// Escolher qual membro vai virar obreiro
function abrirNovoObreiro() {
  const ja = new Set(S.obreiros.map(o => o.membro_id));
  const livres = S.membros.filter(m => !ja.has(m.id) && m.status === 'ativo').sort((a, b) => a.nome.localeCompare(b.nome));
  modal(`
    <div class="modal-cab"><h2>Adicionar obreiro</h2><button class="icone" data-fechar>${ICONES.x}</button></div>
    <div class="modal-corpo">
      <p class="sub" style="margin:0 0 12px">Escolha o membro que vai servir na escala. Se a pessoa ainda não está cadastrada, cadastre primeiro como membro.</p>
      <label class="busca">${ICONES.busca}<input class="busca-campo" id="busca-escolha" placeholder="Buscar membro…"></label>
      <div class="escolha-lista" id="escolha-lista">${livres.map(m => `<button data-escolher-membro="${m.id}" data-nome="${esc((m.nome + ' ' + m.nome_completo).toLowerCase())}">
        <div class="avatar">${esc(iniciais(m))}</div><div><strong>${esc(E.nomeCurto(m))}</strong><small>${esc(m.cargo || 'Membro')}</small></div></button>`).join('') || '<p class="vazio-mini">Todos os membros ativos já são obreiros.</p>'}</div>
    </div>
    <div class="modal-rodape"><button class="btn esquerda" data-novo-membro>${ICONES.mais} Cadastrar novo membro</button><button class="btn" data-fechar>Cancelar</button></div>`);
}

async function tornarObreiro(membroId) {
  try {
    const o = await api('/api/obreiros', { method: 'POST', body: { membro_id: membroId } });
    await carregar(ui.mes, { manterChat: true });
    if (ui.secao !== 'escala' || ui.aba !== 'obreiros') irSecao('escala', { aba: 'obreiros' });
    toast('Agora defina o que ele(a) faz nos cultos');
    abrirObreiro(o.id);
  } catch (e) { toast(e.message, 4500); }
}

function abrirObreiro(id) {
  const o = clone(S.obreiros.find(x => x.id === id));
  o.limites = o.limites || { por_funcao: {} };
  o.limites.por_funcao = o.limites.por_funcao || {};
  ui.rasc = o;
  modal(htmlObreiro(o));
}

function htmlIndisponibilidades(o) {
  return o.indisponibilidades.map((i, n) => `<div class="item" data-ind="${n}">
      <input type="date" data-ind-campo="inicio" value="${esc(i.inicio)}" aria-label="Início">
      <input type="date" data-ind-campo="fim" value="${esc(i.fim || '')}" aria-label="Fim">
      <input data-ind-campo="motivo" value="${esc(i.motivo || '')}" placeholder="Motivo (viagem, férias…)">
      <button type="button" class="icone" data-del-ind="${n}" aria-label="Remover">${ICONES.lixo}</button>
    </div>`).join('') || '<p class="dica" style="margin:0">Nenhum período cadastrado.</p>';
}

function htmlObreiro(o) {
  const outros = S.obreiros.filter(x => x.id !== o.id).sort((a, b) => a.nome.localeCompare(b.nome));
  const uso = S.validacao && S.validacao.uso[o.id];
  const m = ui.mapaM[o.membro_id] || {};
  return `
    <div class="modal-cab"><div class="avatar">${esc(iniciais(o))}</div><h2>${esc(E.nomeCurto(o))}</h2><button class="icone" data-fechar>${ICONES.x}</button></div>
    <form class="modal-corpo form" id="form-obreiro" autocomplete="off">
      <div class="resumo-membro">
        <div class="info"><strong>${esc(m.nome_completo || E.nomeCurto(o))}</strong>${esc([m.cargo, m.telefone].filter(Boolean).join(' · ') || 'Sem telefone cadastrado')}${uso ? ` · em ${esc(E.nomeMes(ui.mes))}: ${uso.tarefas} tarefa(s)` : ''}</div>
        <button type="button" class="btn pequeno" data-ver-membro="${o.membro_id}">Dados pessoais</button>
      </div>
      <fieldset><legend>Situação na escala</legend>
        <select name="status">${['ativo', 'a confirmar', 'inativo'].map(s => `<option ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      </fieldset>
      <fieldset><legend>O que pode fazer nos cultos</legend>
        <div class="alternar">${S.config.funcoes.map(f => `<button type="button" data-tg-funcao="${f.id}" class="${o.funcoes.includes(f.id) ? 'on' : ''}">${esc(f.nome)}</button>`).join('')}</div>
      </fieldset>
      <fieldset><legend>Dias disponíveis<small>Nenhum marcado = pode em qualquer dia.</small></legend>
        <div class="alternar">${E.DIAS.map((d, i) => `<button type="button" data-tg-dia="${i}" class="${o.dias.includes(i) ? 'on' : ''}">${d}</button>`).join('')}</div>
      </fieldset>
      <fieldset><legend>Limites por mês<small>Em branco = sem limite. Cada função em cada culto conta como 1 tarefa.</small></legend>
        <div class="limites">
          <label class="campo"><span>Tarefas no mês</span><input type="number" min="0" name="tarefas_mes" value="${o.limites.tarefas_mes ?? ''}" placeholder="∞"></label>
          <label class="campo"><span>Cultos no mês</span><input type="number" min="0" name="cultos_mes" value="${o.limites.cultos_mes ?? ''}" placeholder="∞"></label>
          ${S.config.funcoes.map(f => `<label class="campo"><span>${esc(f.nome)}</span><input type="number" min="0" name="lim_${f.id}" value="${o.limites.por_funcao[f.id] ?? ''}" placeholder="∞"></label>`).join('')}
        </div>
      </fieldset>
      <fieldset><legend>Casal / dupla<small>Usado quando a função é feita em casal (ex.: oração pelas famílias).</small></legend>
        <select name="parceiro_id"><option value="">Ninguém</option>${outros.map(x => `<option value="${x.id}" ${o.parceiro_id === x.id ? 'selected' : ''}>${esc(E.nomeCurto(x))}</option>`).join('')}</select>
      </fieldset>
      <fieldset><legend>Indisponibilidades<small>Viagens, férias, compromissos — a IA não escala nesses dias.</small></legend>
        <div class="lista-mini" id="lista-ind">${htmlIndisponibilidades(o)}</div>
        <div><button type="button" class="btn pequeno" data-add-ind>${ICONES.mais} Adicionar período</button></div>
      </fieldset>
      <fieldset><legend>Regras específicas<small>Texto livre que a IA segue. Ex.: “prefere pregar no domingo”, “não dirigir no 1º domingo”.</small></legend>
        <textarea name="regras" rows="3">${esc(o.regras)}</textarea>
      </fieldset>
      <fieldset><legend>Observações</legend>
        <textarea name="observacoes" rows="2">${esc(o.observacoes)}</textarea>
      </fieldset>
    </form>
    <div class="modal-rodape">
      <button class="btn perigo esquerda" data-excluir-obreiro>${ICONES.lixo} Tirar da escala</button>
      <button class="btn" data-fechar>Cancelar</button>
      <button class="btn primario" data-salvar-obreiro>Salvar</button>
    </div>`;
}

function lerIndisponibilidades() {
  document.querySelectorAll('#lista-ind [data-ind]').forEach(linha => {
    const i = ui.rasc.indisponibilidades[Number(linha.dataset.ind)];
    linha.querySelectorAll('[data-ind-campo]').forEach(inp => { i[inp.dataset.indCampo] = inp.value; });
  });
}

async function salvarObreiro() {
  const f = $('#form-obreiro');
  const o = ui.rasc;
  const val = n => (f.elements[n] ? f.elements[n].value.trim() : '');
  const num = n => (val(n) === '' ? null : Number(val(n)));
  lerIndisponibilidades();
  const dados = {
    status: val('status'), funcoes: o.funcoes, dias: o.dias, parceiro_id: val('parceiro_id') || null,
    limites: { tarefas_mes: num('tarefas_mes'), cultos_mes: num('cultos_mes'), por_funcao: Object.fromEntries(S.config.funcoes.map(fn => [fn.id, num('lim_' + fn.id)])) },
    indisponibilidades: o.indisponibilidades.filter(i => i.inicio),
    regras: val('regras'), observacoes: val('observacoes'),
  };
  try {
    const r = await api(`/api/obreiros/${o.id}`, { method: 'PUT', body: dados });
    toast(r.aplicado ? 'Salvo e registrado no histórico' : 'Nada mudou');
    fecharModal();
    await carregar(ui.mes, { manterChat: true });
  } catch (e) {
    toast(e.message, 4500);
  }
}

// ---------------- Tela: Regras ----------------
function telaRegras() {
  if (!ui.rcfg) ui.rcfg = clone(S.config);
  const c = ui.rcfg;
  const regras = S.config.regras_gerais;
  const ordinais = { '1': '1º', '2': '2º', '3': '3º', '4': '4º', '5': '5º', ultimo: 'Último' };
  const alterado = JSON.stringify(c) !== JSON.stringify(S.config);
  return `<div class="cabeca"><div><h1>Regras</h1><p class="sub" style="margin:2px 0 0">A IA segue estas regras para montar e alterar as escalas. As regras de cada pessoa ficam no cadastro de Obreiros.</p></div></div>

    <div class="secao" style="margin-top:0">
      <h2>Regras gerais do pastor</h2>
      <p class="sub">Escreva do jeito que você explicaria para alguém. Desative uma regra para a IA ignorá-la temporariamente.</p>
      <div class="cartao">
        ${regras.map((r, i) => `<div class="regra ${r.ativa === false ? 'inativa' : ''}" data-regra="${r.id}">
          <span class="num">${i + 1}</span>
          <div class="texto" id="texto-${r.id}">${esc(r.texto)}</div>
          <div class="acoes">
            <button class="interruptor ${r.ativa !== false ? 'on' : ''}" data-regra-acao="${r.ativa !== false ? 'desativar' : 'ativar'}" title="${r.ativa !== false ? 'Desativar' : 'Ativar'}" aria-label="Ativar ou desativar"></button>
            <button class="icone" data-regra-acao="editar" title="Editar" aria-label="Editar">${ICONES.lapis}</button>
            <button class="icone" data-regra-acao="remover" title="Remover" aria-label="Remover">${ICONES.lixo}</button>
          </div>
        </div>`).join('') || '<div class="vazio">Nenhuma regra geral.</div>'}
        <div class="nova-regra">
          <textarea id="nova-regra" rows="1" placeholder="Nova regra. Ex.: no último domingo do mês a pregação é compartilhada entre vários obreiros."></textarea>
          <button class="btn primario" data-add-regra>${ICONES.mais} Adicionar</button>
        </div>
      </div>
    </div>

    <div class="secao">
      <h2>Tipos de culto</h2>
      <p class="sub">Quais cultos existem em cada dia da semana, como a finalização aparece na tabela e quantas pessoas cada função pode ter.</p>
      ${c.tipos_culto.map((t, ti) => `<div class="cartao tipo-culto">
        <h3><button class="interruptor ${t.ativo !== false ? 'on' : ''}" data-tg-tipo="${ti}" aria-label="Ativar tipo"></button>${esc(t.nome)}</h3>
        <div class="campos">
          <label class="campo"><span>Nome do culto</span><input data-bind="tipos_culto.${ti}.nome" value="${esc(t.nome)}"></label>
          <label class="campo"><span>Dia da semana</span><select data-bind-num="tipos_culto.${ti}.dia_semana">${E.DIAS.map((d, i) => `<option value="${i}" ${t.dia_semana === i ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
        </div>
        <div class="lista-mini" style="margin-top:12px">
          <span class="dica">Nomes especiais (ex.: 1º domingo = CEIA DO SENHOR)</span>
          ${Object.entries(t.nome_por_ocorrencia || {}).map(([k, v]) => `<div class="item" style="grid-template-columns:140px 1fr auto">
            <select data-oc-chave="${ti}|${k}">${Object.entries(ordinais).map(([ok, ot]) => `<option value="${ok}" ${ok === k ? 'selected' : ''}>${ot} ${E.DIAS[t.dia_semana].toLowerCase()}</option>`).join('')}</select>
            <input data-oc-valor="${ti}|${k}" value="${esc(v)}">
            <button class="icone" data-oc-del="${ti}|${k}" aria-label="Remover">${ICONES.lixo}</button>
          </div>`).join('')}
          <div><button class="btn pequeno" data-oc-add="${ti}">${ICONES.mais} Nome especial</button></div>
        </div>
        <table class="tabela-funcoes" style="margin-top:12px">
          <tr><th>Função</th><th>Mín.</th><th>Máx.</th><th>Como aparece na tabela <span class="dica">(use <code>{pessoas}</code>)</span></th></tr>
          ${c.funcoes.map(f => {
            const r = (t.funcoes || {})[f.id] || {};
            return `<tr><td>${esc(f.nome)}</td>
              <td><input type="number" min="0" data-tipo-fn="${ti}|${f.id}|min" value="${r.min ?? ''}" placeholder="${f.min ?? 1}"></td>
              <td><input type="number" min="0" data-tipo-fn="${ti}|${f.id}|max" value="${r.max ?? ''}" placeholder="${f.max ?? 1}"></td>
              <td><input data-tipo-modelo="${ti}|${f.id}" value="${esc((t.modelos || {})[f.id] || '')}" placeholder="padrão: só os nomes"></td></tr>`;
          }).join('')}
        </table>
      </div>`).join('')}
    </div>

    <div class="secao">
      <h2>Funções e avisos</h2>
      <p class="sub">Colunas da escala e quantidade padrão de pessoas em cada uma.</p>
      <div class="cartao tipo-culto">
        <table class="tabela-funcoes">
          <tr><th>Nome</th><th>Mín.</th><th>Máx.</th></tr>
          ${c.funcoes.map((f, fi) => `<tr><td><input data-bind="funcoes.${fi}.nome" value="${esc(f.nome)}"></td>
            <td><input type="number" min="0" data-bind-num="funcoes.${fi}.min" value="${f.min ?? 1}"></td>
            <td><input type="number" min="0" data-bind-num="funcoes.${fi}.max" value="${f.max ?? 1}"></td></tr>`).join('')}
        </table>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><input id="nova-funcao" placeholder="Nova função (ex.: Louvor)" style="max-width:260px"><button class="btn pequeno" data-add-funcao>${ICONES.mais} Adicionar função</button></div>
        <label class="campo" style="margin-top:16px;max-width:320px"><span>Avisar quantos dias antes do fim do mês?</span><input type="number" min="1" max="20" data-bind-num="aviso_dias_antes" value="${c.aviso_dias_antes ?? 5}"></label>
      </div>
    </div>
    <div class="barra-salvar" id="barra-salvar" ${alterado ? '' : 'hidden'}>
      <span>Há alterações não salvas</span>
      <button class="btn" data-cfg-descartar>Descartar</button>
      <button class="btn primario" data-cfg-salvar>Salvar configurações</button>
    </div>`;
}

function definir(obj, caminho, valor) {
  const p = caminho.split('.');
  let o = obj;
  for (let i = 0; i < p.length - 1; i++) o = o[p[i]];
  o[p[p.length - 1]] = valor;
}

function renderRegrasMantendoScroll() {
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
}

// ---------------- Tela: Histórico ----------------
async function carregarHistorico() {
  try { ui.historico = await api(`/api/historico?mes=${ui.mes}`); } catch { ui.historico = { escala: [], regras: [] }; }
}

function horaBR(iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function diaBR(iso) {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(Date.now() - 864e5);
  if (d.toDateString() === hoje.toDateString()) return 'Hoje';
  if (d.toDateString() === ontem.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}
const ORIGENS = { chat: 'Assistente IA', tela: 'Pela tela', desfazer: 'Desfeito', sistema: 'Sistema' };

function eventoHTML(h, tipoLista) {
  const origem = `<span class="origem o-${h.origem}">${ORIGENS[h.origem] || h.origem}</span>`;
  const podeDesfazer = tipoLista === 'escala' && !h.desfeito_por && (h.tipo === 'atribuicao' || h.tipo === 'culto' && h.acao !== 'restaurado' || h.tipo === 'geracao' && h.versao_idx != null);
  const lado = `<div class="lado">${origem}${podeDesfazer ? `<button class="btn pequeno" data-desfazer="${h.id}">${ICONES.desfazer} Desfazer</button>` : ''}${h.desfeito_por ? '<span class="sub">desfeita</span>' : ''}</div>`;
  const meta = [
    h.motivo ? `Motivo: ${esc(h.motivo)}` : '',
    h.pedido ? `Pedido: <q>${esc(h.pedido.length > 160 ? h.pedido.slice(0, 160) + '…' : h.pedido)}</q>` : '',
    h.instrucoes ? `Instruções: <q>${esc(h.instrucoes)}</q>` : '',
    (h.violou_regras || []).length ? `⚠ Aplicado mesmo quebrando: ${esc(h.violou_regras.join('; '))}` : '',
    (h.pendencias || []).length ? `Pendências na geração: ${esc(h.pendencias.join('; '))}` : '',
  ].filter(Boolean).join('<br>');
  let titulo;
  let diff = '';
  if (h.tipo === 'atribuicao') {
    titulo = `${E.dataBR(h.data).slice(0, 5)} · ${esc(h.culto)} · ${esc(h.funcao_nome)}`;
    diff = `<div class="diff"><span class="antes">${esc(h.antes.texto)}</span>→<span class="depois">${esc(h.depois.texto)}</span></div>`;
  } else if (h.tipo === 'obreiro' && (h.mudancas || []).length) {
    titulo = esc(h.resumo);
    diff = h.mudancas.map(m => `<div class="diff"><b style="font-weight:500">${esc(m.campo)}:</b><span class="antes">${esc(m.antes)}</span>→<span class="depois">${esc(m.depois)}</span></div>`).join('');
  } else if (h.tipo === 'regra') {
    titulo = esc(h.resumo);
    if (h.acao === 'editar') diff = `<div class="diff"><span class="antes">${esc(h.antes)}</span>→<span class="depois">${esc(h.depois)}</span></div>`;
    else diff = `<div class="diff"><span class="${h.acao === 'remover' ? 'antes' : 'depois'}">${esc(h.depois || h.antes)}</span></div>`;
  } else {
    titulo = esc(h.resumo || h.tipo);
  }
  return `<div class="evento ${h.desfeito_por ? 'desfeito' : ''}">
    <span class="hora">${horaBR(h.quando)}</span>
    <div class="corpo">
      <div class="titulo">${titulo}</div>
      ${diff}
      ${meta ? `<div class="meta">${meta}</div>` : ''}
    </div>
    ${lado}
  </div>`;
}

function telaHistorico() {
  const hist = ui.historico || { escala: [], regras: [] };
  const lista = (ui.histAba === 'escala' ? hist.escala : hist.regras).slice().sort((a, b) => b.quando.localeCompare(a.quando));
  const grupos = [];
  for (const h of lista) {
    const d = diaBR(h.quando);
    if (!grupos.length || grupos[grupos.length - 1].d !== d) grupos.push({ d, itens: [] });
    grupos[grupos.length - 1].itens.push(h);
  }
  return `<div class="cabeca">
      ${ui.histAba === 'escala' ? navMes() : '<h1>Histórico</h1>'}
      <div class="direita"><div class="segmentos">
        <button data-hist="escala" class="${ui.histAba === 'escala' ? 'ativa' : ''}">Escala do mês</button>
        <button data-hist="regras" class="${ui.histAba === 'regras' ? 'ativa' : ''}">Regras e cadastros</button>
      </div></div>
    </div>
    <p class="sub" style="margin-top:-8px">${ui.histAba === 'escala' ? 'Tudo o que mudou na escala depois de criada: antes → depois, quem pediu e por quê.' : 'Mudanças nas regras gerais, tipos de culto e no cadastro dos obreiros.'}</p>
    ${grupos.length ? grupos.map(g => `<div class="dia-hist"><h3>${esc(g.d)}</h3><div class="cartao">${g.itens.map(h => eventoHTML(h, ui.histAba)).join('')}</div></div>`).join('')
      : `<div class="cartao vazio"><h2>Nada registrado ainda</h2><p>${ui.histAba === 'escala' ? 'Quando a escala deste mês for alterada, cada mudança aparece aqui.' : 'Alterações de regras e cadastros aparecem aqui.'}</p></div>`}`;
}

// ---------------- Datas e aniversários ----------------
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const utc = d => { const [a, m, dd] = d.split('-').map(Number); return Date.UTC(a, m - 1, dd); };
const diasEntre = (a, b) => Math.round((utc(b) - utc(a)) / 864e5);
const somarDias = (d, n) => new Date(utc(d) + n * 864e5).toISOString().slice(0, 10);

function proximoAniversario(nasc, hoje) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nasc || '')) return null;
  const [an, m, d] = nasc.split('-');
  let ano = Number(hoje.slice(0, 4));
  let data = `${ano}-${m}-${d}`;
  if (data < hoje) data = `${++ano}-${m}-${d}`;
  return { data, dias: diasEntre(hoje, data), idade: ano - Number(an) };
}

function quandoTexto(dias) {
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  return `em ${dias} dias`;
}

function dataMini(data, destaque) {
  const [, m, d] = data.split('-').map(Number);
  return `<div class="data-mini ${destaque ? 'hoje' : ''}"><b>${d}</b><span>${MESES_CURTOS[m - 1]}</span></div>`;
}

function linkWhats(tel, texto) {
  const dig = String(tel || '').replace(/\D/g, '');
  if (dig.length < 10) return '';
  return `https://wa.me/${dig.startsWith('55') ? dig : '55' + dig}?text=${encodeURIComponent(texto)}`;
}

// ---------------- Tela: Painel ----------------
function telaPainel() {
  const h = new Date().getHours();
  const saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const dataLonga = new Date(S.hoje + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const ativos = S.membros.filter(m => m.status === 'ativo');
  const obreirosAtivos = S.obreiros.filter(o => o.status === 'ativo');
  const anivers = S.membros.filter(m => m.status !== 'inativo').map(m => ({ m, a: proximoAniversario(m.nascimento, S.hoje) }))
    .filter(x => x.a && x.a.dias <= 30).sort((x, y) => x.a.dias - y.a.dias);
  const doMes = S.membros.filter(m => m.status !== 'inativo' && (m.nascimento || '').slice(5, 7) === S.hoje.slice(5, 7)).length;
  const limite30 = somarDias(S.hoje, 30);
  const eventos = S.eventos.filter(e => (e.data_fim || e.data_inicio) >= S.hoje).sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
  const eventos30 = eventos.filter(e => e.data_inicio <= limite30).length;
  const semNasc = ativos.filter(m => !m.nascimento).length;
  const semTel = ativos.filter(m => !m.telefone).length;

  const estat = (ic, rot, num, sub, ir) => `<button class="estat" data-ir="${ir}"><span class="rotulo">${ic}${rot}</span><div class="numero">${num}</div><small>${sub}</small></button>`;

  const blocoAniver = anivers.length ? anivers.slice(0, 6).map(({ m, a }) => {
    const zap = linkWhats(m.telefone, `Feliz aniversário, ${m.nome}! 🎉 Que Deus te abençoe grandemente neste novo ano de vida. — Igreja Palavra Viva`);
    return `<div class="linha-item">${dataMini(a.data, a.dias === 0)}
      <div class="info"><strong>${esc(E.nomeCurto(m))}${a.dias === 0 ? '<span class="selo-hoje">hoje</span>' : ''}</strong><small>Faz ${a.idade} anos ${quandoTexto(a.dias)}</small></div>
      ${zap ? `<a class="btn pequeno" href="${zap}" target="_blank" rel="noopener">Parabenizar</a>` : ''}</div>`;
  }).join('') : `<p class="vazio-mini">Nenhum aniversário nos próximos 30 dias${semNasc ? ` — ${semNasc} membro(s) ainda sem data de nascimento.` : '.'}</p>`;

  const blocoCultos = (S.proximos_cultos || []).length ? S.proximos_cultos.slice(0, 5).map(c => {
    const preg = E.linhasCelula(c, S.config.funcoes.find(f => f.id === 'pregacao') || S.config.funcoes[0], S.config, ui.mapa).join(' / ') || 'a definir';
    const dir = E.linhasCelula(c, S.config.funcoes.find(f => f.id === 'direcao') || S.config.funcoes[0], S.config, ui.mapa).join(' / ') || 'a definir';
    return `<div class="linha-item" style="cursor:pointer" data-ir="escala" data-ir-mes="${c.data.slice(0, 7)}">${dataMini(c.data, c.data === S.hoje)}
      <div class="info"><strong>${esc(c.culto)} · ${E.DIAS[E.diaSemana(c.data)]}</strong><small>Pregação: ${esc(preg)} · Direção: ${esc(dir)}</small></div></div>`;
  }).join('') : '<p class="vazio-mini">Nenhum culto escalado à frente. Gere a escala do próximo mês.</p>';

  const blocoEventos = eventos.length ? eventos.slice(0, 5).map(e => `<div class="linha-item" style="cursor:pointer" data-evento="${e.id}">${dataMini(e.data_inicio, e.data_inicio === S.hoje)}
      <div class="info"><strong>${esc(e.titulo)}</strong><small>${esc([e.hora_inicio && e.hora_inicio.replace(':', 'h'), e.local, e.publico ? 'no site' : 'interno'].filter(Boolean).join(' · '))}</small></div></div>`).join('')
    : '<p class="vazio-mini">Nenhum evento marcado.</p>';

  return `<div class="saudacao"><h1 class="titulo-pagina">${saud}, Pastor</h1><p>${esc(dataLonga.charAt(0).toUpperCase() + dataLonga.slice(1))}</p></div>
    ${telaAvisos()}
    <div class="estatisticas">
      ${estat(ICONES.pessoas, 'Membros ativos', ativos.length, `${S.membros.length} no cadastro`, 'membros')}
      ${estat(ICONES.maos, 'Obreiros na escala', obreirosAtivos.length, `${S.obreiros.length} no total`, 'escala:obreiros')}
      ${estat(ICONES.bolo, 'Aniversariantes do mês', doMes, `${anivers.length} nos próximos 30 dias`, 'membros')}
      ${estat(ICONES.calendario, 'Eventos em 30 dias', eventos30, `${eventos.length} marcados à frente`, 'calendario')}
    </div>
    <div class="grade-painel">
      <section class="cartao bloco"><div class="bloco-cab"><h2>Aniversariantes</h2><button data-ir="membros">Ver membros</button></div>${blocoAniver}</section>
      <section class="cartao bloco"><div class="bloco-cab"><h2>Próximos cultos</h2><button data-ir="escala">Abrir escala</button></div>${blocoCultos}</section>
      <section class="cartao bloco"><div class="bloco-cab"><h2>Próximos eventos</h2><button data-ir="calendario">Calendário</button></div>${blocoEventos}</section>
      <section class="cartao bloco"><div class="bloco-cab"><h2>Cadastros para completar</h2><button data-ir="membros:incompletos">Ver lista</button></div>
        ${semNasc || semTel ? `<div class="linha-item"><div class="info"><strong>${semNasc} sem data de nascimento</strong><small>Sem a data, o painel não avisa o aniversário.</small></div></div>
        <div class="linha-item"><div class="info"><strong>${semTel} sem telefone</strong><small>O telefone é usado para parabenizar e, no futuro, para avisos pelo WhatsApp.</small></div></div>`
        : '<p class="vazio-mini">Todos os cadastros ativos estão completos. 🙌</p>'}
      </section>
    </div>`;
}

// ---------------- Tela: Membros ----------------
const STATUS_MEMBRO = [['ativo', 'Ativos'], ['visitante', 'Visitantes'], ['afastado', 'Afastados'], ['inativo', 'Inativos'], ['incompletos', 'Incompletos'], ['todos', 'Todos']];

function filtrarMembros() {
  const termo = ui.membrosBusca.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return S.membros.filter(m => {
    if (ui.membrosFiltro === 'incompletos') { if (m.status !== 'ativo' || (m.nascimento && m.telefone)) return false; }
    else if (ui.membrosFiltro !== 'todos' && m.status !== ui.membrosFiltro) return false;
    if (ui.membrosCargo && m.cargo !== ui.membrosCargo) return false;
    return !termo || [m.nome, m.nome_completo, m.titulo, m.telefone, m.whatsapp_nome, m.cargo, m.bairro].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(termo);
  }).sort((a, b) => a.nome.localeCompare(b.nome));
}

function listaMembros() {
  const lista = filtrarMembros();
  const obreiro = new Set(S.obreiros.map(o => o.membro_id));
  if (!lista.length) return '<div class="vazio">Nenhum membro encontrado.</div>';
  return `<div class="membro-linha cab"><span>Nome</span><span>Cargo</span><span>Aniversário</span><span>Situação</span></div>` + lista.map(m => {
    const a = proximoAniversario(m.nascimento, S.hoje);
    const aniv = m.nascimento ? `${m.nascimento.slice(8, 10)}/${m.nascimento.slice(5, 7)}${a && a.dias <= 7 ? ` · ${quandoTexto(a.dias)}` : ''}` : '—';
    return `<button class="membro-linha" data-membro="${m.id}">
      <span class="pessoa"><span class="avatar">${esc(iniciais(m))}</span><span style="min-width:0"><strong>${esc(E.nomeCurto(m))}</strong><small>${esc(m.telefone || m.nome_completo || 'sem telefone')}</small></span></span>
      <span class="col">${esc(m.cargo || '—')}</span>
      <span class="col ${m.nascimento ? '' : 'suave'}">${esc(aniv)}</span>
      <span class="col mostrar-celular"><span class="chips" style="margin:0">${m.status !== 'ativo' ? `<span class="chip st-${m.status}">${esc(m.status)}</span>` : ''}${obreiro.has(m.id) ? '<span class="chip obreiro-sim">obreiro</span>' : ''}${m.status === 'ativo' && !obreiro.has(m.id) ? '<span class="chip">membro</span>' : ''}</span></span>
    </button>`;
  }).join('');
}

function telaMembros() {
  const cont = st => (st === 'todos' ? S.membros.length : st === 'incompletos' ? S.membros.filter(m => m.status === 'ativo' && (!m.nascimento || !m.telefone)).length : S.membros.filter(m => m.status === st).length);
  const contatos = S.contatos || [];
  return `<div class="cabeca">
      <div><h1>Membros</h1><p class="sub" style="margin:2px 0 0">${cont('ativo')} ativos · ${S.membros.length} no cadastro</p></div>
      <div class="direita"><button class="btn primario" data-novo-membro>${ICONES.mais} Novo membro</button></div>
    </div>
    <div class="barra-filtros">
      <label class="busca">${ICONES.busca}<input id="busca-membros" class="busca-campo" placeholder="Buscar por nome, telefone, bairro…" value="${esc(ui.membrosBusca)}"></label>
      <select id="filtro-cargo"><option value="">Todos os cargos</option>${S.config.cargos.map(c => `<option ${ui.membrosCargo === c.nome ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>
    </div>
    <div class="segmentos" style="margin-bottom:16px;width:fit-content">${STATUS_MEMBRO.map(([v, t]) => `<button data-mfiltro="${v}" class="${ui.membrosFiltro === v ? 'ativa' : ''}">${t} <span class="sub">${cont(v)}</span></button>`).join('')}</div>
    <div class="cartao lista-membros" id="lista-membros">${listaMembros()}</div>
    ${contatos.length ? `<div class="secao">
      <h2>Contatos do grupo para vincular</h2>
      <p class="sub">Pessoas do grupo do WhatsApp que ainda não foram ligadas a um cadastro. Vincule a um membro (copia o telefone e o nome do WhatsApp) ou cadastre como membro novo.</p>
      <div class="cartao">${contatos.map(c => `<div class="contato">
        <div class="info"><strong>${esc(c.whatsapp_nome)}</strong><small>${esc(c.telefone || 'sem número visível')}${c.obs ? ' · ' + esc(c.obs) : ''}</small></div>
        <select data-vincular="${c.id}"><option value="">Vincular a…</option>${S.membros.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map(m => `<option value="${m.id}">${esc(E.nomeCurto(m))}</option>`).join('')}</select>
        <button class="btn pequeno" data-contato="${c.id}" data-contato-acao="cadastrar">Cadastrar</button>
        <button class="icone" data-contato="${c.id}" data-contato-acao="descartar" title="Descartar" aria-label="Descartar">${ICONES.x}</button>
      </div>`).join('')}</div>
    </div>` : ''}`;
}

function tituloDoCargo(cargo, sexo) {
  const c = S.config.cargos.find(x => x.nome === cargo);
  if (!c) return '';
  return sexo === 'F' ? c.titulo_f : c.titulo_m;
}

function abrirMembro(id) {
  const m = id ? clone(S.membros.find(x => x.id === id)) : {
    id: null, nome: '', nome_completo: '', titulo: '', cargo: 'Membro', sexo: '', nascimento: '', estado_civil: '', conjuge_id: null,
    telefone: '', whatsapp_nome: '', email: '', endereco: '', bairro: '', cidade: '', cep: '', batismo: '', membro_desde: S.hoje, status: 'ativo', observacoes: '',
  };
  ui.rascM = m;
  const ob = id && S.obreiros.find(o => o.membro_id === id);
  const outros = S.membros.filter(x => x.id !== m.id).sort((a, b) => a.nome.localeCompare(b.nome));
  const campo = (nome, rotulo, tipo = 'text', extra = '') => `<label class="campo ${extra}"><span>${rotulo}</span><input type="${tipo}" name="${nome}" value="${esc(m[nome] ?? '')}"></label>`;
  const sel = (nome, rotulo, opcoes) => `<label class="campo"><span>${rotulo}</span><select name="${nome}">${opcoes.map(([v, t]) => `<option value="${esc(v)}" ${String(m[nome] ?? '') === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  const a = proximoAniversario(m.nascimento, S.hoje);
  modal(`
    <div class="modal-cab"><div class="avatar">${esc(m.id ? iniciais(m) : '+')}</div><h2>${m.id ? esc(E.nomeCurto(m)) : 'Novo membro'}</h2><button class="icone" data-fechar>${ICONES.x}</button></div>
    <form class="modal-corpo form" id="form-membro" autocomplete="off">
      ${a ? `<p class="sub" style="margin:0">${a.dias === 0 ? '🎉 Faz aniversário hoje!' : `Próximo aniversário ${quandoTexto(a.dias)} (${a.idade} anos)`}${ob ? ' · Obreiro(a) na escala' : ''}</p>` : ''}
      <fieldset><legend>Identificação</legend>
        <div class="campos">
          ${campo('nome', 'Como é chamado(a) *')}
          ${campo('nome_completo', 'Nome completo')}
          ${sel('sexo', 'Sexo', [['', '—'], ['F', 'Feminino'], ['M', 'Masculino']])}
          ${sel('status', 'Situação', [['ativo', 'Ativo'], ['visitante', 'Visitante'], ['afastado', 'Afastado'], ['inativo', 'Inativo']])}
          ${sel('cargo', 'Cargo', S.config.cargos.map(c => [c.nome, c.nome]).concat(m.cargo && !S.config.cargos.some(c => c.nome === m.cargo) ? [[m.cargo, m.cargo]] : []))}
          <label class="campo"><span>Título na escala <small>(Pr., Pra., Dc.…)</small></span><input name="titulo" list="lista-titulos" value="${esc(m.titulo)}"></label>
        </div>
        <datalist id="lista-titulos">${[...new Set(S.config.cargos.flatMap(c => [c.titulo_m, c.titulo_f]).filter(Boolean))].map(t => `<option value="${t}">`).join('')}</datalist>
      </fieldset>
      <fieldset><legend>Datas</legend>
        <div class="campos tres">${campo('nascimento', 'Nascimento', 'date')}${campo('batismo', 'Batismo', 'date')}${campo('membro_desde', 'Membro desde', 'date')}</div>
      </fieldset>
      <fieldset><legend>Família</legend>
        <div class="campos">
          ${sel('estado_civil', 'Estado civil', [['', '—'], ['Solteiro(a)', 'Solteiro(a)'], ['Casado(a)', 'Casado(a)'], ['Divorciado(a)', 'Divorciado(a)'], ['Viúvo(a)', 'Viúvo(a)'], ['União estável', 'União estável']])}
          ${sel('conjuge_id', 'Cônjuge (se for membro)', [['', 'Ninguém']].concat(outros.map(x => [x.id, E.nomeCurto(x)])))}
        </div>
      </fieldset>
      <fieldset><legend>Contato</legend>
        <div class="campos">${campo('telefone', 'Telefone / WhatsApp', 'tel')}${campo('email', 'E-mail', 'email')}${campo('whatsapp_nome', 'Nome no grupo do WhatsApp', 'text', 'largo')}</div>
      </fieldset>
      <fieldset><legend>Endereço</legend>
        <div class="campos">${campo('endereco', 'Rua, número e complemento', 'text', 'largo')}${campo('bairro', 'Bairro')}${campo('cidade', 'Cidade')}${campo('cep', 'CEP')}</div>
      </fieldset>
      <fieldset><legend>Observações</legend><textarea name="observacoes" rows="3">${esc(m.observacoes)}</textarea></fieldset>
    </form>
    <div class="modal-rodape">
      ${m.id ? `<button class="btn perigo esquerda" data-excluir-membro>${ICONES.lixo} Excluir</button>` : ''}
      ${m.id ? (ob ? `<button class="btn" data-ver-obreiro="${ob.id}">Ver na escala</button>` : `<button class="btn" data-tornar-obreiro="${m.id}">${ICONES.maos} Tornar obreiro</button>`) : ''}
      <button class="btn" data-fechar>Cancelar</button>
      <button class="btn primario" data-salvar-membro>Salvar</button>
    </div>`);
}

async function salvarMembro() {
  const f = $('#form-membro');
  const dados = {};
  for (const el of f.elements) if (el.name) dados[el.name] = el.value.trim();
  dados.conjuge_id = dados.conjuge_id || null;
  if (!dados.nome) return toast('Informe como a pessoa é chamada.');
  try {
    if (ui.rascM.id) {
      const r = await api(`/api/membros/${ui.rascM.id}`, { method: 'PUT', body: dados });
      toast(r.aplicado ? 'Cadastro salvo' : 'Nada mudou');
    } else {
      await api('/api/membros', { method: 'POST', body: dados });
      toast('Membro cadastrado');
    }
    fecharModal();
    await carregar(ui.mes, { manterChat: true });
  } catch (e) { toast(e.message, 4500); }
}

// ---------------- Tela: Calendário ----------------
const CATEGORIAS = ['Culto especial', 'Conferência', 'Evento', 'Reunião', 'Batismo', 'Santa Ceia', 'Retiro', 'Ação social', 'Aniversário da igreja', 'Outro'];

function cultosDoMesCal() {
  if (S.escala && S.escala.mes === ui.mesCal) return S.escala.cultos;
  return E.cultosDoMes(ui.mesCal, S.config);
}

function itensDoDia(data, cultos) {
  const itens = [];
  if (ui.camadas.ev) for (const e of S.eventos) if (e.data_inicio <= data && data <= (e.data_fim || e.data_inicio)) itens.push({ tipo: 'ev', texto: (e.hora_inicio ? e.hora_inicio.replace(':', 'h') + ' ' : '') + e.titulo, id: e.id, e });
  if (ui.camadas.an) for (const m of S.membros) if (m.status !== 'inativo' && m.nascimento && m.nascimento.slice(5) === data.slice(5)) itens.push({ tipo: 'an', texto: '🎂 ' + E.nomeCurto(m), id: m.id, m });
  if (ui.camadas.cu) for (const c of cultos) if (c.data === data) itens.push({ tipo: 'cu', texto: c.culto.charAt(0) + c.culto.slice(1).toLowerCase(), c });
  return itens;
}

function telaCalendario() {
  const [a, m] = ui.mesCal.split('-').map(Number);
  const cultos = cultosDoMesCal();
  const primeiro = E.diaSemana(`${ui.mesCal}-01`);
  const total = E.diasNoMes(ui.mesCal);
  const celulas = [];
  for (let i = 0; i < primeiro; i++) celulas.push('<div class="dia-cal fora"></div>');
  for (let d = 1; d <= total; d++) {
    const data = `${ui.mesCal}-${String(d).padStart(2, '0')}`;
    const itens = itensDoDia(data, cultos);
    celulas.push(`<button class="dia-cal ${data === S.hoje ? 'hoje' : ''} ${data === ui.diaSel ? 'sel' : ''}" data-dia="${data}">
      <span class="n">${d}</span>
      ${itens.slice(0, 4).map(it => `<span class="item-cal ${it.tipo}" ${it.tipo === 'ev' ? `data-evento="${it.id}"` : ''} ${it.tipo === 'an' ? `data-membro="${it.id}"` : ''}>${esc(it.texto)}</span>`).join('')}
      ${itens.length > 4 ? `<span class="item-cal cu">+${itens.length - 4}</span>` : ''}
      <span class="pontos">${[...new Set(itens.map(i => i.tipo))].map(t => `<i class="cor-${{ ev: 'evento', an: 'aniver', cu: 'culto' }[t]}"></i>`).join('')}</span>
    </button>`);
  }
  while (celulas.length % 7) celulas.push('<div class="dia-cal fora"></div>');

  // Agenda: dia selecionado, ou eventos e aniversários do mês
  let agendaTitulo;
  let agenda;
  if (ui.diaSel && ui.diaSel.startsWith(ui.mesCal)) {
    agendaTitulo = new Date(ui.diaSel + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    agenda = itensDoDia(ui.diaSel, cultos).map(it => ({ data: ui.diaSel, it }));
  } else {
    agendaTitulo = `Agenda de ${E.nomeMes(ui.mesCal)}`;
    agenda = [];
    for (let d = 1; d <= total; d++) {
      const data = `${ui.mesCal}-${String(d).padStart(2, '0')}`;
      for (const it of itensDoDia(data, cultos)) if (it.tipo !== 'cu' || !S.config.tipos_culto.some(t => t.id === it.c.tipo)) {
        if (it.tipo === 'ev' && it.e.data_inicio !== data && d !== 1) continue; // evento de vários dias aparece uma vez
        agenda.push({ data, it });
      }
    }
  }
  const cores = { ev: 'cor-evento', an: 'cor-aniver', cu: 'cor-culto' };
  const linhas = agenda.map(({ data, it }) => {
    let titulo = it.texto;
    let sub = '';
    let attr = '';
    if (it.tipo === 'ev') { titulo = it.e.titulo; sub = [it.e.hora_inicio && it.e.hora_inicio.replace(':', 'h') + (it.e.hora_fim ? '–' + it.e.hora_fim.replace(':', 'h') : ''), it.e.local, it.e.categoria, it.e.publico ? 'aparece no site' : 'interno'].filter(Boolean).join(' · '); attr = `data-evento="${it.id}"`; }
    if (it.tipo === 'an') { const p = proximoAniversario(it.m.nascimento, data); titulo = `Aniversário de ${E.nomeCurto(it.m)}`; sub = p ? `${p.idade} anos` : ''; attr = `data-membro="${it.id}"`; }
    if (it.tipo === 'cu') { titulo = it.c.culto; sub = 'Culto' + (it.c.obs ? ' · ' + it.c.obs : ''); attr = `data-ir="escala" data-ir-mes="${data.slice(0, 7)}"`; }
    return `<div class="linha-item" ${attr}><span class="marcador ${cores[it.tipo]}"></span>${dataMini(data, data === S.hoje)}<div class="info"><strong>${esc(titulo)}</strong><small>${esc(sub)}</small></div></div>`;
  }).join('') || '<p class="vazio-mini" style="padding:16px">Nada marcado.</p>';

  return `<div class="cabeca">
      <div class="mes-nav">
        <button class="icone" data-mes-cal="${E.proximoMes(ui.mesCal, -1)}" aria-label="Mês anterior">${ICONES.esq}</button>
        <h1><span class="mes">${E.MESES[m - 1]}</span> ${a}</h1>
        <button class="icone" data-mes-cal="${E.proximoMes(ui.mesCal, 1)}" aria-label="Próximo mês">${ICONES.dir}</button>
      </div>
      <div class="direita">
        <div class="camadas">
          <button data-camada="ev" class="${ui.camadas.ev ? 'on' : ''}"><i class="cor-evento"></i>Eventos</button>
          <button data-camada="an" class="${ui.camadas.an ? 'on' : ''}"><i class="cor-aniver"></i>Aniversários</button>
          <button data-camada="cu" class="${ui.camadas.cu ? 'on' : ''}"><i class="cor-culto"></i>Cultos</button>
        </div>
        <button class="btn primario" data-novo-evento>${ICONES.mais} Novo evento</button>
      </div>
    </div>
    <div class="grade-cal cartao">${E.DIAS.map(d => `<div class="dsem">${d.slice(0, 3)}</div>`).join('')}${celulas.join('')}</div>
    <div class="agenda">
      <h2>${esc(agendaTitulo.charAt(0).toUpperCase() + agendaTitulo.slice(1))}${ui.diaSel ? ` <button class="btn pequeno" data-novo-evento="${ui.diaSel}" style="margin-left:8px">${ICONES.mais} Evento neste dia</button> <button class="btn pequeno" data-dia-limpar>Ver o mês todo</button>` : ''}</h2>
      <div class="cartao">${linhas}</div>
    </div>`;
}

function abrirEvento(id, dataPadrao, copia) {
  const e = copia ? copia : id ? clone(S.eventos.find(x => x.id === id)) : { id: null, titulo: '', data_inicio: dataPadrao || S.hoje, data_fim: '', hora_inicio: '19:30', hora_fim: '', local: 'Templo sede', categoria: 'Evento', publico: true, descricao: '' };
  ui.rascE = e;
  modal(`
    <div class="modal-cab"><h2>${id ? 'Editar evento' : 'Novo evento'}</h2><button class="icone" data-fechar>${ICONES.x}</button></div>
    <form class="modal-corpo form" id="form-evento" autocomplete="off">
      <fieldset>
        <div class="campos">
          <label class="campo largo"><span>Nome do evento *</span><input name="titulo" value="${esc(e.titulo)}" placeholder="Ex.: Conferência de Mulheres"></label>
          <label class="campo"><span>Categoria</span><select name="categoria">${CATEGORIAS.concat(e.categoria && !CATEGORIAS.includes(e.categoria) ? [e.categoria] : []).map(c => `<option ${e.categoria === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
          <label class="campo"><span>Local</span><input name="local" value="${esc(e.local)}"></label>
          <label class="campo"><span>Data *</span><input type="date" name="data_inicio" value="${esc(e.data_inicio)}"></label>
          <label class="campo"><span>Até <small>(se durar mais de um dia)</small></span><input type="date" name="data_fim" value="${esc(e.data_fim)}"></label>
          <label class="campo"><span>Começa às</span><input type="time" name="hora_inicio" value="${esc(e.hora_inicio)}"></label>
          <label class="campo"><span>Termina às</span><input type="time" name="hora_fim" value="${esc(e.hora_fim)}"></label>
          <label class="campo largo"><span>Descrição</span><textarea name="descricao" rows="3" placeholder="O que vai acontecer, para quem é, programação… Ex.:&#10;06h – Pr. Gilney&#10;07h – Pra. Sheila">${esc(e.descricao)}</textarea></label>
        </div>
      </fieldset>
      <label class="interruptor-linha"><button type="button" class="interruptor ${e.publico ? 'on' : ''}" data-tg-publico aria-label="Mostrar no site"></button><span><strong style="font-weight:500">Mostrar no site da igreja</strong><br><small class="sub">Eventos internos (como reuniões) ficam só aqui no sistema.</small></span></label>
      <label class="interruptor-linha"><button type="button" class="interruptor ${e.destaque ? 'on' : ''}" data-tg-destaque aria-label="Destacar na página inicial"></button><span><strong style="font-weight:500">Destacar na página inicial</strong><br><small class="sub">Aparece grande, logo no topo do site (ex.: 12 horas de oração).</small></span></label>
    </form>
    <div class="modal-rodape">
      ${id ? `<button class="btn perigo esquerda" data-excluir-evento>${ICONES.lixo} Excluir</button>` : ''}
      ${id ? `<button class="btn" data-duplicar-evento title="Cria uma cópia no mesmo dia da semana do mês seguinte">${ICONES.copiar} Duplicar</button>` : ''}
      <button class="btn" data-fechar>Cancelar</button>
      <button class="btn primario" data-salvar-evento>Salvar</button>
    </div>`);
}

async function salvarEvento() {
  const f = $('#form-evento');
  const dados = { publico: ui.rascE.publico, destaque: ui.rascE.destaque };
  for (const el of f.elements) if (el.name) dados[el.name] = el.value.trim();
  try {
    if (ui.rascE.id) await api(`/api/eventos/${ui.rascE.id}`, { method: 'PUT', body: dados });
    else await api('/api/eventos', { method: 'POST', body: dados });
    toast('Evento salvo');
    fecharModal();
    ui.mesCal = dados.data_inicio.slice(0, 7);
    await carregar(ui.mes, { manterChat: true });
  } catch (e) { toast(e.message, 4500); }
}

// ---------------- Tela: Site (o que aparece na página inicial) ----------------
function thumbYoutube(id) { return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`; }

function linhasHorarios(lista) {
  return lista.map((h, i) => `<div class="horario-linha" data-horario="${i}">
      <input name="dia" value="${esc(h.dia)}" placeholder="Dia (ex.: Domingo)">
      <input name="culto" value="${esc(h.culto)}" placeholder="Culto">
      <input name="hora" value="${esc(h.hora)}" placeholder="Horário (ex.: 19h30)">
      <input name="descricao" value="${esc(h.descricao)}" placeholder="Frase curta">
      <button type="button" class="icone" data-del-horario="${i}" aria-label="Remover">${ICONES.lixo}</button>
    </div>`).join('');
}

function lerHorarios() {
  return [...document.querySelectorAll('#lista-horarios [data-horario]')].map(l => ({
    dia: l.querySelector('[name=dia]').value.trim(), culto: l.querySelector('[name=culto]').value.trim(),
    hora: l.querySelector('[name=hora]').value.trim(), descricao: l.querySelector('[name=descricao]').value.trim(),
  }));
}

function telaSite() {
  const site = S.site || {};
  const videos = site.videos || [];
  const eventos = S.eventos.filter(e => e.publico && (e.data_fim || e.data_inicio) >= S.hoje).sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
  const c = (nome, rotulo, valor, extra = '', ph = '') => `<label class="campo ${extra}"><span>${rotulo}</span><input name="${nome}" value="${esc(valor ?? '')}" placeholder="${esc(ph)}"></label>`;
  const t = (nome, rotulo, valor, linhas = 3) => `<label class="campo largo"><span>${rotulo}</span><textarea name="${nome}" rows="${linhas}">${esc(valor ?? '')}</textarea></label>`;
  return `<div class="cabeca">
      <div><h1>Site da igreja</h1><p class="sub" style="margin:2px 0 0">O que você publicar aqui aparece na página inicial — palavraviva.live</p></div>
      <div class="direita"><a class="btn" href="/" target="_blank">${ICONES.globo} Ver o site</a></div>
    </div>

    <div class="secao" style="margin-top:0">
      <h2>Palavra do dia</h2>
      <p class="sub">Postou um vídeo no YouTube? Cole o link aqui. O mais recente aparece em destaque na página inicial; os anteriores ficam logo abaixo.</p>
      <div class="cartao bloco">
        <form class="form-video" id="form-video" autocomplete="off">
          <label class="campo largo"><span>Link do YouTube *</span><input name="url" placeholder="https://youtube.com/shorts/…  ou  https://youtu.be/…"></label>
          <label class="campo"><span>Título <small>(opcional)</small></span><input name="titulo" placeholder="Ex.: Deus cuida de você"></label>
          <label class="campo"><span>Data</span><input type="date" name="data" value="${S.hoje}"></label>
          <button class="btn primario" type="submit">${ICONES.mais} Publicar no site</button>
        </form>
        <div class="lista-videos">${videos.length ? videos.map((v, i) => `<div class="video-item">
            <a href="${esc(v.url)}" target="_blank" rel="noopener" class="video-thumb ${v.formato === 'vertical' ? 'vertical' : ''}"><img src="${thumbYoutube(v.youtube)}" alt="" loading="lazy"></a>
            <div class="info"><strong>${esc(v.titulo || 'Palavra do dia')}</strong><small>${E.dataBR(v.data)}${i === 0 ? ' · <b class="selo-hoje" style="margin:0">no ar agora</b>' : ''}</small></div>
            <button class="icone" data-del-video="${v.id}" title="Tirar do site" aria-label="Tirar do site">${ICONES.lixo}</button>
          </div>`).join('') : '<p class="vazio-mini">Nenhum vídeo publicado ainda. Enquanto não houver vídeo, essa parte fica escondida no site.</p>'}</div>
      </div>
    </div>

    <div class="secao">
      <h2>Eventos na página inicial</h2>
      <p class="sub">Eventos com “Mostrar no site” aparecem para todos. Marque “Destacar” para o evento aparecer grande, logo no topo da página.</p>
      <div class="cartao">${eventos.length ? eventos.map(e => `<div class="linha-item" style="cursor:pointer;padding-inline:16px" data-evento="${e.id}">
          ${dataMini(e.data_inicio, e.data_inicio === S.hoje)}
          <div class="info"><strong>${esc(e.titulo)}</strong><small>${esc([e.hora_inicio && e.hora_inicio.replace(':', 'h') + (e.hora_fim ? '–' + e.hora_fim.replace(':', 'h') : ''), e.local].filter(Boolean).join(' · '))}</small></div>
          ${e.destaque ? '<span class="chip f">em destaque</span>' : ''}
        </div>`).join('') : '<p class="vazio-mini" style="padding:16px">Nenhum evento público à frente.</p>'}</div>
      <div style="margin-top:10px"><button class="btn" data-novo-evento>${ICONES.mais} Novo evento</button></div>
    </div>

    <div class="secao">
      <h2>Informações da página</h2>
      <p class="sub">Textos, horários dos cultos e contatos que aparecem no site.</p>
      <form class="cartao bloco form" id="form-site" autocomplete="off">
        <fieldset><legend>Início</legend><div class="campos">
          ${t('chamada', 'Frase de boas-vindas (abaixo de “Família de Vencedores”)', site.chamada, 2)}
          ${t('sobre', 'Quem somos', site.sobre, 4)}
        </div></fieldset>
        <fieldset><legend>Horários dos cultos</legend>
          <div class="lista-mini" id="lista-horarios">${linhasHorarios(site.horarios || [])}</div>
          <div><button type="button" class="btn pequeno" data-add-horario>${ICONES.mais} Adicionar horário</button></div>
        </fieldset>
        <fieldset><legend>Pastores</legend><div class="campos">
          ${c('pastores_nomes', 'Nomes', (site.pastores || {}).nomes, 'largo')}
          ${t('pastores_texto', 'Texto', (site.pastores || {}).texto, 2)}
        </div></fieldset>
        <fieldset><legend>Versículo</legend><div class="campos">
          ${t('versiculo_texto', 'Texto', (site.versiculo || {}).texto, 2)}
          ${c('versiculo_ref', 'Referência', (site.versiculo || {}).ref, '', 'Romanos 8:37')}
        </div></fieldset>
        <fieldset><legend>Contato e redes</legend><div class="campos">
          ${c('endereco', 'Endereço', site.endereco, 'largo')}
          ${c('mapa_link', 'Link do Google Maps', site.mapa_link, 'largo', 'https://maps.app.goo.gl/…')}
          ${c('whatsapp', 'WhatsApp da igreja', site.whatsapp, '', '(62) 9 9999-9999')}
          ${c('email', 'E-mail', site.email)}
          ${c('instagram', 'Instagram (link)', site.instagram, '', 'https://instagram.com/…')}
          ${c('youtube', 'Canal do YouTube (link)', site.youtube, '', 'https://youtube.com/@…')}
        </div></fieldset>
        <fieldset><legend>Contribuição (PIX)</legend><div class="campos">
          ${c('pix_chave', 'Chave PIX', (site.pix || {}).chave)}
          ${c('pix_favorecido', 'Favorecido', (site.pix || {}).favorecido)}
        </div></fieldset>
        <div><button class="btn primario" type="submit">Salvar e publicar no site</button></div>
      </form>
    </div>`;
}

async function salvarSite() {
  const f = $('#form-site');
  const v = n => f.elements[n].value.trim();
  const dados = {
    chamada: v('chamada'), sobre: v('sobre'),
    horarios: lerHorarios().filter(h => h.dia || h.culto || h.hora),
    pastores: { nomes: v('pastores_nomes'), texto: v('pastores_texto') },
    versiculo: { texto: v('versiculo_texto'), ref: v('versiculo_ref') },
    endereco: v('endereco'), mapa_link: v('mapa_link'), whatsapp: v('whatsapp'), email: v('email'),
    instagram: v('instagram'), youtube: v('youtube'),
    pix: { chave: v('pix_chave'), favorecido: v('pix_favorecido') },
  };
  try {
    const r = await api('/api/site', { method: 'PUT', body: dados });
    toast(r.aplicado ? 'Publicado! A página inicial já está atualizada.' : 'Nada mudou');
    await carregar(ui.mes, { manterChat: true });
  } catch (e) { toast(e.message, 4500); }
}

async function publicarVideo() {
  const f = $('#form-video');
  const dados = { url: f.elements.url.value.trim(), titulo: f.elements.titulo.value.trim(), data: f.elements.data.value };
  if (!dados.url) return toast('Cole o link do vídeo do YouTube.');
  try {
    await api('/api/site/videos', { method: 'POST', body: dados });
    toast('Vídeo publicado na página inicial');
    await carregar(ui.mes, { manterChat: true });
  } catch (e) { toast(e.message, 5000); }
}

/** Mesma "posição" no mês seguinte (ex.: 1º domingo → 1º domingo do mês seguinte). */
function mesmaPosicaoProximoMes(data) {
  const ds = E.diaSemana(data);
  const n = Math.ceil(Number(data.slice(8, 10)) / 7);
  const prox = E.proximoMes(data.slice(0, 7));
  const dias = [];
  for (let d = 1; d <= E.diasNoMes(prox); d++) {
    const dt = `${prox}-${String(d).padStart(2, '0')}`;
    if (E.diaSemana(dt) === ds) dias.push(dt);
  }
  return dias[Math.min(n, dias.length) - 1];
}

// ---------------- Chat ----------------
async function carregarChat() {
  try { ui.chat = await api(`/api/chat/${ui.mes}`); } catch { ui.chat = []; }
  ui.chatCarregado = true;
  renderChat();
}

function markdown(txt) {
  const linhas = esc(txt).split('\n');
  let html = '';
  let lista = null;
  const inline = s => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>').replace(/`(.+?)`/g, '<code>$1</code>');
  let par = [];
  const fecharPar = () => { if (par.length) { html += `<p>${par.map(inline).join('<br>')}</p>`; par = []; } };
  const fecharLista = () => { if (lista) { html += `</${lista}>`; lista = null; } };
  for (const l of linhas) {
    const ul = l.match(/^\s*[-•*]\s+(.*)/);
    const ol = l.match(/^\s*\d+[.)]\s+(.*)/);
    if (ul || ol) {
      fecharPar();
      const tipo = ul ? 'ul' : 'ol';
      if (lista !== tipo) { fecharLista(); html += `<${tipo}>`; lista = tipo; }
      html += `<li>${inline((ul || ol)[1])}</li>`;
    } else if (!l.trim()) {
      fecharPar();
      fecharLista();
    } else {
      fecharLista();
      par.push(l.replace(/^#+\s*/, ''));
    }
  }
  fecharPar();
  fecharLista();
  return html;
}

const ROTULO_ACAO = {
  alterar_escala: 'Escala alterada', gerenciar_culto: 'Culto atualizado', gerar_escala: 'Escala gerada',
  atualizar_obreiro: 'Cadastro atualizado', cadastrar_obreiro: 'Obreiro cadastrado', regras_gerais: 'Regra atualizada',
};

function sugestoes() {
  const prox = E.proximoMes(ui.mes);
  const lista = [
    S && !S.escala ? `Gere a escala de ${E.nomeMes(ui.mes)}` : `Quem prega nos próximos cultos?`,
    'Troque a pregação de sexta que vem pela Pra. Sheila',
    'A Pra. Evellyn vai viajar de 10 a 16 — ajuste a escala',
    `Gere a escala de ${E.nomeMes(prox)}`,
    'O que mudou na escala este mês?',
  ];
  return `<div class="sugestoes"><p>Converse em português normal. Exemplos:</p>${lista.map(s => `<button data-sugestao="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;
}

function renderChat() {
  const caixa = $('#chat-msgs');
  if (S && !S.ia_configurada) {
    caixa.innerHTML = '<div class="msg ia erro">A chave da IA não está configurada. Coloque DEEPSEEK_API_KEY no arquivo .env e reinicie o servidor.</div>';
    return;
  }
  let html = ui.chat.length ? '' : sugestoes();
  html += ui.chat.map(m => {
    if (m.papel === 'usuario') return `<div class="msg usuario">${esc(m.texto)}</div>`;
    const acoes = (m.acoes || []).filter(a => a.ok).map(a => `<span>✓ ${esc(ROTULO_ACAO[a.ferramenta] || a.ferramenta)}</span>`);
    return `<div class="msg ia ${m.erro ? 'erro' : ''}">${markdown(m.texto)}${acoes.length ? `<div class="acoes-ia">${[...new Set(acoes)].join('')}</div>` : ''}</div>`;
  }).join('');
  if (ui.enviando) html += `<div class="msg ia"><span class="digitando"><i></i><i></i><i></i><em id="digitando-txt">Pensando…</em></span></div>`;
  caixa.innerHTML = html;
  caixa.scrollTop = caixa.scrollHeight;
}

function abrirChat(texto) {
  if (ui.secao !== 'escala') irSecao('escala');
  $('#chat').classList.add('aberto');
  const inp = $('#chat-input');
  if (texto !== undefined) {
    inp.value = texto;
    ajustarAltura();
  }
  setTimeout(() => {
    inp.focus();
    inp.setSelectionRange(inp.value.length, inp.value.length);
    $('#chat-msgs').scrollTop = 1e9;
  }, ehCelular() ? 300 : 0);
}
function fecharChat() {
  $('#chat').classList.remove('aberto');
}

function ajustarAltura() {
  const t = $('#chat-input');
  t.style.height = 'auto';
  t.style.height = Math.min(160, t.scrollHeight) + 'px';
}

async function enviar(texto) {
  texto = (texto || '').trim();
  if (!texto || ui.enviando) return;
  ui.enviando = true;
  ui.chat.push({ papel: 'usuario', texto });
  $('#chat-input').value = '';
  ajustarAltura();
  $('.enviar').disabled = true;
  renderChat();
  const frases = ['Pensando…', 'Conferindo as regras…', 'Verificando a escala…', 'Trabalhando nisso…', 'Montando a escala, pode levar 1 minuto…'];
  let i = 0;
  const timer = setInterval(() => { i = Math.min(i + 1, frases.length - 1); const el = $('#digitando-txt'); if (el) el.textContent = frases[i]; }, 6000);
  try {
    const r = await api('/api/chat', { method: 'POST', body: { mes: ui.mes, mensagem: texto } });
    ui.chat.push({ papel: 'ia', texto: r.resposta, acoes: r.acoes.map(a => ({ ferramenta: a.ferramenta, ok: a.ok })) });
    if (r.alterou) {
      ui.mudou = new Set();
      for (const a of r.acoes) {
        if (a.ok && a.ferramenta === 'alterar_escala') for (const alt of a.args.alteracoes || []) ui.mudou.add(`${alt.culto_id}|${alt.funcao}`);
      }
      const gerou = r.acoes.find(a => a.ok && a.ferramenta === 'gerar_escala');
      const mesAlvo = gerou ? gerou.args.mes : ui.mes;
      await carregar(mesAlvo, { manterChat: true });
      toast(gerou ? `Escala de ${E.nomeMes(mesAlvo)} gerada` : 'Atualizado — a mudança ficou registrada no histórico');
    }
  } catch (e) {
    ui.chat.push({ papel: 'ia', texto: 'Não consegui responder: ' + e.message, erro: true });
  } finally {
    clearInterval(timer);
    ui.enviando = false;
    $('.enviar').disabled = false;
    renderChat();
  }
}

// ---------------- Modal ----------------
function modal(html) {
  $('#modal-caixa').innerHTML = html;
  $('#modal').hidden = false;
  document.body.style.overflow = 'hidden';
}
function fecharModal() {
  $('#modal').hidden = true;
  $('#modal-caixa').innerHTML = '';
  document.body.style.overflow = '';
}

// ---------------- Eventos ----------------
document.addEventListener('click', async e => {
  const t = e.target.closest('button, [data-cel], [data-fechar], [data-ir], [data-evento], [data-membro]');
  if (!t) return;
  const d = t.dataset;

  if (d.fechar !== undefined) return fecharModal();
  if (d.secao) return irSecao(d.secao);
  if (d.sair !== undefined) {
    await SB.auth.signOut().catch(() => {});
    location.href = '/login/';
    return;
  }
  if (d.ir) {
    const [sec, sub] = d.ir.split(':');
    if (sec === 'membros') ui.membrosFiltro = sub || 'ativo';
    if (d.irMes && d.irMes !== ui.mes) await carregar(d.irMes);
    return irSecao(sec, { aba: sec === 'escala' ? (sub || 'escala') : undefined });
  }

  // Membros
  if (d.membro) return abrirMembro(d.membro);
  if (d.novoMembro !== undefined) return abrirMembro(null);
  if (d.mfiltro) { ui.membrosFiltro = d.mfiltro; return render(); }
  if (d.salvarMembro !== undefined) return salvarMembro();
  if (d.excluirMembro !== undefined) {
    if (!confirm(`Excluir ${E.nomeCurto(ui.rascM)} do cadastro de membros? Se a pessoa só se afastou, prefira mudar a situação para "afastado" ou "inativo".`)) return;
    try { await api(`/api/membros/${ui.rascM.id}`, { method: 'DELETE' }); fecharModal(); toast('Membro excluído'); await carregar(ui.mes, { manterChat: true }); } catch (err) { toast(err.message, 5000); }
    return;
  }
  if (d.tornarObreiro) { fecharModal(); return tornarObreiro(d.tornarObreiro); }
  if (d.verObreiro) { fecharModal(); irSecao('escala', { aba: 'obreiros' }); return abrirObreiro(d.verObreiro); }
  if (d.verMembro) { fecharModal(); return abrirMembro(d.verMembro); }
  if (d.escolherMembro) { fecharModal(); return tornarObreiro(d.escolherMembro); }

  // Calendário
  if (d.mesCal) { ui.mesCal = d.mesCal; ui.diaSel = null; return render(); }
  if (d.camada) { ui.camadas[d.camada] = !ui.camadas[d.camada]; return render(); }
  if (d.evento) return abrirEvento(d.evento);
  if (d.novoEvento !== undefined) return abrirEvento(null, d.novoEvento || ui.diaSel || (ui.mesCal === S.hoje.slice(0, 7) ? S.hoje : ui.mesCal + '-01'));
  if (d.dia) { ui.diaSel = ui.diaSel === d.dia ? null : d.dia; return render(); }
  if (d.diaLimpar !== undefined) { ui.diaSel = null; return render(); }
  if (d.tgPublico !== undefined) { ui.rascE.publico = !ui.rascE.publico; return t.classList.toggle('on'); }
  if (d.tgDestaque !== undefined) {
    ui.rascE.destaque = !ui.rascE.destaque;
    if (ui.rascE.destaque && !ui.rascE.publico) { ui.rascE.publico = true; document.querySelector('[data-tg-publico]').classList.add('on'); }
    return t.classList.toggle('on');
  }
  if (d.duplicarEvento !== undefined) {
    const f = $('#form-evento');
    const copia = clone(ui.rascE);
    for (const el of f.elements) if (el.name) copia[el.name] = el.value;
    copia.id = null;
    copia.data_inicio = mesmaPosicaoProximoMes(copia.data_inicio);
    if (copia.data_fim) copia.data_fim = '';
    abrirEvento(null, null, copia);
    toast('Cópia criada para ' + E.dataBR(copia.data_inicio) + ' — confira e salve');
    return;
  }
  // Site
  if (d.addHorario !== undefined) { const l = lerHorarios(); l.push({ dia: '', culto: '', hora: '', descricao: '' }); $('#lista-horarios').innerHTML = linhasHorarios(l); return; }
  if (d.delHorario) { const l = lerHorarios(); l.splice(Number(d.delHorario), 1); $('#lista-horarios').innerHTML = linhasHorarios(l); return; }
  if (d.delVideo) {
    if (!confirm('Tirar este vídeo da página inicial?')) return;
    try { await api(`/api/site/videos/${d.delVideo}`, { method: 'DELETE' }); toast('Vídeo removido do site'); await carregar(ui.mes, { manterChat: true }); } catch (err) { toast(err.message); }
    return;
  }
  if (d.salvarEvento !== undefined) return salvarEvento();
  if (d.excluirEvento !== undefined) {
    if (!confirm(`Excluir o evento "${ui.rascE.titulo}"?`)) return;
    try { await api(`/api/eventos/${ui.rascE.id}`, { method: 'DELETE' }); fecharModal(); toast('Evento excluído'); await carregar(ui.mes, { manterChat: true }); } catch (err) { toast(err.message); }
    return;
  }
  if (d.aba) return irPara(d.aba);
  if (d.mes) { ui.mudou = new Set(); return carregar(d.mes); }
  if (d.gerar) return abrirGerar(d.gerar);
  if (d.cel) {
    const [cid, fid] = d.cel.split('|');
    const c = S.escala.cultos.find(x => x.id === cid);
    const f = S.config.funcoes.find(x => x.id === fid);
    const atual = E.linhasCelula(c, f, S.config, ui.mapa).join(' / ') || 'vazio';
    return abrirChat(`${E.dataBR(c.data).slice(0, 5)} (${c.culto}) – ${f.nome}: hoje está "${atual}". Quero `);
  }
  if (d.acao === 'imagem') return exportarImagem();
  if (d.acao === 'imprimir') return window.print();
  if (d.acao === 'whatsapp') return toast((await copiar(textoWhatsApp())) ? 'Texto copiado — é só colar no WhatsApp' : 'Não consegui copiar');
  if (d.sugestao) return enviar(d.sugestao);

  // Obreiros
  if (d.obreiro) return abrirObreiro(d.obreiro);
  if (d.novoObreiro !== undefined) return abrirNovoObreiro();
  if (d.filtro) { ui.filtro = d.filtro; return render(); }
  if (d.tgFuncao) {
    const l = ui.rasc.funcoes;
    ui.rasc.funcoes = l.includes(d.tgFuncao) ? l.filter(x => x !== d.tgFuncao) : [...l, d.tgFuncao];
    return t.classList.toggle('on');
  }
  if (d.tgDia) {
    const n = Number(d.tgDia);
    const l = ui.rasc.dias;
    ui.rasc.dias = l.includes(n) ? l.filter(x => x !== n) : [...l, n].sort();
    return t.classList.toggle('on');
  }
  if (d.addInd !== undefined) { lerIndisponibilidades(); ui.rasc.indisponibilidades.push({ inicio: '', fim: '', motivo: '' }); $('#lista-ind').innerHTML = htmlIndisponibilidades(ui.rasc); return; }
  if (d.delInd) { lerIndisponibilidades(); ui.rasc.indisponibilidades.splice(Number(d.delInd), 1); $('#lista-ind').innerHTML = htmlIndisponibilidades(ui.rasc); return; }
  if (d.salvarObreiro !== undefined) return salvarObreiro();
  if (d.excluirObreiro !== undefined) {
    if (!confirm(`Tirar ${E.nomeCurto(ui.rasc)} da lista de obreiros? A pessoa continua no cadastro de membros. Se for só por um tempo, prefira mudar a situação na escala para "inativo".`)) return;
    try { await api(`/api/obreiros/${ui.rasc.id}`, { method: 'DELETE' }); fecharModal(); toast('Removido(a) da escala'); await carregar(ui.mes, { manterChat: true }); } catch (err) { toast(err.message, 5000); }
    return;
  }
  if (d.contato) {
    const nome = (S.contatos.find(c => c.id === d.contato) || {}).whatsapp_nome;
    if (d.contatoAcao === 'descartar' && !confirm(`Descartar "${nome}" da lista de contatos para vincular?`)) return;
    try { await api(`/api/contatos/${d.contato}`, { method: 'POST', body: { acao: d.contatoAcao } }); toast(d.contatoAcao === 'cadastrar' ? `${nome} cadastrado(a) como membro` : 'Contato descartado'); await carregar(ui.mes, { manterChat: true }); } catch (err) { toast(err.message); }
    return;
  }

  // Regras
  if (d.regraAcao) {
    const id = t.closest('[data-regra]').dataset.regra;
    if (d.regraAcao === 'editar') {
      const div = $(`#texto-${id}`);
      const atual = S.config.regras_gerais.find(r => r.id === id).texto;
      div.innerHTML = `<textarea rows="3">${esc(atual)}</textarea><div style="display:flex;gap:6px;margin-top:6px"><button class="btn pequeno primario" data-salvar-regra="${id}">Salvar</button><button class="btn pequeno" data-cancelar-regra>Cancelar</button></div>`;
      div.querySelector('textarea').focus();
      return;
    }
    if (d.regraAcao === 'remover' && !confirm('Remover esta regra?')) return;
    try { await api('/api/regras', { method: 'POST', body: { acao: d.regraAcao, id } }); await carregar(ui.mes, { manterChat: true }); ui.rcfg = null; renderRegrasMantendoScroll(); } catch (err) { toast(err.message); }
    return;
  }
  if (d.salvarRegra) {
    const texto = t.closest('.texto').querySelector('textarea').value;
    try { await api('/api/regras', { method: 'POST', body: { acao: 'editar', id: d.salvarRegra, texto } }); toast('Regra salva'); await carregar(ui.mes, { manterChat: true }); renderRegrasMantendoScroll(); } catch (err) { toast(err.message); }
    return;
  }
  if (d.cancelarRegra !== undefined) return renderRegrasMantendoScroll();
  if (d.addRegra !== undefined) {
    const texto = $('#nova-regra').value.trim();
    if (!texto) return toast('Escreva a regra primeiro.');
    try { await api('/api/regras', { method: 'POST', body: { acao: 'adicionar', texto } }); toast('Regra adicionada'); await carregar(ui.mes, { manterChat: true }); renderRegrasMantendoScroll(); } catch (err) { toast(err.message); }
    return;
  }
  if (d.tgTipo) { const tp = ui.rcfg.tipos_culto[Number(d.tgTipo)]; tp.ativo = tp.ativo === false; return renderRegrasMantendoScroll(); }
  if (d.ocAdd) {
    const tp = ui.rcfg.tipos_culto[Number(d.ocAdd)];
    tp.nome_por_ocorrencia = tp.nome_por_ocorrencia || {};
    const livre = ['1', '2', '3', '4', '5', 'ultimo'].find(k => !(k in tp.nome_por_ocorrencia));
    if (livre) tp.nome_por_ocorrencia[livre] = '';
    return renderRegrasMantendoScroll();
  }
  if (d.ocDel) { const [ti, k] = d.ocDel.split('|'); delete ui.rcfg.tipos_culto[Number(ti)].nome_por_ocorrencia[k]; return renderRegrasMantendoScroll(); }
  if (d.addFuncao !== undefined) {
    const nome = $('#nova-funcao').value.trim();
    if (!nome) return;
    const id = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (ui.rcfg.funcoes.some(f => f.id === id)) return toast('Essa função já existe.');
    ui.rcfg.funcoes.push({ id, nome, min: 0, max: 1 });
    return renderRegrasMantendoScroll();
  }
  if (d.cfgDescartar !== undefined) { ui.rcfg = null; return renderRegrasMantendoScroll(); }
  if (d.cfgSalvar !== undefined) {
    const c = ui.rcfg;
    try {
      await api('/api/config', { method: 'PUT', body: { funcoes: c.funcoes, tipos_culto: c.tipos_culto, aviso_dias_antes: c.aviso_dias_antes } });
      toast('Configurações salvas');
      ui.rcfg = null;
      await carregar(ui.mes, { manterChat: true });
    } catch (err) { toast(err.message); }
    return;
  }

  // Histórico
  if (d.hist) { ui.histAba = d.hist; return render(); }
  if (d.desfazer) {
    if (!confirm('Desfazer esta alteração? (o desfazer também fica registrado)')) return;
    try { await api(`/api/escalas/${ui.mes}/desfazer/${d.desfazer}`, { method: 'POST', body: {} }); toast('Alteração desfeita'); await carregar(ui.mes, { manterChat: true }); } catch (err) { toast(err.message, 5000); }
  }
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'busca') { ui.busca = t.value; $('#grade').innerHTML = gradeObreiros(); return; }
  if (t.id === 'busca-membros') { ui.membrosBusca = t.value; $('#lista-membros').innerHTML = listaMembros(); return; }
  if (t.id === 'busca-escolha') {
    const q = t.value.toLowerCase();
    document.querySelectorAll('[data-escolher-membro]').forEach(b => { b.hidden = !b.dataset.nome.includes(q); });
    return;
  }
  if (!ui.rcfg) return;
  const d = t.dataset;
  if (d.bind) definir(ui.rcfg, d.bind, t.value);
  else if (d.bindNum) definir(ui.rcfg, d.bindNum, t.value === '' ? null : Number(t.value));
  else if (d.tipoFn) {
    const [ti, fid, k] = d.tipoFn.split('|');
    const tp = ui.rcfg.tipos_culto[Number(ti)];
    tp.funcoes = tp.funcoes || {};
    tp.funcoes[fid] = tp.funcoes[fid] || {};
    if (t.value === '') delete tp.funcoes[fid][k]; else tp.funcoes[fid][k] = Number(t.value);
    if (!Object.keys(tp.funcoes[fid]).length) delete tp.funcoes[fid];
  } else if (d.tipoModelo) {
    const [ti, fid] = d.tipoModelo.split('|');
    const tp = ui.rcfg.tipos_culto[Number(ti)];
    tp.modelos = tp.modelos || {};
    if (t.value.trim()) tp.modelos[fid] = t.value; else delete tp.modelos[fid];
  } else if (d.ocValor) {
    const [ti, k] = d.ocValor.split('|');
    ui.rcfg.tipos_culto[Number(ti)].nome_por_ocorrencia[k] = t.value.toUpperCase();
  } else return;
  const barra = $('#barra-salvar');
  if (barra) barra.hidden = JSON.stringify(ui.rcfg) === JSON.stringify(S.config);
});

document.addEventListener('change', async e => {
  const t = e.target;
  const d = t.dataset;
  if (d.ocChave) {
    const [ti, k] = d.ocChave.split('|');
    const mapa = ui.rcfg.tipos_culto[Number(ti)].nome_por_ocorrencia;
    if (t.value in mapa) { toast('Já existe um nome para essa ocorrência.'); return renderRegrasMantendoScroll(); }
    mapa[t.value] = mapa[k];
    delete mapa[k];
    return renderRegrasMantendoScroll();
  }
  if (ui.rcfg && (d.bindNum || d.bind)) return renderRegrasMantendoScroll();
  if (t.id === 'filtro-cargo') { ui.membrosCargo = t.value; $('#lista-membros').innerHTML = listaMembros(); return; }
  if (t.closest('#form-membro') && (t.name === 'cargo' || t.name === 'sexo')) {
    // Sugere o título conforme o cargo (só se o título estiver vazio ou for um título automático)
    const f = $('#form-membro');
    const automaticos = new Set(S.config.cargos.flatMap(c => [c.titulo_m, c.titulo_f]));
    if (!f.titulo.value || automaticos.has(f.titulo.value)) f.titulo.value = tituloDoCargo(f.cargo.value, f.sexo.value);
    return;
  }
  if (d.vincular && t.value) {
    const c = S.contatos.find(x => x.id === d.vincular);
    const o = S.membros.find(x => x.id === t.value);
    if (!confirm(`Vincular o contato "${c.whatsapp_nome}"${c.telefone ? ` (${c.telefone})` : ''} a ${E.nomeCurto(o)}?`)) { t.value = ''; return; }
    try { await api(`/api/contatos/${c.id}`, { method: 'POST', body: { acao: 'vincular', membro_id: o.id } }); toast('Contato vinculado'); await carregar(ui.mes, { manterChat: true }); } catch (err) { toast(err.message); }
  }
});

$('#chat-form').addEventListener('submit', e => { e.preventDefault(); enviar($('#chat-input').value); });
document.addEventListener('submit', e => {
  if (e.target.id === 'form-site') { e.preventDefault(); salvarSite(); }
  if (e.target.id === 'form-video') { e.preventDefault(); publicarVideo(); }
});
$('#chat-input').addEventListener('input', ajustarAltura);
$('#chat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !toque) { e.preventDefault(); enviar(e.target.value); }
});
$('#chat-fechar').addEventListener('click', fecharChat);
$('#fab-ia').addEventListener('click', () => abrirChat());
$('#chat-limpar').addEventListener('click', async () => {
  if (!ui.chat.length || !confirm('Limpar a conversa deste mês? (as alterações já feitas continuam no histórico)')) return;
  await api(`/api/chat/${ui.mes}`, { method: 'DELETE' });
  ui.chat = [];
  renderChat();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('#modal').hidden) fecharModal(); else fecharChat(); }
});

// Abre na seção indicada no endereço (#membros, #escala/obreiros…)
{
  const [sec, sub] = location.hash.slice(1).split('/');
  if (SECOES.includes(sec)) { ui.secao = sec; if (sec === 'escala' && sub) ui.aba = sub; }
  document.body.dataset.secao = ui.secao;
  document.querySelectorAll('[data-secao]').forEach(b => b.classList.toggle('ativa', b.dataset.secao === ui.secao));
}

SB.auth.getSession().then(({ data }) => {
  if (!data.session) { location.href = '/login/'; return; }
  carregar().catch(e => {
    $('#principal').innerHTML = `<div class="cartao vazio"><h2>Não consegui carregar</h2><p>${esc(e.message)}</p><p>Confira a internet e tente de novo.</p></div>`;
  });
});
