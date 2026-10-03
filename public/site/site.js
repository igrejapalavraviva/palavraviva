/* Site público — Igreja Palavra Viva */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const ICONE_FOTO = '<svg viewBox="0 0 24 24"><path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/></svg>';

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { t.hidden = true; }, 2600);
}

function valor(obj, caminho) {
  return caminho.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
}

// Fotos: procura /site/fotos/<nome>.jpg (ou .webp/.png). Sem arquivo, mostra o espaço reservado.
function carregarFoto(el) {
  const nome = el.dataset.foto;
  const tentar = exts => {
    if (!exts.length) {
      el.innerHTML = `<div class="foto-vazia">${ICONE_FOTO}<span>${esc(el.dataset.rotulo || 'Foto')}</span><small>site/fotos/${esc(nome)}.jpg</small></div>`;
      return;
    }
    const src = `/site/fotos/${nome}.${exts[0]}`;
    const img = new Image();
    img.onload = () => {
      el.style.backgroundImage = `url("${src}")`;
      el.classList.add('com-imagem');
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', el.dataset.rotulo || '');
      if (nome === 'hero') {
        $('#inicio').classList.replace('sem-foto', 'com-foto');
        $('#topo').classList.add('sobre-foto');
      }
    };
    img.onerror = () => tentar(exts.slice(1));
    img.src = src;
  };
  tentar(['jpg', 'webp', 'png']);
}

function linkWhatsApp(numero, texto) {
  const dig = String(numero || '').replace(/\D/g, '');
  if (!dig) return '';
  return `https://wa.me/${dig.startsWith('55') ? dig : '55' + dig}${texto ? '?text=' + encodeURIComponent(texto) : ''}`;
}

function preencher(site) {
  document.querySelectorAll('[data-site]').forEach(el => {
    const v = valor(site, el.dataset.site);
    if (v) el.textContent = v;
  });

  const horarios = site.horarios || [];
  $('#faixa-horarios').innerHTML = horarios.map(h => `
    <a href="#cultos"><span class="dia">${esc(h.dia.slice(0, 3).toUpperCase())}</span>
      <span><strong>${esc(h.culto)}</strong><small>${esc(h.dia)} · ${esc(h.hora)}</small></span></a>`).join('');
  $('#grade-cultos').innerHTML = horarios.map(h => `
    <article class="culto aparecer">
      <span class="dia">${esc(h.dia)}</span>
      <h3>${esc(h.culto)}</h3>
      <div class="hora">${esc(h.hora)}</div>
      <p>${esc(h.descricao || '')}</p>
    </article>`).join('');

  // Contatos e redes (itens sem informação ficam escondidos)
  const zap = linkWhatsApp(site.whatsapp, 'Olá! Gostaria de saber mais sobre a Igreja Palavra Viva.');
  const redes = { whatsapp: zap, instagram: site.instagram, youtube: site.youtube };
  for (const [rede, url] of Object.entries(redes)) {
    if (url) $(`#link-${rede}`).href = url; else $(`#li-${rede}`).hidden = true;
  }
  if (zap) { $('#cta-whatsapp').href = zap; $('#cta-whatsapp').target = '_blank'; $('#cta-whatsapp').textContent = 'Fale com a gente no WhatsApp'; }
  $('#link-mapa').href = site.mapa_link || `https://www.google.com/maps/search/${encodeURIComponent(site.endereco || site.nome || 'Igreja Palavra Viva')}`;
}

function eventos(lista) {
  const el = $('#grade-eventos');
  if (!lista.length) {
    el.innerHTML = '<div class="sem-eventos">Novos eventos em breve. Acompanhe a gente!</div>';
    return;
  }
  el.innerHTML = lista.map(e => {
    const [a, m, d] = e.data_inicio.split('-').map(Number);
    const ds = DIAS_SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
    let quando = ds;
    if (e.data_fim) {
      const [, m2, d2] = e.data_fim.split('-').map(Number);
      quando = `${d}/${m} a ${d2}/${m2}`;
    }
    if (e.hora_inicio) quando += ` · ${e.hora_inicio.replace(':', 'h')}`;
    if (e.local) quando += ` · ${e.local}`;
    return `<article class="evento aparecer">
      <div class="data"><b>${d}</b><span>${MESES[m - 1]}</span></div>
      <div>
        ${e.categoria ? `<span class="categoria">${esc(e.categoria)}</span>` : ''}
        <h3>${esc(e.titulo)}</h3>
        <p class="quando">${esc(quando)}</p>
        ${e.descricao ? `<p class="desc">${esc(e.descricao)}</p>` : ''}
      </div>
    </article>`;
  }).join('');
}

function animar() {
  document.querySelectorAll('.secao h2, .duas-colunas > *, .ministerio, .cartao-pix, .versiculo blockquote').forEach(el => el.classList.add('aparecer'));
  const obs = new IntersectionObserver(itens => itens.forEach(i => {
    if (i.isIntersecting) { i.target.classList.add('visivel'); obs.unobserve(i.target); }
  }), { threshold: .12 });
  document.querySelectorAll('.aparecer').forEach(el => obs.observe(el));
}

// Topo que ganha fundo ao rolar + menu do celular
const topo = $('#topo');
const aoRolar = () => topo.classList.toggle('rolado', window.scrollY > 24);
window.addEventListener('scroll', aoRolar, { passive: true });
aoRolar();
$('#hamburguer').addEventListener('click', () => {
  const aberto = $('#menu').classList.toggle('aberto');
  $('#hamburguer').setAttribute('aria-expanded', aberto);
  topo.classList.toggle('rolado', aberto || window.scrollY > 24);
});
document.querySelectorAll('#menu a').forEach(a => a.addEventListener('click', () => $('#menu').classList.remove('aberto')));

$('#copiar-pix').addEventListener('click', async () => {
  const chave = $('#pix-chave').textContent.trim();
  try { await navigator.clipboard.writeText(chave); } catch {
    const t = document.createElement('textarea');
    t.value = chave;
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
  toast('Chave PIX copiada');
});
$('#ano').textContent = new Date().getFullYear();

document.querySelectorAll('[data-foto]').forEach(carregarFoto);
// Lê do Supabase só o que é público: o texto do site e os eventos marcados para aparecer aqui
const C = window.IPV_CONFIG;
const cab = { apikey: C.supabaseKey };
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
Promise.all([
  fetch(`${C.supabaseUrl}/rest/v1/site?select=dados&id=eq.1`, { headers: cab }).then(r => r.json()),
  fetch(`${C.supabaseUrl}/rest/v1/eventos?select=id,titulo,data_inicio,data_fim,hora_inicio,hora_fim,local,categoria,descricao&publico=eq.true&order=data_inicio`, { headers: cab }).then(r => r.json()),
]).then(([site, evs]) => {
  preencher((site[0] && site[0].dados) || {});
  eventos((Array.isArray(evs) ? evs : []).filter(e => (e.data_fim || e.data_inicio) >= hoje).slice(0, 6));
  animar();
}).catch(() => animar());
