-- Shared map exploration sessions with private realtime presence.

create table public.map_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  invite_code text not null unique,
  region_id text not null references public.regions(id),
  status text not null default 'active' check (status in ('active','closed')),
  max_players smallint not null default 5 check (max_players between 2 and 5),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create table public.map_session_members (
  session_id uuid not null references public.map_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  x smallint not null check (x between 0 and 39),
  y smallint not null check (y between 0 and 24),
  presence_status text not null default 'online'
    check (presence_status in ('online','moving','disconnected')),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
create unique index map_session_members_one_active_session_idx
  on public.map_session_members (user_id);
create index map_sessions_region_status_idx
  on public.map_sessions (region_id, status, created_at desc);
alter table public.map_sessions enable row level security;
alter table public.map_session_members enable row level security;
create or replace function private.is_map_session_member(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $map$
  select exists (
    select 1
    from public.map_session_members member
    where member.session_id = target_session_id
      and member.user_id = auth.uid()
  );
$map$;
revoke all on function private.is_map_session_member(uuid) from public, anon;
grant execute on function private.is_map_session_member(uuid) to authenticated, service_role;
create policy "map members read session"
on public.map_sessions for select to authenticated
using (private.is_map_session_member(id));
create policy "map members read party"
on public.map_session_members for select to authenticated
using (private.is_map_session_member(session_id));
revoke all on public.map_sessions, public.map_session_members
from public, anon, authenticated;
grant select on public.map_sessions, public.map_session_members to authenticated;
grant all privileges on public.map_sessions, public.map_session_members to service_role;
create or replace function public.create_map_session()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $map$
declare
  player_id uuid := auth.uid();
  world public.player_world_state;
  session public.map_sessions;
  code text;
  start_x smallint;
  start_y smallint;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.map_session_members
    where user_id = player_id
  ) then
    raise exception 'Você já participa de uma sessão de mapa' using errcode = '22023';
  end if;

  select * into world
  from public.player_world_state
  where user_id = player_id
  for update;

  if world.user_id is null then
    raise exception 'Progresso de mundo não encontrado' using errcode = 'P0002';
  end if;

  start_x := coalesce((world.map_positions -> world.current_region_id ->> 'x')::smallint, 4);
  start_y := coalesce((world.map_positions -> world.current_region_id ->> 'y')::smallint, 20);
  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.map_sessions (host_id, invite_code, region_id)
  values (player_id, code, world.current_region_id)
  returning * into session;

  insert into public.map_session_members (session_id, user_id, x, y)
  values (session.id, player_id, start_x, start_y);

  return jsonb_build_object(
    'sessionId', session.id,
    'inviteCode', session.invite_code,
    'regionId', session.region_id,
    'hostId', session.host_id
  );
end;
$map$;
revoke all on function public.create_map_session() from public, anon;
grant execute on function public.create_map_session() to authenticated, service_role;
create or replace function public.join_map_session(target_invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $map$
declare
  player_id uuid := auth.uid();
  session public.map_sessions;
  world public.player_world_state;
  member_count integer;
  start_x smallint;
  start_y smallint;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.map_session_members
    where user_id = player_id
  ) then
    raise exception 'Você já participa de uma sessão de mapa' using errcode = '22023';
  end if;

  select * into session
  from public.map_sessions
  where invite_code = upper(trim(target_invite_code))
    and status = 'active'
  for update;

  if session.id is null then
    raise exception 'Sessão não encontrada' using errcode = 'P0002';
  end if;

  select count(*) into member_count
  from public.map_session_members
  where session_id = session.id;

  if member_count >= session.max_players then
    raise exception 'A sessão está cheia' using errcode = '22023';
  end if;

  select * into world
  from public.player_world_state
  where user_id = player_id
  for update;

  if world.current_region_id <> session.region_id then
    raise exception 'Viaje para a mesma região antes de entrar na sessão' using errcode = '22023';
  end if;

  start_x := coalesce((world.map_positions -> world.current_region_id ->> 'x')::smallint, 4);
  start_y := coalesce((world.map_positions -> world.current_region_id ->> 'y')::smallint, 20);

  insert into public.map_session_members (session_id, user_id, x, y)
  values (session.id, player_id, start_x, start_y);

  return jsonb_build_object(
    'sessionId', session.id,
    'inviteCode', session.invite_code,
    'regionId', session.region_id,
    'hostId', session.host_id
  );
end;
$map$;
revoke all on function public.join_map_session(text) from public, anon;
grant execute on function public.join_map_session(text) to authenticated, service_role;
create or replace function public.leave_map_session(target_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $map$
declare
  player_id uuid := auth.uid();
  session public.map_sessions;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  select * into session
  from public.map_sessions
  where id = target_session_id
  for update;

  if session.id is null or not private.is_map_session_member(session.id) then
    raise exception 'Você não participa desta sessão' using errcode = '42501';
  end if;

  delete from public.map_session_members
  where session_id = session.id and user_id = player_id;

  if session.host_id = player_id then
    update public.map_sessions
    set status = 'closed', closed_at = now()
    where id = session.id;

    delete from public.map_session_members
    where session_id = session.id;
  elsif not exists (
    select 1 from public.map_session_members where session_id = session.id
  ) then
    update public.map_sessions
    set status = 'closed', closed_at = now()
    where id = session.id;
  end if;

  return jsonb_build_object('sessionId', session.id, 'left', true);
end;
$map$;
revoke all on function public.leave_map_session(uuid) from public, anon;
grant execute on function public.leave_map_session(uuid) to authenticated, service_role;
create or replace function public.update_map_session_position(
  target_session_id uuid,
  target_x integer,
  target_y integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $map$
declare
  player_id uuid := auth.uid();
  session public.map_sessions;
  world public.player_world_state;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  if target_x < 0 or target_x > 39 or target_y < 0 or target_y > 24 then
    raise exception 'Posição fora do mapa' using errcode = '22023';
  end if;

  select * into session
  from public.map_sessions
  where id = target_session_id and status = 'active';

  if session.id is null or not private.is_map_session_member(session.id) then
    raise exception 'Sessão de mapa indisponível' using errcode = '42501';
  end if;

  select * into world
  from public.player_world_state
  where user_id = player_id;

  if world.current_region_id <> session.region_id then
    raise exception 'Sua região não corresponde à sessão' using errcode = '22023';
  end if;

  update public.map_session_members
  set x = target_x::smallint,
      y = target_y::smallint,
      presence_status = 'online',
      last_seen_at = now()
  where session_id = session.id and user_id = player_id;

  return jsonb_build_object(
    'sessionId', session.id,
    'x', target_x,
    'y', target_y,
    'updatedAt', now()
  );
end;
$map$;
revoke all on function public.update_map_session_position(uuid, integer, integer) from public, anon;
grant execute on function public.update_map_session_position(uuid, integer, integer) to authenticated, service_role;
create or replace function private.broadcast_map_session_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $map$
declare
  target_session_id uuid;
begin
  target_session_id := case when tg_op = 'DELETE' then old.session_id else new.session_id end;

  perform realtime.broadcast_changes(
    'map:room:' || target_session_id::text,
    tg_op, tg_op, tg_table_name, tg_table_schema, new, old
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$map$;
create or replace function private.broadcast_map_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $map$
begin
  perform realtime.broadcast_changes(
    'map:room:' || new.id::text,
    tg_op, tg_op, tg_table_name, tg_table_schema, new, old
  );
  return new;
end;
$map$;
drop trigger if exists map_session_members_broadcast_changes on public.map_session_members;
create trigger map_session_members_broadcast_changes
after insert or update or delete on public.map_session_members
for each row execute function private.broadcast_map_session_member();
drop trigger if exists map_sessions_broadcast_changes on public.map_sessions;
create trigger map_sessions_broadcast_changes
after update on public.map_sessions
for each row execute function private.broadcast_map_session();
drop policy if exists "map party receives private broadcasts" on realtime.messages;
create policy "map party receives private broadcasts"
on realtime.messages for select to authenticated
using (
  exists (
    select 1
    from public.map_session_members member
    where member.user_id = (select auth.uid())
      and topic = 'map:room:' || member.session_id::text
  )
);
revoke all on function private.broadcast_map_session_member() from public, anon, authenticated;
revoke all on function private.broadcast_map_session() from public, anon, authenticated;
grant execute on function private.broadcast_map_session_member(), private.broadcast_map_session()
to service_role;
