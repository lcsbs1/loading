-- Force author_display from profiles on write (prevents client-side spoofing).

create or replace function public.set_author_display_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select nullif(trim(display_name), '') into v_name
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

drop trigger if exists forum_topics_set_author_display on public.forum_topics;
create trigger forum_topics_set_author_display
before insert or update on public.forum_topics
for each row execute function public.set_author_display_from_profile();

drop trigger if exists forum_replies_set_author_display on public.forum_replies;
create trigger forum_replies_set_author_display
before insert or update on public.forum_replies
for each row execute function public.set_author_display_from_profile();

drop trigger if exists feedbacks_set_author_display on public.feedbacks;
create trigger feedbacks_set_author_display
before insert or update on public.feedbacks
for each row execute function public.set_author_display_from_profile();
