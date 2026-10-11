-- Compact campaign stages 1-4 must close the durable stage without
-- paying an expedition/boss completion reward. Stage 5 continues to use
-- finish_arpg_run and the existing reward ledger.
create or replace function private.finish_arpg_stage(
  target_player_id uuid,
  target_run_id uuid,
  target_expedition_id text,
  target_loot_item_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_run private.arpg_runs%rowtype;
  result jsonb;
begin
  select * into active_run
  from private.arpg_runs
  where run_id = target_run_id
    and user_id = target_player_id
  for update;

  if not found then
    raise exception 'Estágio não encontrado' using errcode = 'P0002';
  end if;

  if active_run.status = 'extracted' then
    if active_run.result ->> 'stageComplete' = 'true'
      and active_run.expedition_id = target_expedition_id
      and active_run.loot_item_ids = target_loot_item_ids then
      return active_run.result || jsonb_build_object('replayed', true);
    end if;
    raise exception 'O estágio já foi finalizado com outro resultado' using errcode = '23505';
  end if;

  if active_run.status <> 'active' or active_run.expires_at <= now() then
    raise exception 'Estágio não está mais ativo' using errcode = 'P0002';
  end if;

  if active_run.expedition_id is distinct from target_expedition_id
    or active_run.loot_item_ids is distinct from target_loot_item_ids then
    raise exception 'Dados do estágio diferentes dos dados assinados' using errcode = '22023';
  end if;

  if active_run.checkpoint ->> 'currentRoomId' is distinct from active_run.boss_room_id
    or jsonb_typeof(active_run.checkpoint -> 'clearedRoomIds') is distinct from 'array'
    or not coalesce((active_run.checkpoint -> 'clearedRoomIds') ? active_run.boss_room_id, false)
    or active_run.checkpoint ->> 'exitPortalAvailable' is distinct from 'true'
    or coalesce((active_run.checkpoint ->> 'playerHp')::integer, 0) <= 0
    or active_run.checkpoint -> 'serverCombatState' ->> 'roomId' is distinct from active_run.boss_room_id
    or active_run.checkpoint -> 'serverCombatState' ->> 'status' is distinct from 'victory' then
    raise exception 'O checkpoint ainda não comprova a conclusão do estágio' using errcode = '22023';
  end if;

  result := jsonb_build_object(
    'coins', 0,
    'xp', 0,
    'victory', true,
    'items', '[]'::jsonb,
    'runLootItems', '[]'::jsonb,
    'newItems', '[]'::jsonb,
    'stageComplete', true,
    'persisted', true,
    'replayed', false
  );

  update private.arpg_runs
  set status = 'extracted',
      result = result,
      updated_at = now(),
      finished_at = now()
  where run_id = target_run_id;

  return result;
end;
$$;

create or replace function public.finish_arpg_stage(
  target_player_id uuid,
  target_run_id uuid,
  target_expedition_id text,
  target_loot_item_ids text[]
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.finish_arpg_stage(
    target_player_id,
    target_run_id,
    target_expedition_id,
    target_loot_item_ids
  );
$$;

revoke all on function private.finish_arpg_stage(uuid, uuid, text, text[])
  from public, anon, authenticated;
revoke all on function public.finish_arpg_stage(uuid, uuid, text, text[])
  from public, anon, authenticated;
grant execute on function private.finish_arpg_stage(uuid, uuid, text, text[])
  to service_role;
grant execute on function public.finish_arpg_stage(uuid, uuid, text, text[])
  to service_role;
