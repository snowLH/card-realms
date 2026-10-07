-- Buy a playable legend together with its two signature powers in one atomic
-- server-authoritative transaction. Prices and power pairs mirror the fixed
-- catalogue in src/game/arpg/content/legends.ts.

create or replace function private.purchase_playable_legend(target_legend_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  legend_price bigint;
  signature_ability_ids text[];
  current_coins bigint;
  owned_quantity integer;
  inventory_key text;
  owned_ability_ids text[];
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  select catalogue.price, catalogue.ability_ids
  into legend_price, signature_ability_ids
  from (values
    ('iara', 180::bigint, array['iara-song', 'simurgh-renewal']::text[]),
    ('boto', 240::bigint, array['saci-whirlwind', 'kelpie-surge']::text[]),
    ('kappa', 220::bigint, array['kappa-splash', 'kelpie-surge']::text[]),
    ('raiju', 360::bigint, array['roc-horizon-storm', 'boitata-flame']::text[]),
    ('amarok', 420::bigint, array['banshee-wail', 'medusa-gaze']::text[]),
    ('kelpie', 300::bigint, array['kelpie-surge', 'iara-song']::text[]),
    ('mapinguari', 500::bigint, array['medusa-gaze', 'kraken-grasp']::text[]),
    ('ahuizotl', 540::bigint, array['kraken-grasp', 'kelpie-surge']::text[]),
    ('ratatoskr', 380::bigint, array['caipora-arrow', 'saci-whirlwind']::text[]),
    ('carbunclo', 460::bigint, array['boitata-flame', 'simurgh-renewal']::text[]),
    ('alicanto', 500::bigint, array['roc-horizon-storm', 'simurgh-renewal']::text[]),
    ('yeti', 620::bigint, array['banshee-wail', 'kappa-splash']::text[])
  ) as catalogue(legend_id, price, ability_ids)
  where catalogue.legend_id = target_legend_id;

  if not found then
    raise exception 'Personagem indisponível na loja' using errcode = '22023';
  end if;
  if pg_catalog.cardinality(signature_ability_ids) is distinct from 2 then
    raise exception 'O personagem precisa ter dois poderes assinatura' using errcode = '22023';
  end if;

  inventory_key := 'legend-' || target_legend_id;

  select profiles.coins
  into current_coins
  from public.profiles as profiles
  where profiles.id = player_id
  for update;
  if not found then
    raise exception 'Perfil do jogador não encontrado' using errcode = 'P0002';
  end if;

  select inventory.quantity
  into owned_quantity
  from public.inventory_items as inventory
  where inventory.user_id = player_id
    and inventory.item_key = inventory_key
  for update;
  if coalesce(owned_quantity, 0) > 0 then
    raise exception 'Você já possui este personagem' using errcode = '23505';
  end if;
  if current_coins < legend_price then
    raise exception 'Moedas insuficientes' using errcode = '22023';
  end if;

  update public.profiles as profiles
  set coins = profiles.coins - legend_price
  where profiles.id = player_id
  returning profiles.coins into current_coins;

  insert into public.inventory_items (user_id, item_key, quantity, metadata)
  values (
    player_id,
    inventory_key,
    1,
    pg_catalog.jsonb_build_object(
      'source', 'legend_shop',
      'legendId', target_legend_id,
      'price', legend_price,
      'signatureAbilityIds', pg_catalog.to_jsonb(signature_ability_ids),
      'acquiredAt', pg_catalog.now()
    )
  );

  insert into public.inventory_items (user_id, item_key, quantity, metadata)
  select
    player_id,
    ability.ability_id,
    1,
    pg_catalog.jsonb_build_object(
      'source', 'legend_shop_bundle',
      'legendId', target_legend_id,
      'acquiredAt', pg_catalog.now()
    )
  from pg_catalog.unnest(signature_ability_ids) as ability(ability_id)
  on conflict (user_id, item_key) do update
  set quantity = greatest(public.inventory_items.quantity, excluded.quantity),
      metadata = public.inventory_items.metadata || excluded.metadata,
      updated_at = pg_catalog.now();

  select pg_catalog.array_agg(inventory.item_key order by inventory.item_key)
  into owned_ability_ids
  from public.inventory_items as inventory
  where inventory.user_id = player_id
    and inventory.quantity > 0
    and inventory.item_key = any(array[
      'ancestral-roots', 'boitata-flame', 'saci-whirlwind', 'iara-song',
      'caipora-arrow', 'kappa-splash', 'kelpie-surge', 'tengu-gust',
      'banshee-wail', 'medusa-gaze', 'kraken-grasp', 'simurgh-renewal',
      'roc-horizon-storm'
    ]::text[]);

  return pg_catalog.jsonb_build_object(
    'coins', current_coins,
    'price', legend_price,
    'legendId', target_legend_id,
    'itemKey', inventory_key,
    'signatureAbilityIds', pg_catalog.to_jsonb(signature_ability_ids),
    'ownedAbilityIds', pg_catalog.to_jsonb(coalesce(owned_ability_ids, array[]::text[]))
  );
end;
$$;

revoke all on function private.purchase_playable_legend(text)
  from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.purchase_playable_legend(text) to authenticated;

create or replace function public.purchase_playable_legend(target_legend_id text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.purchase_playable_legend(target_legend_id);
$$;

revoke all on function public.purchase_playable_legend(text)
  from public, anon, authenticated, service_role;
grant execute on function public.purchase_playable_legend(text) to authenticated;
