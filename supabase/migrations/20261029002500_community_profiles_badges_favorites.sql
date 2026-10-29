-- Loading... Comunidade (perfil, apelido, favoritos, XP/nível, insígnias)
-- Extends public.profiles, creates profile_favorites, badge_definitions, user_badges,
-- server-side gamification triggers, anti-spoofing guards, and RLS policies.

create extension if not exists pgcrypto;

-- ============================================================================
-- 1. FUNÇÕES UTILITÁRIAS DE APELIDO
-- ============================================================================

create or replace function public.sanitize_apelido_base(p_input text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_clean text;
begin
  v_clean := lower(coalesce(p_input, ''));
  -- Transliteração básica de acentos comuns do português
  v_clean := translate(
    v_clean,
    'áàâãäéèêëíìîïóòôõöúùûüçñ',
    'aaaaaeeeeiiiiooooouuuucn'
  );
  v_clean := regexp_replace(v_clean, '[^a-z0-9_]+', '_', 'g');
  v_clean := regexp_replace(v_clean, '_+', '_', 'g');
  v_clean := trim(both '_' from v_clean);

  if v_clean = '' then
    v_clean := 'player';
  end if;

  while char_length(v_clean) < 3 loop
    v_clean := v_clean || '0';
  end loop;

  return left(v_clean, 18);
end;
$$;

create or replace function public.generate_unique_apelido(
  p_seed text,
  p_exclude_user_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text := public.sanitize_apelido_base(p_seed);
  v_candidate text;
  v_suffix int := 0;
  v_exists boolean;
begin
  loop
    if v_suffix = 0 then
      v_candidate := left(v_base, 24);
    elsif v_suffix < 1000 then
      v_candidate := left(v_base, 24 - 1 - char_length(v_suffix::text)) || '_' || v_suffix::text;
    else
      v_candidate := left(v_base, 17) || '_' || substr(encode(gen_random_bytes(3), 'hex'), 1, 6);
    end if;

    select exists (
      select 1
      from public.profiles p
      where lower(p.apelido) = lower(v_candidate)
        and (p_exclude_user_id is null or p.id <> p_exclude_user_id)
    ) into v_exists;

    if not v_exists then
      return v_candidate;
    end if;

    v_suffix := v_suffix + 1;
  end loop;
end;
$$;

revoke all on function public.generate_unique_apelido(text, uuid) from public;
revoke all on function public.generate_unique_apelido(text, uuid) from anon;
revoke all on function public.generate_unique_apelido(text, uuid) from authenticated;

-- ============================================================================
-- 2. EXTENSÃO DE public.profiles + BACKFILL
-- ============================================================================

alter table public.profiles
  add column if not exists apelido text,
  add column if not exists bio text not null default '',
  add column if not exists status_line text not null default '',
  add column if not exists level int not null default 1,
  add column if not exists xp int not null default 0,
  add column if not exists topics_count int not null default 0,
  add column if not exists replies_count int not null default 0,
  add column if not exists favorites_count int not null default 0,
  add column if not exists importance_score int not null default 0;

-- Backfill apelido para rows existentes (display_name ou email local-part + sufixo se colidir)
do $$
declare
  r record;
  v_seed text;
begin
  for r in
    select
      p.id,
      p.display_name,
      u.email
    from public.profiles p
    left join auth.users u on u.id = p.id
    where p.apelido is null
       or p.apelido !~ '^[a-z0-9_]{3,24}$'
    order by p.created_at asc, p.id asc
  loop
    v_seed := coalesce(
      nullif(trim(r.display_name), ''),
      nullif(split_part(coalesce(r.email, ''), '@', 1), ''),
      'player'
    );
    update public.profiles
       set apelido = public.generate_unique_apelido(v_seed, r.id)
     where id = r.id;
  end loop;
end;
$$;

alter table public.profiles
  alter column apelido set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_apelido_format_chk'
  ) then
    alter table public.profiles
      add constraint profiles_apelido_format_chk
      check (char_length(apelido) between 3 and 24 and apelido ~ '^[a-z0-9_]+$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_bio_len_chk'
  ) then
    alter table public.profiles
      add constraint profiles_bio_len_chk
      check (char_length(bio) <= 280);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_status_line_len_chk'
  ) then
    alter table public.profiles
      add constraint profiles_status_line_len_chk
      check (char_length(status_line) <= 80);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_level_range_chk'
  ) then
    alter table public.profiles
      add constraint profiles_level_range_chk
      check (level >= 1 and level <= 5);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_stats_nonnegative_chk'
  ) then
    alter table public.profiles
      add constraint profiles_stats_nonnegative_chk
      check (
        xp >= 0
        and topics_count >= 0
        and replies_count >= 0
        and favorites_count >= 0
        and importance_score >= 0
      );
  end if;
end;
$$;

create unique index if not exists profiles_apelido_lower_uidx
  on public.profiles (lower(apelido));

create index if not exists profiles_importance_score_idx
  on public.profiles (importance_score desc, xp desc);

-- ============================================================================
-- 3. NOVAS TABELAS: profile_favorites, badge_definitions, user_badges
-- ============================================================================

create table if not exists public.profile_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_key text not null,
  game_name text not null,
  poster_url text not null default '',
  position int not null default 1,
  created_at timestamptz not null default now(),
  constraint profile_favorites_game_key_len check (char_length(trim(game_key)) between 1 and 100),
  constraint profile_favorites_game_name_len check (char_length(trim(game_name)) between 1 and 160),
  constraint profile_favorites_poster_url_len check (char_length(poster_url) <= 600),
  constraint profile_favorites_position_range check (position between 1 and 8),
  constraint profile_favorites_user_game_unique unique (user_id, game_key)
);

create index if not exists profile_favorites_user_pos_idx
  on public.profile_favorites (user_id, position asc, created_at asc);

-- Trigger para limitar máximo de 8 jogos favoritos por usuário e normalizar position.
-- Advisory lock por user_id evita race: dois INSERTs concorrentes verem count < 8.
create or replace function public.enforce_profile_favorites_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_next_pos int;
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(
      hashtext('profile_favorites'),
      hashtext(new.user_id::text)
    );

    select count(*) into v_count
    from public.profile_favorites
    where user_id = new.user_id;

    if v_count >= 8 then
      raise exception 'Limite máximo de 8 jogos favoritos atingido para este perfil.'
        using errcode = 'check_violation';
    end if;

    if new.position is null or new.position < 1 or new.position > 8 then
      select coalesce(max(position), 0) + 1 into v_next_pos
      from public.profile_favorites
      where user_id = new.user_id;
      new.position := least(greatest(v_next_pos, 1), 8);
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_profile_favorites_limit() from public;
revoke all on function public.enforce_profile_favorites_limit() from anon;
revoke all on function public.enforce_profile_favorites_limit() from authenticated;

drop trigger if exists profile_favorites_enforce_limit on public.profile_favorites;
create trigger profile_favorites_enforce_limit
before insert on public.profile_favorites
for each row execute function public.enforce_profile_favorites_limit();

create table if not exists public.badge_definitions (
  code text primary key,
  title text not null,
  description text not null,
  constraint badge_definitions_code_len check (char_length(code) between 2 and 40),
  constraint badge_definitions_title_len check (char_length(title) between 2 and 80),
  constraint badge_definitions_desc_len check (char_length(description) between 2 and 240)
);

insert into public.badge_definitions (code, title, description)
values
  ('first_post',   'Primeira Publicação',   'Criou o primeiro tópico na comunidade.'),
  ('posts_5',      'Voz Ativa',             'Publicou 5 tópicos no fórum.'),
  ('posts_10',     'Criador de Pauta',      'Publicou 10 tópicos no fórum.'),
  ('posts_25',     'Lenda do Fórum',        'Publicou 25 tópicos no fórum.'),
  ('replies_10',   'Debatedor',             'Participou com 10 respostas em discussões.'),
  ('collector_3',  'Curador Iniciante',     'Adicionou 3 jogos favoritos à estante do perfil.'),
  ('collector_8',  'Estante Completa',      'Preencheu todos os 8 espaços de jogos favoritos.'),
  ('feedback_3',   'Construtor do Acervo',  'Enviou 3 feedbacks para evoluir a plataforma.'),
  ('veteran_30d',  'Veterano Loading',      'Membro da comunidade há pelo menos 30 dias com atividade registrada.')
on conflict (code) do update
  set title = excluded.title,
      description = excluded.description;

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_code text not null references public.badge_definitions (code) on delete cascade,
  earned_at timestamptz not null default now(),
  constraint user_badges_user_badge_unique unique (user_id, badge_code)
);

create index if not exists user_badges_user_id_earned_idx
  on public.user_badges (user_id, earned_at desc);

-- ============================================================================
-- 4. CÁLCULO DE LEVEL, XP, IMPORTANCE E CONCESSÃO DE INSÍGNIAS
-- ============================================================================

-- Levels: 1=0 (Novato), 2=20, 3=50, 4=100, 5=200
create or replace function public.calc_profile_level(p_xp int)
returns int
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(p_xp, 0) >= 200 then 5
    when coalesce(p_xp, 0) >= 100 then 4
    when coalesce(p_xp, 0) >= 50  then 3
    when coalesce(p_xp, 0) >= 20  then 2
    else 1
  end;
$$;

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
  v_xp int := 0;
  v_level int := 1;
  v_importance int := 0;
  v_created_at timestamptz;
begin
  if p_user_id is null then
    return;
  end if;

  select created_at into v_created_at
  from public.profiles
  where id = p_user_id;

  if not found then
    return;
  end if;

  select count(*) into v_topics
  from public.forum_topics
  where author_id = p_user_id;

  select count(*) into v_replies
  from public.forum_replies
  where author_id = p_user_id;

  select count(*) into v_feedbacks
  from public.feedbacks
  where author_id = p_user_id;

  select count(*) into v_favorites
  from public.profile_favorites
  where user_id = p_user_id;

  -- XP: topic +10, reply +3, feedback +5, favorite +2
  v_xp := (v_topics * 10) + (v_replies * 3) + (v_feedbacks * 5) + (v_favorites * 2);
  v_level := public.calc_profile_level(v_xp);
  v_importance := v_xp + (v_favorites * 5);

  perform set_config('loading.bypass_profile_guard', 'on', true);

  update public.profiles
     set topics_count = v_topics,
         replies_count = v_replies,
         favorites_count = v_favorites,
         xp = v_xp,
         level = v_level,
         importance_score = v_importance
   where id = p_user_id;

  -- Conceder insígnias faltantes
  insert into public.user_badges (user_id, badge_code)
  select p_user_id, b.code
  from (
    select 'first_post'  as code where v_topics >= 1
    union all
    select 'posts_5'     as code where v_topics >= 5
    union all
    select 'posts_10'    as code where v_topics >= 10
    union all
    select 'posts_25'    as code where v_topics >= 25
    union all
    select 'replies_10'  as code where v_replies >= 10
    union all
    select 'collector_3' as code where v_favorites >= 3
    union all
    select 'collector_8' as code where v_favorites >= 8
    union all
    select 'feedback_3'  as code where v_feedbacks >= 3
    union all
    select 'veteran_30d' as code where v_created_at <= now() - interval '30 days'
  ) b
  on conflict (user_id, badge_code) do nothing;
end;
$$;

revoke all on function public.recompute_user_community_stats(uuid) from public;
revoke all on function public.recompute_user_community_stats(uuid) from anon;
revoke all on function public.recompute_user_community_stats(uuid) from authenticated;

-- Trigger unificada pós-insert/delete nas 4 tabelas de atividade
create or replace function public.on_community_activity_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  if tg_table_name = 'profile_favorites' then
    v_uid := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
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

drop trigger if exists forum_topics_community_stats_trg on public.forum_topics;
create trigger forum_topics_community_stats_trg
after insert or delete on public.forum_topics
for each row execute function public.on_community_activity_change();

drop trigger if exists forum_replies_community_stats_trg on public.forum_replies;
create trigger forum_replies_community_stats_trg
after insert or delete on public.forum_replies
for each row execute function public.on_community_activity_change();

drop trigger if exists feedbacks_community_stats_trg on public.feedbacks;
create trigger feedbacks_community_stats_trg
after insert or delete on public.feedbacks
for each row execute function public.on_community_activity_change();

drop trigger if exists profile_favorites_community_stats_trg on public.profile_favorites;
create trigger profile_favorites_community_stats_trg
after insert or delete on public.profile_favorites
for each row execute function public.on_community_activity_change();

-- ============================================================================
-- 5. BLOQUEIO DE UPDATE CLIENT EM CAMPOS DE GAMIFICAÇÃO + APELIDO SYNC
-- ============================================================================

create or replace function public.guard_profile_Updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Normaliza + valida apelido no servidor (unique case-insensitive via índice;
  -- formato reforçado aqui além do CHECK constraint)
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

  -- Se a chamada não vier de trigger interna (bypass_profile_guard = 'on')
  -- nem de service_role / postgres admin, restaura todas as colunas calculadas pelo servidor
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
    new.created_at := old.created_at;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_profile_Updates() from public;
revoke all on function public.guard_profile_Updates() from anon;
revoke all on function public.guard_profile_Updates() from authenticated;

drop trigger if exists profiles_guard_protected_fields on public.profiles;
create trigger profiles_guard_protected_fields
before update on public.profiles
for each row execute function public.guard_profile_Updates();

-- ============================================================================
-- 6. ATUALIZAÇÃO DE handle_new_user E set_author_display_from_profile
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first text := coalesce(nullif(trim(new.raw_user_meta_data->>'first_name'), ''), '');
  v_last text := coalesce(nullif(trim(new.raw_user_meta_data->>'last_name'), ''), '');
  v_raw_apelido text := lower(coalesce(nullif(trim(new.raw_user_meta_data->>'apelido'), ''), ''));
  v_email_local text := split_part(coalesce(new.email, 'membro'), '@', 1);
  v_display text;
  v_apelido text;
  v_seed text;
  v_attempts int := 0;
begin
  v_display := nullif(trim(both from concat_ws(' ', v_first, v_last)), '');
  if v_display is null then
    v_display := coalesce(nullif(v_email_local, ''), 'membro');
  end if;

  v_seed := coalesce(nullif(v_raw_apelido, ''), nullif(v_email_local, ''), v_display);

  -- Aceita raw_user_meta_data.apelido se válido e disponível; senão gera do seed
  if v_raw_apelido ~ '^[a-z0-9_]{3,24}$'
     and not exists (select 1 from public.profiles p where lower(p.apelido) = v_raw_apelido)
  then
    v_apelido := v_raw_apelido;
  else
    v_apelido := public.generate_unique_apelido(v_seed, new.id);
  end if;

  -- Retry em race de unique(lower(apelido)) entre signups concorrentes
  loop
    v_attempts := v_attempts + 1;
    begin
      insert into public.profiles (id, first_name, last_name, display_name, apelido)
      values (new.id, v_first, v_last, left(v_display, 120), v_apelido);
      exit;
    exception
      when unique_violation then
        if v_attempts >= 5 then
          raise;
        end if;
        v_apelido := public.generate_unique_apelido(v_seed, new.id);
    end;
  end loop;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

-- Preferir apelido com fallback para display_name ao gravar em forum_topics, forum_replies, feedbacks
create or replace function public.set_author_display_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select coalesce(
    nullif(trim(apelido), ''),
    nullif(trim(display_name), '')
  )
  into v_name
  from public.profiles
  where id = new.author_id;

  if v_name is null then
    v_name := 'membro';
  end if;

  new.author_display := left(v_name, 120);
  return new;
end;
$$;

revoke all on function public.set_author_display_from_profile() from public;
revoke all on function public.set_author_display_from_profile() from anon;
revoke all on function public.set_author_display_from_profile() from authenticated;

-- Sincronizar author_display nos registros existentes caso o usuário atualize apelido/display_name
create or replace function public.sync_author_display_on_profile_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := left(coalesce(nullif(trim(new.apelido), ''), nullif(trim(new.display_name), ''), 'membro'), 120);
begin
  if coalesce(new.apelido, '') is distinct from coalesce(old.apelido, '')
     or coalesce(new.display_name, '') is distinct from coalesce(old.display_name, '')
  then
    update public.forum_topics set author_display = v_name where author_id = new.id and author_display is distinct from v_name;
    update public.forum_replies set author_display = v_name where author_id = new.id and author_display is distinct from v_name;
    update public.feedbacks set author_display = v_name where author_id = new.id and author_display is distinct from v_name;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_author_display_on_profile_change() from public;
revoke all on function public.sync_author_display_on_profile_change() from anon;
revoke all on function public.sync_author_display_on_profile_change() from authenticated;

drop trigger if exists profiles_sync_author_display on public.profiles;
create trigger profiles_sync_author_display
after update of apelido, display_name on public.profiles
for each row execute function public.sync_author_display_on_profile_change();

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS) E PRIVILÉGIOS DE COLUNA
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.profile_favorites enable row level security;
alter table public.badge_definitions enable row level security;
alter table public.user_badges enable row level security;

-- Least privilege: limpa grants amplos de PUBLIC / client roles nas tabelas novas
revoke all on table public.profile_favorites from public;
revoke all on table public.badge_definitions from public;
revoke all on table public.user_badges from public;
revoke all on table public.profile_favorites from anon, authenticated;
revoke all on table public.badge_definitions from anon, authenticated;
revoke all on table public.user_badges from anon, authenticated;

-- SELECT público nas tabelas novas (necessário p/ PostgREST / anon key)
grant select on table public.profile_favorites to anon, authenticated;
grant select on table public.badge_definitions to anon, authenticated;
grant select on table public.user_badges to anon, authenticated;

-- Favorites: CRUD só authenticated (RLS restringe ao próprio user_id)
grant insert, update, delete on table public.profile_favorites to authenticated;

-- badge_definitions / user_badges: client NÃO escreve (só security definer / owner)
revoke insert, update, delete on table public.badge_definitions from anon, authenticated;
revoke insert, update, delete on table public.user_badges from anon, authenticated;

-- profiles: sem INSERT/DELETE client; UPDATE só colunas editáveis (bloqueia xp/level/*_count)
revoke insert, delete on public.profiles from public;
revoke insert, delete, update on public.profiles from anon;
revoke insert, delete, update on public.profiles from authenticated;
grant select on table public.profiles to anon, authenticated;
grant update (first_name, last_name, display_name, apelido, bio, status_line) on public.profiles to authenticated;

-- Policies de public.profiles (mantém profiles_select_public e profiles_update_own)
drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public on public.profiles
  for select to anon, authenticated using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Policies de public.profile_favorites
drop policy if exists profile_favorites_select_public on public.profile_favorites;
create policy profile_favorites_select_public on public.profile_favorites
  for select to anon, authenticated using (true);

drop policy if exists profile_favorites_insert_own on public.profile_favorites;
create policy profile_favorites_insert_own on public.profile_favorites
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists profile_favorites_update_own on public.profile_favorites;
create policy profile_favorites_update_own on public.profile_favorites
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists profile_favorites_delete_own on public.profile_favorites;
create policy profile_favorites_delete_own on public.profile_favorites
  for delete to authenticated
  using (user_id = auth.uid());

-- Policies de public.badge_definitions (somente leitura pública; sem policy de escrita)
drop policy if exists badge_definitions_select_public on public.badge_definitions;
create policy badge_definitions_select_public on public.badge_definitions
  for select to anon, authenticated using (true);

-- Policies de public.user_badges (SELECT público; INSERT/UPDATE/DELETE só via security definer)
drop policy if exists user_badges_select_public on public.user_badges;
create policy user_badges_select_public on public.user_badges
  for select to anon, authenticated using (true);

-- ============================================================================
-- 8. BACKFILL DE CONTADORES, XP, LEVEL, IMPORTANCE E BADGES PARA PERFIS EXISTENTES
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
