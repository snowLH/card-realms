-- Bridge the existing Raid lobby/persistence tables to the new ARPG runtime.
-- Legacy TCG events keep their old snapshots and action contract.

create or replace function private.arpg_raid_loadout_snapshot(target_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  loadout public.player_arpg_loadouts%rowtype;
begin
  select * into loadout
  from public.player_arpg_loadouts
  where user_id = target_player_id;

  if loadout.user_id is null then
    return jsonb_build_object(
      'weaponId', 'forest-bow',
      'armorId', 'leather-armor',
      'relicId', 'cartographer-compass',
      'supportIds', jsonb_build_array('support-curupira', 'support-boitata'),
      'abilityIds', jsonb_build_array('ancestral-roots', 'boitata-flame', 'saci-whirlwind', 'iara-song')
    );
  end if;

  return jsonb_build_object(
    'weaponId', loadout.weapon_id,
    'armorId', loadout.armor_id,
    'relicId', loadout.relic_id,
    'supportIds', to_jsonb(loadout.support_ids),
    'abilityIds', to_jsonb(loadout.ability_ids)
  );
end;
$$;
revoke all on function private.arpg_raid_loadout_snapshot(uuid)
  from public, anon, authenticated;
grant execute on function private.arpg_raid_loadout_snapshot(uuid)
  to service_role;
create or replace function public.create_raid_room(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  event public.raid_events;
  room public.raid_rooms;
  snapshot jsonb;
  code text;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  select * into event
  from public.raid_events
  where id = target_event_id and is_published
  for share;

  if event.id is null or now() < event.starts_at or now() >= event.ends_at then
    raise exception 'A Raid não está ativa' using errcode = '22023';
  end if;

  snapshot := case
    when coalesce(event.boss_config ->> 'gameplayMode', 'legacy') = 'arpg'
      then private.arpg_raid_loadout_snapshot(player_id)
    else private.active_team_snapshot(player_id)
  end;
  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.raid_rooms (event_id, host_id, invite_code)
  values (event.id, player_id, code)
  returning * into room;

  insert into public.raid_participants (room_id, user_id, seat, team_snapshot)
  values (room.id, player_id, 1, snapshot);

  return jsonb_build_object(
    'roomId', room.id,
    'eventId', room.event_id,
    'inviteCode', room.invite_code,
    'status', room.status,
    'seat', 1,
    'gameplayMode', coalesce(event.boss_config ->> 'gameplayMode', 'legacy')
  );
end;
$$;
revoke all on function public.create_raid_room(uuid) from public, anon;
grant execute on function public.create_raid_room(uuid) to authenticated, service_role;
create or replace function public.join_raid_room(target_invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  room public.raid_rooms;
  event public.raid_events;
  snapshot jsonb;
  next_seat integer;
  participant_count integer;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  select * into room
  from public.raid_rooms
  where invite_code = upper(trim(target_invite_code))
  for update;
  if room.id is null or room.status <> 'lobby' then
    raise exception 'Sala de Raid indisponível' using errcode = 'P0002';
  end if;

  select * into event from public.raid_events where id = room.event_id;
  if event.id is null or now() < event.starts_at or now() >= event.ends_at then
    raise exception 'O evento não está ativo' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.raid_participants
    where room_id = room.id and user_id = player_id
  ) then
    select seat into next_seat from public.raid_participants
    where room_id = room.id and user_id = player_id;
    return jsonb_build_object(
      'roomId', room.id,
      'seat', next_seat,
      'alreadyJoined', true,
      'gameplayMode', coalesce(event.boss_config ->> 'gameplayMode', 'legacy')
    );
  end if;
  select count(*) into participant_count
  from public.raid_participants
  where room_id = room.id;
  if participant_count >= event.max_players then
    raise exception 'A sala está cheia' using errcode = '22023';
  end if;

  snapshot := case
    when coalesce(event.boss_config ->> 'gameplayMode', 'legacy') = 'arpg'
      then private.arpg_raid_loadout_snapshot(player_id)
    else private.active_team_snapshot(player_id)
  end;

  select candidate into next_seat
  from generate_series(1, event.max_players) candidate
  where not exists (
    select 1 from public.raid_participants p
    where p.room_id = room.id and p.seat = candidate
  )
  order by candidate
  limit 1;

  insert into public.raid_participants (room_id, user_id, seat, team_snapshot)
  values (room.id, player_id, next_seat, snapshot);

  return jsonb_build_object(
    'roomId', room.id,
    'seat', next_seat,
    'alreadyJoined', false,
    'gameplayMode', coalesce(event.boss_config ->> 'gameplayMode', 'legacy')
  );
end;
$$;
revoke all on function public.join_raid_room(text) from public, anon;
grant execute on function public.join_raid_room(text) to authenticated, service_role;
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
  gameplay_mode text;
  submitted_boss_id text;
begin
  select * into room from public.raid_rooms where id = target_room_id for update;
  if room.id is null or room.status <> 'lobby' then
    raise exception 'Sala indisponível' using errcode = 'P0002';
  end if;

  select * into event from public.raid_events where id = room.event_id;
  gameplay_mode := coalesce(event.boss_config ->> 'gameplayMode', 'legacy');
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

  submitted_boss_id := case
    when gameplay_mode = 'arpg' then submitted_state -> 'boss' ->> 'catalogId'
    else submitted_state ->> 'bossCreatureId'
  end;

  if jsonb_typeof(submitted_state) is distinct from 'object'
    or submitted_state ->> 'version' is distinct from '1'
    or submitted_state ->> 'roomId' is distinct from target_room_id::text
    or submitted_state ->> 'eventId' is distinct from event.id::text
    or submitted_boss_id is distinct from event.boss_creature_id
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
    'version', 1,
    'gameplayMode', gameplay_mode
  );
end;
$$;
revoke all on function public.start_raid_room(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.start_raid_room(uuid, jsonb) to service_role;
create or replace function public.commit_raid_action(
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
  event public.raid_events;
  gameplay_mode text;
  submitted_boss_id text;
  previous_result jsonb;
  next_version integer;
  event_sequence integer;
  committed_result jsonb;
begin
  select * into room from public.raid_rooms where id = target_room_id for update;
  if room.id is null then
    raise exception 'Sala de Raid não encontrada' using errcode = 'P0002';
  end if;

  select * into event from public.raid_events where id = room.event_id;
  gameplay_mode := coalesce(event.boss_config ->> 'gameplayMode', 'legacy');

  select result into previous_result
  from public.raid_actions
  where room_id = target_room_id
    and user_id = acting_user_id
    and client_action_id = target_client_action_id;
  if previous_result is not null then
    return previous_result;
  end if;

  if room.status <> 'active' then
    raise exception 'A Raid não está ativa' using errcode = '22023';
  end if;
  if room.version <> expected_version then
    raise exception 'Versão de Raid desatualizada' using errcode = '40001';
  end if;
  if not exists (
    select 1 from public.raid_participants
    where room_id = target_room_id and user_id = acting_user_id
  ) then
    raise exception 'Jogador não participa desta Raid' using errcode = '42501';
  end if;

  if gameplay_mode = 'arpg' then
    if target_action_type not in ('input','attack','dash','swap_support','support','ability') then
      raise exception 'Ação ARPG de Raid inválida' using errcode = '22023';
    end if;
  elsif target_action_type not in (
    'attach_energy','draw_power','equip_power','switch','attack','evolve','pass'
  ) then
    raise exception 'Ação legada de Raid inválida' using errcode = '22023';
  end if;

  submitted_boss_id := case
    when gameplay_mode = 'arpg' then result_state -> 'boss' ->> 'catalogId'
    else result_state ->> 'bossCreatureId'
  end;

  if jsonb_typeof(result_state) is distinct from 'object'
    or jsonb_typeof(result_events) is distinct from 'array'
    or result_state ->> 'roomId' is distinct from target_room_id::text
    or result_state ->> 'version' is distinct from '1'
    or result_state ->> 'status' not in ('active','victory','defeat')
    or submitted_boss_id is distinct from event.boss_creature_id then
    raise exception 'Transição de Raid inválida' using errcode = '22023';
  end if;

  next_version := room.version + 1;
  committed_result := jsonb_build_object(
    'state', result_state,
    'events', result_events,
    'version', next_version,
    'authority', 'server',
    'gameplayMode', gameplay_mode
  );

  insert into public.raid_actions (
    room_id, user_id, client_action_id, action_type, payload, result
  ) values (
    target_room_id, acting_user_id, target_client_action_id,
    target_action_type, action_payload, committed_result
  );

  update public.raid_rooms
  set state = result_state,
      version = next_version,
      status = case
        when result_state ->> 'status' = 'victory' then 'victory'
        when result_state ->> 'status' = 'defeat' then 'defeat'
        else 'active'
      end,
      finished_at = case
        when result_state ->> 'status' in ('victory','defeat') then now()
        else null
      end
  where id = target_room_id;

  update public.raid_participants
  set contribution = coalesce((
        select participant -> 'contribution'
        from jsonb_array_elements(result_state -> 'players') participant
        where participant ->> 'id' = acting_user_id::text
        limit 1
      ), contribution),
      last_seen_at = now()
  where room_id = target_room_id and user_id = acting_user_id;

  select coalesce(max(sequence), 0) into event_sequence
  from public.raid_room_events
  where room_id = target_room_id;

  insert into public.raid_room_events (room_id, sequence, event_type, payload)
  select
    target_room_id,
    event_sequence + ordinal::integer,
    coalesce(event_payload ->> 'kind', 'raid_event'),
    event_payload
  from jsonb_array_elements(result_events)
    with ordinality as entries(event_payload, ordinal);

  return committed_result;
end;
$$;
revoke all on function public.commit_raid_action(
  uuid, uuid, integer, uuid, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.commit_raid_action(
  uuid, uuid, integer, uuid, text, jsonb, jsonb, jsonb
) to service_role;
update public.raid_events
set boss_config = coalesce(boss_config, '{}'::jsonb) || jsonb_build_object(
  'gameplayMode', 'arpg',
  'maxHp', 10000,
  'speed', 92,
  'maxDurationMs', 360000
)
where slug = 'raid-roc-2026-10-03';
