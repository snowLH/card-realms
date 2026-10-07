-- Restore the ARPG raid runtime details that were present in the reconstructed
-- local baseline without replaying that baseline: initial log rows, player
-- contribution snapshots, and private Realtime broadcasts.

create or replace function public.start_raid_room(
  target_room_id uuid,
  submitted_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  room public.raid_rooms;
  event public.raid_events;
  participant_count integer;
  ready_count integer;
begin
  select * into room from public.raid_rooms where id = target_room_id for update;
  if room.id is null or room.status <> 'lobby' then
    raise exception 'Sala indisponível' using errcode = 'P0002';
  end if;
  select * into event from public.raid_events where id = room.event_id;
  select count(*), count(*) filter (where is_ready)
    into participant_count, ready_count
  from public.raid_participants where room_id = room.id;
  if participant_count < event.min_players or participant_count > event.max_players then
    raise exception 'Quantidade de jogadores inválida' using errcode = '22023';
  end if;
  if ready_count <> participant_count then
    raise exception 'Todos os jogadores precisam estar prontos' using errcode = '22023';
  end if;
  if jsonb_typeof(submitted_state) is distinct from 'object'
    or submitted_state ->> 'version' is distinct from '1'
    or submitted_state ->> 'roomId' is distinct from target_room_id::text
    or submitted_state ->> 'eventId' is distinct from event.id::text
    or submitted_state ->> 'bossCreatureId' is distinct from event.boss_creature_id
    or submitted_state ->> 'status' is distinct from 'active' then
    raise exception 'Estado inicial de Raid inválido' using errcode = '22023';
  end if;

  update public.raid_rooms
  set status = 'active', state = submitted_state, version = 1, started_at = now()
  where id = room.id;

  insert into public.raid_room_events (room_id, sequence, event_type, payload)
  select room.id, ordinal::integer, coalesce(entry ->> 'kind', 'raid_event'), entry
  from jsonb_array_elements(coalesce(submitted_state -> 'log', '[]'::jsonb))
    with ordinality as entries(entry, ordinal);

  return jsonb_build_object('roomId', room.id, 'state', submitted_state, 'version', 1);
end;
$$;

revoke all on function public.start_raid_room(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.start_raid_room(uuid, jsonb) to service_role;

create or replace function public.commit_raid_action_before_revive(
  target_room_id uuid,
  acting_user_id uuid,
  expected_version integer,
  target_client_action_id uuid,
  target_action_type text,
  action_payload jsonb,
  result_state jsonb,
  result_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  room public.raid_rooms;
  previous_result jsonb;
  next_version integer;
  event_sequence integer;
  committed_result jsonb;
begin
  select * into room from public.raid_rooms where id = target_room_id for update;
  if room.id is null then
    raise exception 'Sala de Raid não encontrada' using errcode = 'P0002';
  end if;
  select result into previous_result
  from public.raid_actions
  where room_id = target_room_id and user_id = acting_user_id
    and client_action_id = target_client_action_id;
  if previous_result is not null then return previous_result; end if;
  if room.status <> 'active' then
    raise exception 'A Raid não está ativa' using errcode = '22023';
  end if;
  if room.version <> expected_version then
    raise exception 'Versão de Raid desatualizada' using errcode = '40001';
  end if;
  if not exists (select 1 from public.raid_participants
    where room_id = target_room_id and user_id = acting_user_id) then
    raise exception 'Jogador não participa desta Raid' using errcode = '42501';
  end if;
  if target_action_type not in ('attach_energy', 'draw_power', 'equip_power', 'switch', 'attack', 'evolve', 'pass')
    or jsonb_typeof(result_state) is distinct from 'object'
    or result_state ->> 'roomId' is distinct from target_room_id::text
    or result_state ->> 'version' is distinct from '1'
    or result_state ->> 'status' not in ('active', 'victory', 'defeat') then
    raise exception 'Transição de Raid inválida' using errcode = '22023';
  end if;

  next_version := room.version + 1;
  committed_result := jsonb_build_object(
    'state', result_state, 'events', result_events, 'version', next_version, 'authority', 'server'
  );
  insert into public.raid_actions (room_id, user_id, client_action_id, action_type, payload, result)
  values (target_room_id, acting_user_id, target_client_action_id, target_action_type, action_payload, committed_result);
  update public.raid_rooms
  set state = result_state,
      version = next_version,
      status = case when result_state ->> 'status' = 'victory' then 'victory'
                    when result_state ->> 'status' = 'defeat' then 'defeat' else 'active' end,
      finished_at = case when result_state ->> 'status' in ('victory','defeat') then now() else null end
  where id = target_room_id;
  update public.raid_participants
  set contribution = coalesce((
      select participant -> 'contribution'
      from jsonb_array_elements(result_state -> 'players') participant
      where participant ->> 'id' = acting_user_id::text limit 1
    ), contribution), last_seen_at = now()
  where room_id = target_room_id and user_id = acting_user_id;
  select coalesce(max(sequence), 0) into event_sequence
  from public.raid_room_events where room_id = target_room_id;
  insert into public.raid_room_events (room_id, sequence, event_type, payload)
  select target_room_id, event_sequence + ordinal::integer,
    coalesce(entry ->> 'kind', 'raid_event'), entry
  from jsonb_array_elements(result_events) with ordinality as entries(entry, ordinal);
  return committed_result;
end;
$$;

revoke all on function public.commit_raid_action_before_revive(uuid, uuid, integer, uuid, text, jsonb, jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.commit_raid_action_before_revive(uuid, uuid, integer, uuid, text, jsonb, jsonb, jsonb)
  to service_role;

create or replace function private.broadcast_raid_room()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  perform realtime.broadcast_changes('raid:room:' || new.id::text, tg_op, tg_op,
    tg_table_name, tg_table_schema, new, old);
  return new;
end;
$fn$;

create or replace function private.broadcast_raid_participant()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare target_room_id uuid;
begin
  target_room_id := case when tg_op = 'DELETE' then old.room_id else new.room_id end;
  perform realtime.broadcast_changes('raid:room:' || target_room_id::text, tg_op, tg_op,
    tg_table_name, tg_table_schema, new, old);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$fn$;

create or replace function private.broadcast_raid_event()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  perform realtime.broadcast_changes('raid:room:' || new.room_id::text, tg_op, tg_op,
    tg_table_name, tg_table_schema, new, old);
  return new;
end;
$fn$;

drop trigger if exists raid_rooms_broadcast_changes on public.raid_rooms;
drop trigger if exists raid_participants_broadcast_changes on public.raid_participants;
drop trigger if exists raid_room_events_broadcast_changes on public.raid_room_events;
create trigger raid_rooms_broadcast_changes after update on public.raid_rooms
  for each row execute function private.broadcast_raid_room();
create trigger raid_participants_broadcast_changes after insert or update or delete on public.raid_participants
  for each row execute function private.broadcast_raid_participant();
create trigger raid_room_events_broadcast_changes after insert on public.raid_room_events
  for each row execute function private.broadcast_raid_event();

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'realtime' and tablename = 'messages'
      and policyname = 'raid players receive private broadcasts'
  ) then
    create policy "raid players receive private broadcasts"
      on realtime.messages for select to authenticated
      using (exists (
        select 1 from public.raid_participants participant
        where participant.user_id = auth.uid()
          and topic = 'raid:room:' || participant.room_id::text
      ));
  end if;
end;
$$;
