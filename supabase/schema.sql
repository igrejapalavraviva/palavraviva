-- Estrutura do banco — Igreja Palavra Viva
create table if not exists public.config (id int primary key default 1 check (id = 1), dados jsonb not null, atualizado_em timestamptz default now());
create table if not exists public.site (id int primary key default 1 check (id = 1), dados jsonb not null, atualizado_em timestamptz default now());

create table if not exists public.membros (
  id text primary key,
  nome text not null,
  nome_completo text default '',
  titulo text default '',
  cargo text default '',
  sexo text default '',
  nascimento date,
  estado_civil text default '',
  conjuge_id text,
  telefone text default '',
  whatsapp_nome text default '',
  email text default '',
  endereco text default '',
  bairro text default '',
  cidade text default '',
  cep text default '',
  batismo date,
  membro_desde date,
  status text not null default 'ativo',
  observacoes text default '',
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

create table if not exists public.obreiros (
  id text primary key,
  membro_id text not null,
  status text not null default 'ativo',
  funcoes jsonb not null default '[]',
  dias jsonb not null default '[]',
  limites jsonb not null default '{}',
  parceiro_id text,
  indisponibilidades jsonb not null default '[]',
  regras text default '',
  observacoes text default '',
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

create table if not exists public.contatos (id text primary key, whatsapp_nome text not null, telefone text default '', obs text default '');

create table if not exists public.eventos (
  id text primary key,
  titulo text not null,
  data_inicio date not null,
  data_fim date,
  hora_inicio text default '',
  hora_fim text default '',
  local text default '',
  categoria text default '',
  publico boolean not null default false,
  descricao text default '',
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

create table if not exists public.escalas (mes text primary key, dados jsonb not null, atualizado_em timestamptz default now());
create table if not exists public.chats (mes text primary key, mensagens jsonb not null default '[]', atualizado_em timestamptz default now());
create table if not exists public.historico (id text primary key, quando timestamptz not null, dados jsonb not null);

create index if not exists membros_nascimento on public.membros (nascimento);
create index if not exists eventos_data on public.eventos (data_inicio);
create index if not exists historico_quando on public.historico (quando);

-- Segurança: tudo exige login; o site público só lê o texto do site e os eventos marcados como públicos.
do $$
declare t text;
begin
  foreach t in array array['config','site','membros','obreiros','contatos','eventos','escalas','chats','historico'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "equipe_logada" on public.%I', t);
    execute format('create policy "equipe_logada" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
drop policy if exists "site_publico" on public.site;
create policy "site_publico" on public.site for select to anon using (true);
drop policy if exists "eventos_publicos" on public.eventos;
create policy "eventos_publicos" on public.eventos for select to anon using (publico);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.config, public.site, public.membros, public.obreiros, public.contatos,
  public.eventos, public.escalas, public.chats, public.historico to authenticated;
grant select on public.site, public.eventos to anon;
