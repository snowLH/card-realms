-- Server-signed ARPG run loot extraction.
-- The client never chooses permanent equipment IDs: the API signs a room loot plan in the run token.

create or replace function private.claim_arpg_expedition_result(
  target_player_id uuid,
  target_run_id uuid,
  target_expedition_id text,
  target_victory boolean,
  target_loot_item_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_reward jsonb;
  existing_run_loot jsonb;
  run_loot_reward jsonb;
  allowed_items text[];
begin
  base_reward := private.claim_arpg_expedition_reward(
    target_player_id,
    target_run_id,
    target_expedition_id,
    target_victory
  );

  if not target_victory or coalesce(cardinality(target_loot_item_ids), 0) = 0 then
    return base_reward || jsonb_build_object(
      'runLootItems', '[]'::jsonb,
      'runLootReplayed', false
    );
  end if;
  if cardinality(target_loot_item_ids) <> 4 then
    raise exception 'O plano de loot ARPG precisa conter quatro salas'
      using errcode = '22023';
  end if;

  allowed_items := case target_expedition_id
    when 'mata-encantada' then array[
      'ritual-staff',
      'iron-sword',
      'ritual-cloak',
      'forest-guardian-armor',
      'forest-bow'
    ]::text[]
    when 'arquipelago-das-mares' then array[
      'tide-blade',
      'river-bow',
      'river-shell-armor',
      'kelpie-mist-cloak',
      'iara-song-staff',
      'ahuizotl-guard-armor'
    ]::text[]
    else null
  end;

  if allowed_items is null
    or exists (
      select 1
      from unnest(target_loot_item_ids) as loot(item_id)
      where loot.item_id <> all(allowed_items)
    ) then
    raise exception 'O plano de loot contém equipamento inválido para esta expedição'
      using errcode = '22023';
  end if;
  select ledger.reward into existing_run_loot
  from public.reward_ledger ledger
  where ledger.user_id = target_player_id
    and ledger.source_type = 'arpg_run_loot'
    and ledger.source_id = target_run_id::text;

  if existing_run_loot is not null then
    return base_reward || jsonb_build_object(
      'runLootItems', coalesce(existing_run_loot -> 'items', '[]'::jsonb),
      'runLootReplayed', true
    );
  end if;

  run_loot_reward := jsonb_build_object(
    'runId', target_run_id,
    'expeditionId', target_expedition_id,
    'items', to_jsonb(target_loot_item_ids)
  );

  insert into public.reward_ledger (
    user_id,
    source_type,
    source_id,
    reward
  ) values (
    target_player_id,
    'arpg_run_loot',
    target_run_id::text,
    run_loot_reward
  );
  insert into public.inventory_items (
    user_id,
    item_key,
    quantity,
    metadata
  )
  select
    target_player_id,
    loot.item_id,
    1,
    jsonb_build_object(
      'source', 'arpg_run_loot',
      'expeditionId', target_expedition_id,
      'runId', target_run_id
    )
  from (
    select distinct item_id
    from unnest(target_loot_item_ids) as items(item_id)
  ) as loot
  on conflict (user_id, item_key) do update
  set quantity = greatest(public.inventory_items.quantity, 1),
      metadata = public.inventory_items.metadata || excluded.metadata,
      updated_at = now();

  return base_reward || jsonb_build_object(
    'runLootItems', to_jsonb(target_loot_item_ids),
    'runLootReplayed', false
  );
end;
$$;

revoke all on function private.claim_arpg_expedition_result(uuid, uuid, text, boolean, text[])
  from public, anon, authenticated;
grant execute on function private.claim_arpg_expedition_result(uuid, uuid, text, boolean, text[])
  to service_role;

create or replace function public.claim_arpg_expedition_result(
  target_player_id uuid,
  target_run_id uuid,
  target_expedition_id text,
  target_victory boolean,
  target_loot_item_ids text[]
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.claim_arpg_expedition_result(
    target_player_id,
    target_run_id,
    target_expedition_id,
    target_victory,
    target_loot_item_ids
  );
$$;

revoke all on function public.claim_arpg_expedition_result(uuid, uuid, text, boolean, text[])
  from public, anon, authenticated;
grant execute on function public.claim_arpg_expedition_result(uuid, uuid, text, boolean, text[])
  to service_role;
