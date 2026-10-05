-- ARPG relic rewards tied to expedition clears.
-- Relics use a separate idempotent ledger so old first-clears do not duplicate coins/XP.

create or replace function private.claim_arpg_relic_unlock(
  target_player_id uuid,
  target_run_id uuid,
  target_expedition_id text,
  target_victory boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_relic_id text;
begin
  if not target_victory then
    return '[]'::jsonb;
  end if;

  target_relic_id := case target_expedition_id
    when 'mata-encantada' then 'curupira-track-talisman'
    when 'arquipelago-das-mares' then 'iara-shell-charm'
    else null
  end;

  if target_relic_id is null then
    return '[]'::jsonb;
  end if;

  perform 1
  from public.profiles
  where id = target_player_id;

  if not found then
    raise exception 'Perfil do jogador não encontrado' using errcode = 'P0002';
  end if;

  insert into public.reward_ledger (user_id, source_type, source_id, reward)
  values (
    target_player_id,
    'arpg_relic_first_clear',
    target_expedition_id,
    jsonb_build_object(
      'relicId', target_relic_id,
      'runId', target_run_id,
      'expeditionId', target_expedition_id
    )
  )
  on conflict (user_id, source_type, source_id) do nothing;

  if not found then
    return '[]'::jsonb;
  end if;

  insert into public.inventory_items (user_id, item_key, quantity, metadata)
  values (
    target_player_id,
    target_relic_id,
    1,
    jsonb_build_object(
      'source', 'arpg_relic_first_clear',
      'expeditionId', target_expedition_id,
      'runId', target_run_id
    )
  )
  on conflict (user_id, item_key) do update
  set quantity = greatest(public.inventory_items.quantity, 1),
      metadata = public.inventory_items.metadata || excluded.metadata,
      updated_at = now();

  return jsonb_build_array(target_relic_id);
end;
$$;

revoke all on function private.claim_arpg_relic_unlock(uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function private.claim_arpg_relic_unlock(uuid, uuid, text, boolean)
  to service_role;

create or replace function public.claim_arpg_expedition_result(
  target_player_id uuid,
  target_run_id uuid,
  target_expedition_id text,
  target_victory boolean,
  target_loot_item_ids text[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  reward jsonb;
  relic_items jsonb;
  merged_items jsonb;
begin
  reward := private.claim_arpg_expedition_result(
    target_player_id,
    target_run_id,
    target_expedition_id,
    target_victory,
    target_loot_item_ids
  );

  relic_items := private.claim_arpg_relic_unlock(
    target_player_id,
    target_run_id,
    target_expedition_id,
    target_victory
  );

  merged_items := coalesce(reward -> 'newItems', '[]'::jsonb)
    || coalesce(relic_items, '[]'::jsonb);

  return reward || jsonb_build_object('newItems', merged_items);
end;
$$;

revoke all on function public.claim_arpg_expedition_result(uuid, uuid, text, boolean, text[])
  from public, anon, authenticated;
grant execute on function public.claim_arpg_expedition_result(uuid, uuid, text, boolean, text[])
  to service_role;

-- Backfill relic ownership for accounts that already completed either expedition.
insert into public.reward_ledger (user_id, source_type, source_id, reward)
select
  ledger.user_id,
  'arpg_relic_first_clear',
  ledger.source_id,
  jsonb_build_object(
    'relicId', case ledger.source_id
      when 'mata-encantada' then 'curupira-track-talisman'
      else 'iara-shell-charm'
    end,
    'expeditionId', ledger.source_id,
    'backfilled', true
  )
from public.reward_ledger ledger
where ledger.source_type = 'arpg_expedition_first_clear'
  and ledger.source_id in ('mata-encantada', 'arquipelago-das-mares')
on conflict (user_id, source_type, source_id) do nothing;

insert into public.inventory_items (user_id, item_key, quantity, metadata)
select
  ledger.user_id,
  case ledger.source_id
    when 'mata-encantada' then 'curupira-track-talisman'
    else 'iara-shell-charm'
  end,
  1,
  jsonb_build_object(
    'source', 'arpg_relic_first_clear',
    'expeditionId', ledger.source_id,
    'backfilled', true
  )
from public.reward_ledger ledger
where ledger.source_type = 'arpg_expedition_first_clear'
  and ledger.source_id in ('mata-encantada', 'arquipelago-das-mares')
on conflict (user_id, item_key) do update
set quantity = greatest(public.inventory_items.quantity, 1),
    metadata = public.inventory_items.metadata || excluded.metadata,
    updated_at = now();
