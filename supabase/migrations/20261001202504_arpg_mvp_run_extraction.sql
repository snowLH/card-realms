-- Safe extraction boundary for the first ARPG vertical slice.
-- High-value boss, legendary and mythic rewards are intentionally excluded.

create or replace function private.claim_arpg_mvp_run_reward(
  target_player_id uuid,
  target_run_id uuid,
  target_victory boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_reward jsonb;
  reward jsonb;
  reward_coins integer;
  reward_xp integer;
begin
  if target_player_id is null or target_run_id is null then
    raise exception 'Jogador e run são obrigatórios' using errcode = '22023';
  end if;

  perform 1
  from public.profiles
  where id = target_player_id
  for update;

  if not found then
    raise exception 'Perfil do jogador não encontrado' using errcode = 'P0002';
  end if;

  if not target_victory then
    return jsonb_build_object(
      'coins', 0, 'xp', 0, 'victory', false,
      'items', '[]'::jsonb, 'replayed', false
    );
  end if;

  select ledger.reward into existing_reward
  from public.reward_ledger ledger
  where ledger.user_id = target_player_id
    and ledger.source_type = 'arpg_mvp_first_clear'
    and ledger.source_id = 'mata-encantada';

  if existing_reward is not null then
    return existing_reward || jsonb_build_object('replayed', true);
  end if;

  reward_coins := 60;
  reward_xp := 120;

  reward := jsonb_build_object(
    'coins', reward_coins,
    'xp', reward_xp,
    'victory', true,
    'runId', target_run_id,
    'items', jsonb_build_array('ritual-staff', 'ritual-cloak', 'iron-sword')
  );

  insert into public.reward_ledger (user_id, source_type, source_id, reward)
  values (target_player_id, 'arpg_mvp_first_clear', 'mata-encantada', reward);

  update public.profiles
  set coins = coins + reward_coins,
      xp = xp + reward_xp
  where id = target_player_id;

  if target_victory then
    insert into public.inventory_items (user_id, item_key, quantity, metadata)
    values
      (target_player_id, 'ritual-staff', 1, jsonb_build_object('source', 'arpg_mvp_run')),
      (target_player_id, 'ritual-cloak', 1, jsonb_build_object('source', 'arpg_mvp_run')),
      (target_player_id, 'iron-sword', 1, jsonb_build_object('source', 'arpg_mvp_run'))
    on conflict (user_id, item_key) do update
    set quantity = greatest(public.inventory_items.quantity, 1),
        metadata = public.inventory_items.metadata || excluded.metadata,
        updated_at = now();
  end if;

  return reward || jsonb_build_object('replayed', false);
end;
$$;
revoke all on function private.claim_arpg_mvp_run_reward(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function private.claim_arpg_mvp_run_reward(uuid, uuid, boolean)
  to service_role;
create or replace function public.claim_arpg_mvp_run_reward(
  target_player_id uuid,
  target_run_id uuid,
  target_victory boolean
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.claim_arpg_mvp_run_reward(
    target_player_id,
    target_run_id,
    target_victory
  );
$$;
revoke all on function public.claim_arpg_mvp_run_reward(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.claim_arpg_mvp_run_reward(uuid, uuid, boolean)
  to service_role;
