-- Include permanent evolution stage in authoritative team snapshots used by raids.

create or replace function private.active_team_snapshot(player_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $team$
declare
  snapshot jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'slot', members.slot,
    'playerCreatureId', owned.id,
    'catalogId', owned.creature_id,
    'evolutionStage', owned.evolution_stage
  ) order by members.slot)
  into snapshot
  from public.teams
  join public.team_members members on members.team_id = teams.id
  join public.player_creatures owned on owned.id = members.player_creature_id
  where teams.user_id = player_id
    and teams.is_active
    and owned.user_id = player_id;

  if snapshot is null or jsonb_array_length(snapshot) <> 6 then
    raise exception 'O jogador precisa de uma equipe ativa com exatamente seis criaturas'
      using errcode = '22023';
  end if;

  return snapshot;
end;
$team$;
revoke all on function private.active_team_snapshot(uuid) from public, anon, authenticated;
grant execute on function private.active_team_snapshot(uuid) to service_role;
