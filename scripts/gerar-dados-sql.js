// Gera o SQL de importação a partir dos arquivos de data/ (usado uma vez, na migração para o Supabase)
const fs = require('fs');
const path = require('path');
const D = path.join(__dirname, '..', 'data');
const ler = f => { try { return JSON.parse(fs.readFileSync(path.join(D, f), 'utf8')); } catch { return null; } };
const txt = v => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const data = v => (v ? txt(v) : 'null');
const js = v => `$J$${JSON.stringify(v)}$J$::jsonb`;
const L = ['begin;'];
L.push(`insert into public.config (id, dados) values (1, ${js(ler('config.json'))}) on conflict (id) do update set dados = excluded.dados;`);
L.push(`insert into public.site (id, dados) values (1, ${js(ler('site.json'))}) on conflict (id) do update set dados = excluded.dados;`);
for (const m of ler('membros.json') || []) {
  L.push(`insert into public.membros (id,nome,nome_completo,titulo,cargo,sexo,nascimento,estado_civil,conjuge_id,telefone,whatsapp_nome,email,endereco,bairro,cidade,cep,batismo,membro_desde,status,observacoes,criado_em,atualizado_em) values (${[m.id, m.nome, m.nome_completo, m.titulo, m.cargo, m.sexo].map(txt).join(',')},${data(m.nascimento)},${txt(m.estado_civil)},${m.conjuge_id ? txt(m.conjuge_id) : 'null'},${[m.telefone, m.whatsapp_nome, m.email, m.endereco, m.bairro, m.cidade, m.cep].map(txt).join(',')},${data(m.batismo)},${data(m.membro_desde)},${txt(m.status)},${txt(m.observacoes)},${txt(m.criado_em)},${txt(m.atualizado_em)}) on conflict (id) do nothing;`);
}
for (const o of ler('obreiros.json') || []) {
  L.push(`insert into public.obreiros (id,membro_id,status,funcoes,dias,limites,parceiro_id,indisponibilidades,regras,observacoes,criado_em,atualizado_em) values (${txt(o.id)},${txt(o.membro_id)},${txt(o.status)},${js(o.funcoes || [])},${js(o.dias || [])},${js(o.limites || {})},${o.parceiro_id ? txt(o.parceiro_id) : 'null'},${js(o.indisponibilidades || [])},${txt(o.regras)},${txt(o.observacoes)},${txt(o.criado_em)},${txt(o.atualizado_em)}) on conflict (id) do nothing;`);
}
for (const c of ler('contatos.json') || []) L.push(`insert into public.contatos (id,whatsapp_nome,telefone,obs) values (${[c.id, c.whatsapp_nome, c.telefone, c.obs].map(txt).join(',')}) on conflict (id) do nothing;`);
for (const e of ler('eventos.json') || []) {
  L.push(`insert into public.eventos (id,titulo,data_inicio,data_fim,hora_inicio,hora_fim,local,categoria,publico,descricao) values (${txt(e.id)},${txt(e.titulo)},${data(e.data_inicio)},${data(e.data_fim)},${[e.hora_inicio, e.hora_fim, e.local, e.categoria].map(txt).join(',')},${e.publico ? 'true' : 'false'},${txt(e.descricao)}) on conflict (id) do nothing;`);
}
for (const f of fs.readdirSync(path.join(D, 'escalas')).filter(f => /^\d{4}-\d{2}\.json$/.test(f))) {
  L.push(`insert into public.escalas (mes, dados) values (${txt(f.slice(0, 7))}, ${js(ler('escalas/' + f))}) on conflict (mes) do nothing;`);
}
for (const h of ler('historico_regras.json') || []) L.push(`insert into public.historico (id, quando, dados) values (${txt(h.id)}, ${txt(h.quando)}, ${js(h)}) on conflict (id) do nothing;`);
L.push('commit;');
const saida = process.argv[2] || '/dev/stdout';
fs.writeFileSync(saida, L.join('\n') + '\n');
