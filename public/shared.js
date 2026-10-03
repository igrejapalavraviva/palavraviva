/*
 * Lógica compartilhada entre o servidor (Node) e o navegador:
 * datas, formatação de nomes/células e validação das regras.
 */
(function (raiz) {
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho',
    'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const DIAS_CURTOS = ['Dom.', 'Seg.', 'Ter.', 'Quarta', 'Qui.', 'Sexta', 'Sáb.'];

  // ---------- Datas ----------
  function partes(dataISO) {
    const [a, m, d] = dataISO.split('-').map(Number);
    return { a, m, d };
  }
  function diaSemana(dataISO) {
    const { a, m, d } = partes(dataISO);
    return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  }
  function diasNoMes(mes) {
    const [a, m] = mes.split('-').map(Number);
    return new Date(Date.UTC(a, m, 0)).getUTCDate();
  }
  function proximoMes(mes, delta = 1) {
    const [a, m] = mes.split('-').map(Number);
    const dt = new Date(Date.UTC(a, m - 1 + delta, 1));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  function nomeMes(mes) {
    const [a, m] = mes.split('-').map(Number);
    return `${MESES[m - 1]} ${a}`;
  }
  function dataBR(dataISO) {
    const { a, m, d } = partes(dataISO);
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`;
  }
  function rotuloData(dataISO) {
    const { a, m, d } = partes(dataISO);
    return `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${a} - ${DIAS_CURTOS[diaSemana(dataISO)]}`;
  }

  /** Lista os cultos padrão de um mês a partir dos tipos de culto configurados. */
  function cultosDoMes(mes, config) {
    const total = diasNoMes(mes);
    const cont = {};
    const ocorrencias = [];
    for (let d = 1; d <= total; d++) {
      const data = `${mes}-${String(d).padStart(2, '0')}`;
      const ds = diaSemana(data);
      for (const tipo of config.tipos_culto) {
        if (tipo.ativo === false || tipo.dia_semana !== ds) continue;
        cont[tipo.id] = (cont[tipo.id] || 0) + 1;
        ocorrencias.push({ data, tipo, n: cont[tipo.id] });
      }
    }
    return ocorrencias.map(({ data, tipo, n }) => {
      const porOc = tipo.nome_por_ocorrencia || {};
      const ultimo = !ocorrencias.some(o => o.tipo.id === tipo.id && o.n > n);
      const nome = porOc[String(n)] || (ultimo && porOc.ultimo) || tipo.nome;
      return { id: `${data}-${tipo.id}`, data, tipo: tipo.id, culto: nome };
    });
  }

  // ---------- Nomes ----------
  function nomeCurto(o) {
    if (!o) return '?';
    return (o.titulo ? o.titulo + ' ' : '') + o.nome;
  }
  function juntar(lista) {
    if (lista.length <= 1) return lista.join('');
    return lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1];
  }
  /** "Prs. Gilney e Sheila" quando todos são pastores; senão "Erny e Aux. Simone". */
  function juntarNomes(ids, mapa) {
    const pessoas = ids.map(id => mapa[id] || { nome: id + ' (?)' });
    if (pessoas.length >= 2 && pessoas.every(p => p.titulo === 'Pr.' || p.titulo === 'Pra.')) {
      return 'Prs. ' + juntar(pessoas.map(p => p.nome));
    }
    return juntar(pessoas.map(nomeCurto));
  }

  function tipoDoCulto(culto, config) {
    return config.tipos_culto.find(t => t.id === culto.tipo) || null;
  }
  function regraFuncao(culto, funcao, config) {
    const tipo = tipoDoCulto(culto, config);
    const base = { min: funcao.min ?? 1, max: funcao.max ?? 1 };
    const doTipo = tipo && tipo.funcoes && tipo.funcoes[funcao.id];
    return Object.assign(base, doTipo || {});
  }

  /** Linhas de texto de uma célula da escala (para tela, imagem e WhatsApp). */
  function linhasCelula(culto, funcao, config, mapa) {
    const cel = (culto.atribuicoes || {})[funcao.id] || { pessoas: [] };
    const ids = cel.pessoas || [];
    if (!ids.length) return cel.nota ? [cel.nota] : [];
    const tipo = tipoDoCulto(culto, config);
    const modelo = cel.modelo || (tipo && tipo.modelos && tipo.modelos[funcao.id]);
    if (modelo) return [modelo.replace('{pessoas}', juntarNomes(ids, mapa))];
    if (cel.nota) return [`${cel.nota} = ${juntarNomes(ids, mapa)}`];
    if (funcao.ordinal && ids.length === 2) {
      return ids.map((id, i) => `${i + 1}° ${nomeCurto(mapa[id] || { nome: id })}`);
    }
    if (ids.length > 2) return [ids.map(id => nomeCurto(mapa[id] || { nome: id })).join(', ')];
    return [juntarNomes(ids, mapa)];
  }

  // ---------- Validação ----------
  function mapaObreiros(obreiros) {
    const m = {};
    for (const o of obreiros) m[o.id] = o;
    return m;
  }

  function usoNoMes(escala, config) {
    const uso = {};
    for (const c of escala.cultos || []) {
      for (const f of config.funcoes) {
        const ids = ((c.atribuicoes || {})[f.id] || {}).pessoas || [];
        for (const id of ids) {
          const u = uso[id] || (uso[id] = { tarefas: 0, cultos: new Set(), por_funcao: {} });
          u.tarefas++;
          u.cultos.add(c.id);
          u.por_funcao[f.id] = (u.por_funcao[f.id] || 0) + 1;
        }
      }
    }
    const saida = {};
    for (const [id, u] of Object.entries(uso)) {
      saida[id] = { tarefas: u.tarefas, cultos: u.cultos.size, por_funcao: u.por_funcao, datas: [...u.cultos].sort() };
    }
    return saida;
  }

  function dentroDe(data, ind) {
    return ind && ind.inicio && data >= ind.inicio && data <= (ind.fim || ind.inicio);
  }

  /**
   * Confere a escala contra as regras ESTRUTURADAS (cadastro de obreiros e tipos de culto).
   * Regras em texto livre são responsabilidade da IA.
   * Com opcoes.aPartirDe (AAAA-MM-DD), cultos que já passaram não geram erro por culto
   * (ex.: uma regra mudou hoje — o que já aconteceu não precisa ser "corrigido").
   */
  function validar(escala, obreiros, config, opcoes = {}) {
    const mapa = mapaObreiros(obreiros);
    const erros = [];
    const avisos = [];
    const nomeF = Object.fromEntries(config.funcoes.map(f => [f.id, f.nome]));
    const add = (lista, culto, funcao, pessoa, msg) => lista.push({ culto: culto && culto.id, data: culto && culto.data, funcao, pessoa, msg });

    for (const c of escala.cultos || []) {
      if (opcoes.aPartirDe && c.data < opcoes.aPartirDe) continue;
      const ds = diaSemana(c.data);
      if (!c.data.startsWith(escala.mes)) add(erros, c, null, null, `Culto ${c.data} está fora do mês ${escala.mes}.`);
      for (const f of config.funcoes) {
        const cel = (c.atribuicoes || {})[f.id] || { pessoas: [] };
        const ids = cel.pessoas || [];
        const r = regraFuncao(c, f, config);
        const rotulo = `${dataBR(c.data)} (${c.culto}) – ${f.nome}`;
        if (ids.length < r.min) add(erros, c, f.id, null, `${rotulo}: precisa de pelo menos ${r.min} pessoa(s).`);
        if (ids.length > r.max) add(erros, c, f.id, null, `${rotulo}: máximo de ${r.max} pessoa(s), tem ${ids.length}.`);
        if (new Set(ids).size !== ids.length) add(erros, c, f.id, null, `${rotulo}: pessoa repetida.`);
        for (const id of ids) {
          const o = mapa[id];
          if (!o) { add(erros, c, f.id, id, `${rotulo}: "${id}" não está cadastrado.`); continue; }
          const nome = nomeCurto(o);
          if (o.status !== 'ativo') add(erros, c, f.id, id, `${rotulo}: ${nome} não está ativo (status: ${o.status}).`);
          if (!(o.funcoes || []).includes(f.id)) add(erros, c, f.id, id, `${rotulo}: ${nome} não faz ${f.nome}.`);
          if (o.dias && o.dias.length && !o.dias.includes(ds)) add(erros, c, f.id, id, `${rotulo}: ${nome} não está disponível ${ds === 0 || ds === 6 ? 'aos' : 'às'} ${DIAS[ds].toLowerCase()}s.`);
          for (const ind of o.indisponibilidades || []) {
            if (dentroDe(c.data, ind)) add(erros, c, f.id, id, `${rotulo}: ${nome} está indisponível nessa data${ind.motivo ? ' (' + ind.motivo + ')' : ''}.`);
          }
        }
      }
    }

    const uso = usoNoMes(escala, config);
    for (const [id, u] of Object.entries(uso)) {
      const o = mapa[id];
      if (!o) continue;
      const nome = nomeCurto(o);
      const lim = o.limites || {};
      if (lim.tarefas_mes != null && u.tarefas > lim.tarefas_mes) add(erros, null, null, id, `${nome}: ${u.tarefas} tarefas no mês, limite é ${lim.tarefas_mes}.`);
      if (lim.cultos_mes != null && u.cultos > lim.cultos_mes) add(erros, null, null, id, `${nome}: escalado(a) em ${u.cultos} cultos, limite é ${lim.cultos_mes}.`);
      for (const [fid, max] of Object.entries(lim.por_funcao || {})) {
        if (max != null && (u.por_funcao[fid] || 0) > max) add(erros, null, fid, id, `${nome}: ${u.por_funcao[fid]}x ${nomeF[fid] || fid} no mês, limite é ${max}.`);
      }
    }
    for (const o of obreiros) {
      if (o.status === 'ativo' && (o.funcoes || []).length && !uso[o.id]) add(avisos, null, null, o.id, `${nomeCurto(o)} não foi escalado(a) neste mês.`);
    }
    return { ok: erros.length === 0, erros, avisos, uso };
  }

  const API = {
    MESES, DIAS, DIAS_CURTOS, diaSemana, diasNoMes, proximoMes, nomeMes, dataBR, rotuloData,
    cultosDoMes, nomeCurto, juntarNomes, linhasCelula, regraFuncao, tipoDoCulto, mapaObreiros, usoNoMes, validar,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.Escala = API;
})(typeof window !== 'undefined' ? window : globalThis);
