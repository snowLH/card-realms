create or replace function public.start_raid_room(
  target_room_id uuid,
  submitted_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $raid$
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
  from public.raid_participants
  where room_id = room.id;

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
  set status = 'active',
      state = submitted_state,
      version = 1,
      started_at = now()
  where id = room.id;

  insert into public.raid_room_events (room_id, sequence, event_type, payload)
  select
    room.id,
    ordinal::integer,
    coalesce(event_payload ->> 'kind', 'raid_event'),
    event_payload
  from jsonb_array_elements(coalesce(submitted_state -> 'log', '[]'::jsonb))
    with ordinality as entries(event_payload, ordinal);

  return jsonb_build_object(
    'roomId', room.id,
    'state', submitted_state,
    'version', 1
  );
end;
$raid$;

revoke all on function public.start_raid_room(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.start_raid_room(uuid, jsonb) to service_role;
