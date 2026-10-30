-- Loading... v2: Diário de jogos, reações no fórum, nota nos tópicos e novas insígnias.
-- Cria public.game_logs e public.forum_reactions, adiciona forum_topics.rating,
-- estende profiles com contadores do diário/reações e atualiza o cálculo de XP.
-- Idempotente: pode ser reaplicada sem efeitos colaterais.

-- ============================================================================
-- 1. NOTA OPCIONAL NOS TÓPICOS
-- ============================================================================

alter table public.forum_topics
  add column if not exists rating smallint;

alter table public.forum_topics
  drop constraint if exists forum_topics_rating_ok;
alter table public.forum_topics
  add constraint forum_topics_rating_ok check (rating is null or rating between 1 and 5);

-- ============================================================================
-- 2. CONTADORES NOVOS EM PROFILES (calculados só no servidor)
-- ============================================================================

alter table public.profiles add column if not exists finished_count int not null default 0;
alter table public.profiles add column if not exists playing_count int not null default 0;
alter table public.profiles add column if not exists backlog_count int not null default 0;
alter table public.profiles add column if not exists dropped_count int not null default 0;
alter table public.profiles add column if not exists logs_count int not null default 0;
alter table public.profiles add column if not exists reactions_received int not null default 0;

-- ============================================================================
-- 3. DIÁRIO DE JOGOS (game_logs)
-- ============================================================================

create table if not exists public.game_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_key text not null,
  game_name text not null,
  poster_url text not null default '',
  released_year smallint,
  status text not null,
  rating smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_logs_status_ok check (status in ('jogando', 'zerado', 'na_fila', 'abandonado')),
  constraint game_logs_rating_ok check (rating is null or rating between 1 and 5),
  constraint game_logs_key_len check (char_length(trim(game_key)) between 1 and 100),
  constraint game_logs_name_len check (char_length(trim(game_name)) between 1 and 160),
  constraint game_logs_poster_len check (char_length(poster_url) <= 600),
  constraint game_logs_year_ok check (released_year is null or released_year between 1950 and 2100),
  constraint game_logs_user_game_unique unique (user_id, game_key)
);

create index if not exists game_logs_user_status_idx
  on public.game_logs (user_id, status, updated_at desc);

drop trigger if exists game_logs_set_updated_at on public.game_logs;
create trigger game_logs_set_updated_at
before update on public.game_logs
for each row execute function public.set_updated_at();

-- Limite de 500 registros por perfil (advisory lock evita corrida entre INSERTs)
create or replace function public.enforce_game_logs_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  perform pg_advisory_xact_lock(hashtext('game_logs'), hashtext(new.user_id::text));
  select count(*) into v_count from public.game_logs where user_id = new.user_id;
  if v_count >= 500 then
    raise exception 'Limite de 500 jogos no diário atingido.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_game_logs_limit() from public;
revoke all on function public.enforce_game_logs_limit() from anon;
revoke all on function public.enforce_game_logs_limit() from authenticated;

drop trigger if exists game_logs_enforce_limit on public.game_logs;
create trigger game_logs_enforce_limit
before insert on public.game_logs
for each row execute function public.enforce_game_logs_limit();

-- ============================================================================
-- 4. REAÇÕES NO FÓRUM (forum_reactions)
-- ============================================================================

create table if not exists public.forum_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  target_author_id uuid references public.profiles (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now(),
  constraint forum_reactions_type_ok check (target_type in ('topic', 'reply')),
  constraint forum_reactions_kind_ok check (kind in ('gg', 'util')),
  constraint forum_reactions_unique unique (user_id, target_type, target_id, kind)
);

create index if not exists forum_reactions_target_idx
  on public.forum_reactions (target_id, kind);
create index if not exists forum_reactions_author_idx
  on public.forum_reactions (target_author_id);
create index if not exists forum_reactions_user_time_idx
  on public.forum_reactions (user_id, created_at desc);

-- O servidor decide quem recebe o crédito; o cliente não escolhe target_author_id.
-- Bloqueia reação ao próprio post e limita a 60 reações por hora.
create or replace function public.prepare_forum_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
  v_recent int;
begin
  if new.target_type = 'topic' then
    select author_id into v_author from public.forum_topics where id = new.target_id;
  else
    select author_id into v_author from public.forum_replies where id = new.target_id;
  end if;

  if v_author is null then
    raise exception 'Publicação não encontrada.' using errcode = 'foreign_key_violation';
  end if;

  if v_author = new.user_id then
    raise exception 'Não é possível reagir à própria publicação.' using errcode = 'check_violation';
  end if;

  select count(*) into v_recent
  from public.forum_reactions
  where user_id = new.user_id and created_at > now() - interval '1 hour';
  if v_recent >= 60 then
    raise exception 'Muitas reações em pouco tempo. Tente mais tarde.' using errcode = 'check_violation';
  end if;

  new.target_author_id := v_author;
  new.created_at := now();
  return new;
end;
$$;

revoke all on function public.prepare_forum_reaction() from public;
revoke all on function public.prepare_forum_reaction() from anon;
revoke all on function public.prepare_forum_reaction() from authenticated;

drop trigger if exists forum_reactions_prepare on public.forum_reactions;
create trigger forum_reactions_prepare
before insert on public.forum_reactions
for each row execute function public.prepare_forum_reaction();

-- Remove reações órfãs quando o tópico/resposta é apagado
create or replace function public.cleanup_forum_reactions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.forum_reactions
  where target_id = old.id
    and target_type = case when tg_table_name = 'forum_topics' then 'topic' else 'reply' end;
  return null;
end;
$$;

revoke all on function public.cleanup_forum_reactions() from public;
revoke all on function public.cleanup_forum_reactions() from anon;
revoke all on function public.cleanup_forum_reactions() from authenticated;

drop trigger if exists forum_topics_cleanup_reactions on public.forum_topics;
create trigger forum_topics_cleanup_reactions
after delete on public.forum_topics
for each row execute function public.cleanup_forum_reactions();

drop trigger if exists forum_replies_cleanup_reactions on public.forum_replies;
create trigger forum_replies_cleanup_reactions
after delete on public.forum_replies
for each row execute function public.cleanup_forum_reactions();

-- ============================================================================
-- 5. NOVAS INSÍGNIAS
-- ============================================================================

insert into public.badge_definitions (code, title, description)
values
  ('finished_10', 'Zerador',                  'Marcou 10 jogos como zerados no diário.'),
  ('finished_50', 'Mestre dos Créditos',      'Marcou 50 jogos como zerados no diário.'),
  ('backlog_25',  'Fila Infinita',            'Tem 25 jogos na fila do diário.'),
  ('gg_10',       'Bem Avaliado',             'Recebeu 10 reações da comunidade.'),
  ('gg_50',       'Referência da Comunidade', 'Recebeu 50 reações da comunidade.'),
  ('retro_5',     'Arqueólogo',               'Registrou 5 jogos lançados antes de 2000 no diário.')
on conflict (code) do update
  set title = excluded.title,
      description = excluded.description;

-- ============================================================================
-- 6. RECÁLCULO DE XP / NÍVEL / INSÍGNIAS
-- ============================================================================

create or replace function public.recompute_user_community_stats(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topics int := 0;
  v_replies int := 0;
  v_feedbacks int := 0;
  v_favorites int := 0;
  v_logs int := 0;
  v_finished int := 0;
  v_playing int := 0;
  v_backlog int := 0;
  v_dropped int := 0;
  v_retro int := 0;
  v_reactions int := 0;
  v_xp int := 0;
  v_level int := 1;
  v_importance int := 0;
  v_created_at timestamptz;
begin
  if p_user_id is null then
    return;
  end if;

  select created_at into v_created_at from public.profiles where id = p_user_id;
  if not found then
    return;
  end if;

  select count(*) into v_topics from public.forum_topics where author_id = p_user_id;
  select count(*) into v_replies from public.forum_replies where author_id = p_user_id;
  select count(*) into v_feedbacks from public.feedbacks where author_id = p_user_id;
  select count(*) into v_favorites from public.profile_favorites where user_id = p_user_id;

  select
    count(*),
    count(*) filter (where status = 'zerado'),
    count(*) filter (where status = 'jogando'),
    count(*) filter (where status = 'na_fila'),
    count(*) filter (where status = 'abandonado'),
    count(*) filter (where released_year is not null and released_year < 2000)
  into v_logs, v_finished, v_playing, v_backlog, v_dropped, v_retro
  from public.game_logs
  where user_id = p_user_id;

  select count(*) into v_reactions from public.forum_reactions where target_author_id = p_user_id;

  -- XP: topic +10, reply +3, feedback +5, favorite +2,
  --     zerado +3, registro no diário +1 (máx. 100 contados), reação recebida +2
  v_xp := (v_topics * 10) + (v_replies * 3) + (v_feedbacks * 5) + (v_favorites * 2)
        + (v_finished * 3) + least(v_logs, 100) + (v_reactions * 2);
  v_level := public.calc_profile_level(v_xp);
  v_importance := v_xp + (v_favorites * 5);

  perform set_config('loading.bypass_profile_guard', 'on', true);

  update public.profiles
     set topics_count = v_topics,
         replies_count = v_replies,
         favorites_count = v_favorites,
         logs_count = v_logs,
         finished_count = v_finished,
         playing_count = v_playing,
         backlog_count = v_backlog,
         dropped_count = v_dropped,
         reactions_received = v_reactions,
         xp = v_xp,
         level = v_level,
         importance_score = v_importance
   where id = p_user_id;

  perform set_config('loading.bypass_profile_guard', 'off', true);

  insert into public.user_badges (user_id, badge_code)
  select p_user_id, b.code
  from (
    select 'first_post'  as code where v_topics >= 1
    union all select 'posts_5'      where v_topics >= 5
    union all select 'posts_10'     where v_topics >= 10
    union all select 'posts_25'     where v_topics >= 25
    union all select 'replies_10'   where v_replies >= 10
    union all select 'collector_3'  where v_favorites >= 3
    union all select 'collector_8'  where v_favorites >= 8
    union all select 'feedback_3'   where v_feedbacks >= 3
    union all select 'veteran_30d'  where v_created_at <= now() - interval '30 days'
    union all select 'finished_10'  where v_finished >= 10
    union all select 'finished_50'  where v_finished >= 50
    union all select 'backlog_25'   where v_backlog >= 25
    union all select 'gg_10'        where v_reactions >= 10
    union all select 'gg_50'        where v_reactions >= 50
    union all select 'retro_5'      where v_retro >= 5
  ) b
  on conflict (user_id, badge_code) do nothing;
end;
$$;

revoke all on function public.recompute_user_community_stats(uuid) from public;
revoke all on function public.recompute_user_community_stats(uuid) from anon;
revoke all on function public.recompute_user_community_stats(uuid) from authenticated;

-- Trigger unificada: agora também cobre game_logs (user_id) e forum_reactions (autor do alvo)
create or replace function public.on_community_activity_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  if tg_table_name in ('profile_favorites', 'game_logs') then
    v_uid := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  elsif tg_table_name = 'forum_reactions' then
    v_uid := case when tg_op = 'DELETE' then old.target_author_id else new.target_author_id end;
  else
    v_uid := case when tg_op = 'DELETE' then old.author_id else new.author_id end;
  end if;

  perform public.recompute_user_community_stats(v_uid);
  return null;
end;
$$;

revoke all on function public.on_community_activity_change() from public;
revoke all on function public.on_community_activity_change() from anon;
revoke all on function public.on_community_activity_change() from authenticated;

drop trigger if exists game_logs_community_stats_trg on public.game_logs;
create trigger game_logs_community_stats_trg
after insert or update of status, released_year or delete on public.game_logs
for each row execute function public.on_community_activity_change();

drop trigger if exists forum_reactions_community_stats_trg on public.forum_reactions;
create trigger forum_reactions_community_stats_trg
after insert or delete on public.forum_reactions
for each row execute function public.on_community_activity_change();

-- ============================================================================
-- 7. GUARD DE PROFILES: novos contadores também são protegidos
-- ============================================================================

create or replace function public.guard_profile_Updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.apelido is not null then
    new.apelido := lower(trim(new.apelido));
    if new.apelido !~ '^[a-z0-9_]{3,24}$' then
      raise exception 'Apelido inválido: use 3–24 caracteres [a-z0-9_].'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.bio is not null then
    new.bio := left(new.bio, 280);
  end if;

  if new.status_line is not null then
    new.status_line := left(new.status_line, 80);
  end if;

  if coalesce(current_setting('loading.bypass_profile_guard', true), '') <> 'on'
     and coalesce(auth.role(), '') not in ('service_role', 'supabase_admin')
     and current_user not in ('postgres', 'supabase_admin')
  then
    new.xp := old.xp;
    new.level := old.level;
    new.topics_count := old.topics_count;
    new.replies_count := old.replies_count;
    new.favorites_count := old.favorites_count;
    new.importance_score := old.importance_score;
    new.logs_count := old.logs_count;
    new.finished_count := old.finished_count;
    new.playing_count := old.playing_count;
    new.backlog_count := old.backlog_count;
    new.dropped_count := old.dropped_count;
    new.reactions_received := old.reactions_received;
    new.created_at := old.created_at;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_profile_Updates() from public;
revoke all on function public.guard_profile_Updates() from anon;
revoke all on function public.guard_profile_Updates() from authenticated;

-- ============================================================================
-- 8. ROW LEVEL SECURITY E PRIVILÉGIOS
-- ============================================================================

alter table public.game_logs enable row level security;
alter table public.forum_reactions enable row level security;

revoke all on table public.game_logs from public;
revoke all on table public.forum_reactions from public;
revoke all on table public.game_logs from anon, authenticated;
revoke all on table public.forum_reactions from anon, authenticated;

grant select on table public.game_logs to anon, authenticated;
grant select on table public.forum_reactions to anon, authenticated;

-- Diário: o cliente escolhe só os campos do próprio registro
grant insert (user_id, game_key, game_name, poster_url, released_year, status, rating)
  on public.game_logs to authenticated;
grant update (game_name, poster_url, released_year, status, rating)
  on public.game_logs to authenticated;
grant delete on public.game_logs to authenticated;

-- Reações: sem UPDATE; target_author_id é preenchido pelo trigger
grant insert (user_id, target_type, target_id, kind) on public.forum_reactions to authenticated;
grant delete on public.forum_reactions to authenticated;

drop policy if exists game_logs_select_public on public.game_logs;
create policy game_logs_select_public on public.game_logs
  for select to anon, authenticated using (true);

drop policy if exists game_logs_insert_own on public.game_logs;
create policy game_logs_insert_own on public.game_logs
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists game_logs_update_own on public.game_logs;
create policy game_logs_update_own on public.game_logs
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists game_logs_delete_own on public.game_logs;
create policy game_logs_delete_own on public.game_logs
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists forum_reactions_select_public on public.forum_reactions;
create policy forum_reactions_select_public on public.forum_reactions
  for select to anon, authenticated using (true);

drop policy if exists forum_reactions_insert_own on public.forum_reactions;
create policy forum_reactions_insert_own on public.forum_reactions
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists forum_reactions_delete_own on public.forum_reactions;
create policy forum_reactions_delete_own on public.forum_reactions
  for delete to authenticated
  using (user_id = auth.uid());

-- ============================================================================
-- 9. BACKFILL
-- ============================================================================

do $$
declare
  r record;
begin
  for r in select id from public.profiles loop
    perform public.recompute_user_community_stats(r.id);
  end loop;
end;
$$;
