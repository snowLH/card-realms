-- Avoid resolving the PL/pgSQL mission_id variable as the conflict target column.
create or replace function public.record_mission_events(
  target_player_id uuid,
  target_events jsonb,
  target_context jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $missions$
declare
  entry jsonb;
  event_id text;
  event_kind text;
  mission_id text;
  target_count integer;
  inserted_event boolean;
  affected integer := 0;
begin
  if target_player_id is null
    or jsonb_typeof(target_events) is distinct from 'array'
    or jsonb_typeof(target_context) is distinct from 'object' then
    raise exception 'Eventos de missão inválidos' using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles where id = target_player_id) then
    raise exception 'Jogador não encontrado' using errcode = 'P0002';
  end if;

  insert into public.player_missions (user_id, mission_id)
  select target_player_id, missions.id
  from public.missions missions
  where missions.enabled
  on conflict on constraint player_missions_pkey do nothing;

  for entry in select value from jsonb_array_elements(target_events)
  loop
    event_id := nullif(entry ->> 'id', '');
    event_kind := nullif(entry ->> 'kind', '');
    if event_id is null or event_kind is null then
      continue;
    end if;

    insert into public.mission_event_ledger (user_id, event_id, event_kind)
    values (target_player_id, event_id, event_kind)
    on conflict do nothing;
    get diagnostics affected = row_count;
    inserted_event := affected = 1;
    if not inserted_event then
      continue;
    end if;

    mission_id := case
      when event_kind = 'energy_attached' then 'energy-flow'
      when event_kind = 'creature_switched' then 'tactical-switch'
      when event_kind in ('attack_hit', 'critical') then 'steady-hand'
      when event_kind = 'battle_victory'
        and coalesce(target_context ->> 'regionId', '') = 'roots'
        then 'roots-guardian'
      else null
    end;

    if mission_id is null then
      continue;
    end if;

    select greatest(1, coalesce((missions.objective ->> 'count')::integer, 1))
    into target_count
    from public.missions missions
    where missions.id = mission_id and missions.enabled;

    if target_count is null then
      continue;
    end if;

    update public.player_missions progress
    set progress = least(target_count, progress.progress + 1),
        completed_at = case
          when progress.progress + 1 >= target_count
            then coalesce(progress.completed_at, now())
          else progress.completed_at
        end
    where progress.user_id = target_player_id
      and progress.mission_id = mission_id
      and progress.claimed_at is null;
  end loop;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', missions.id,
      'progress', progress.progress,
      'target', greatest(1, coalesce((missions.objective ->> 'count')::integer, 1)),
      'completed', progress.completed_at is not null,
      'claimed', progress.claimed_at is not null
    ) order by missions.id), '[]'::jsonb)
    from public.player_missions progress
    join public.missions missions on missions.id = progress.mission_id
    where progress.user_id = target_player_id and missions.enabled
  );
end;
$missions$;
revoke all on function public.record_mission_events(uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_mission_events(uuid, jsonb, jsonb)
  to service_role;
