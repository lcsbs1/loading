-- Loading... forum + feedback + profiles
-- Applied remotely as forum_feedback_auth (+ forum_security_hardening)

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_first_name_len check (char_length(first_name) <= 50),
  constraint profiles_last_name_len check (char_length(last_name) <= 50),
  constraint profiles_display_name_len check (char_length(display_name) <= 120)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first text := coalesce(nullif(trim(new.raw_user_meta_data->>'first_name'), ''), '');
  v_last text := coalesce(nullif(trim(new.raw_user_meta_data->>'last_name'), ''), '');
  v_display text;
begin
  v_display := nullif(trim(both from concat_ws(' ', v_first, v_last)), '');
  if v_display is null then
    v_display := split_part(coalesce(new.email, 'membro'), '@', 1);
  end if;

  insert into public.profiles (id, first_name, last_name, display_name)
  values (new.id, v_first, v_last, v_display);
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table public.forum_topics (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_display text not null,
  game text not null default 'Geral',
  title text not null,
  body text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  constraint forum_topics_title_len check (char_length(trim(title)) >= 4 and char_length(title) <= 120),
  constraint forum_topics_body_len check (char_length(trim(body)) >= 10 and char_length(body) <= 4000),
  constraint forum_topics_game_len check (char_length(game) <= 80),
  constraint forum_topics_author_display_len check (char_length(author_display) >= 1 and char_length(author_display) <= 120)
);

create index forum_topics_created_at_idx on public.forum_topics (created_at desc);
create index forum_topics_author_id_idx on public.forum_topics (author_id);

create table public.forum_replies (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.forum_topics (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_display text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint forum_replies_body_len check (char_length(trim(body)) >= 2 and char_length(body) <= 1000),
  constraint forum_replies_author_display_len check (char_length(author_display) >= 1 and char_length(author_display) <= 120)
);

create index forum_replies_topic_id_created_at_idx on public.forum_replies (topic_id, created_at);
create index forum_replies_author_id_idx on public.forum_replies (author_id);

create table public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_display text not null,
  category text not null,
  message text not null,
  created_at timestamptz not null default now(),
  constraint feedbacks_category_ok check (category in ('site', 'comunidade', 'acervo', 'outro')),
  constraint feedbacks_message_len check (char_length(trim(message)) >= 6 and char_length(message) <= 500),
  constraint feedbacks_author_display_len check (char_length(author_display) >= 1 and char_length(author_display) <= 120)
);

create index feedbacks_created_at_idx on public.feedbacks (created_at desc);
create index feedbacks_author_id_idx on public.feedbacks (author_id);

create or replace function public.forum_rate_limit_ok(p_table text, p_max int, p_window interval)
returns boolean
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_count int := 0;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return false;
  end if;

  if p_table = 'forum_topics' then
    select count(*) into v_count from public.forum_topics
    where author_id = v_uid and created_at > now() - p_window;
  elsif p_table = 'forum_replies' then
    select count(*) into v_count from public.forum_replies
    where author_id = v_uid and created_at > now() - p_window;
  elsif p_table = 'feedbacks' then
    select count(*) into v_count from public.feedbacks
    where author_id = v_uid and created_at > now() - p_window;
  else
    return false;
  end if;

  return v_count < p_max;
end;
$$;

revoke all on function public.forum_rate_limit_ok(text, int, interval) from public;
revoke all on function public.forum_rate_limit_ok(text, int, interval) from anon;
grant execute on function public.forum_rate_limit_ok(text, int, interval) to authenticated;

alter table public.profiles enable row level security;
alter table public.forum_topics enable row level security;
alter table public.forum_replies enable row level security;
alter table public.feedbacks enable row level security;

create policy profiles_select_public on public.profiles
  for select to anon, authenticated using (true);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy forum_topics_select_public on public.forum_topics
  for select to anon, authenticated using (true);

create policy forum_topics_insert_own on public.forum_topics
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.forum_rate_limit_ok('forum_topics', 5, interval '10 minutes')
  );

create policy forum_topics_update_own on public.forum_topics
  for update to authenticated
  using (author_id = auth.uid())
  with check (
    author_id = auth.uid()
    and pinned = (select t.pinned from public.forum_topics t where t.id = id)
  );

create policy forum_topics_delete_own on public.forum_topics
  for delete to authenticated
  using (author_id = auth.uid());

create policy forum_replies_select_public on public.forum_replies
  for select to anon, authenticated using (true);

create policy forum_replies_insert_own on public.forum_replies
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.forum_rate_limit_ok('forum_replies', 20, interval '10 minutes')
  );

create policy forum_replies_update_own on public.forum_replies
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy forum_replies_delete_own on public.forum_replies
  for delete to authenticated
  using (author_id = auth.uid());

create policy feedbacks_select_public on public.feedbacks
  for select to anon, authenticated using (true);

create policy feedbacks_insert_own on public.feedbacks
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.forum_rate_limit_ok('feedbacks', 5, interval '10 minutes')
  );

create policy feedbacks_update_own on public.feedbacks
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy feedbacks_delete_own on public.feedbacks
  for delete to authenticated
  using (author_id = auth.uid());
