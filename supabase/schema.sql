-- Sinal Fantasma: banco do Online local
-- Cole no SQL Editor do Supabase e execute uma vez.

create table if not exists public.docs (
  path       text primary key,            -- ex.: games/ABCDE/players/xyz
  game       text not null,               -- código da partida (ex.: ABCDE)
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists docs_game_idx on public.docs (game);
create index if not exists docs_updated_idx on public.docs (updated_at);

alter table public.docs enable row level security;

-- O jogo funciona na confiança entre amigos (como já era): qualquer visitante lê e grava.
drop policy if exists docs_open on public.docs;
create policy docs_open on public.docs for all to anon using (true) with check (true);

-- Tempo real
alter publication supabase_realtime add table public.docs;

-- Limpeza: apaga partidas paradas há mais de 2 dias (rode manualmente ou agende com pg_cron).
create or replace function public.purge_old_games() returns void language sql as $$
  delete from public.docs where updated_at < now() - interval '2 days';
$$;
