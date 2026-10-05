-- Re-enable a legacy inventory row at quantity zero instead of failing its
-- (user_id, item_key) primary key during a valid lobby purchase.
create or replace function private.purchase_arpg_power_card(target_card_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  card_rarity text;
  card_price bigint;
  current_coins bigint;
  current_quantity integer;
  owned_card_ids text[];
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;
  if target_card_id is null then
    raise exception 'Carta obrigatória' using errcode = '22023';
  end if;

  select catalog.card_rarity
  into card_rarity
  from private.arpg_power_gacha_catalog as catalog
  where catalog.card_id = target_card_id
    and catalog.enabled;
  if not found then
    raise exception 'Carta não disponível na loja do lobby' using errcode = '22023';
  end if;

  card_price := case
    when target_card_id = 'roc-horizon-storm' then 500
    when card_rarity = 'common' then 80
    when card_rarity = 'uncommon' then 120
    when card_rarity = 'rare' then 180
    when card_rarity = 'epic' then 240
    when card_rarity = 'legendary' then 320
    else null
  end;
  if card_price is null then
    raise exception 'Raridade sem preço de loja' using errcode = '22023';
  end if;

  select profiles.coins into current_coins
  from public.profiles as profiles
  where profiles.id = player_id
  for update;
  if current_coins is null then
    raise exception 'Perfil não encontrado' using errcode = 'P0002';
  end if;

  insert into public.inventory_items (user_id, item_key, quantity, metadata)
  values
    (player_id, 'ancestral-roots', 1, jsonb_build_object('source', 'arpg_power_starter')),
    (player_id, 'boitata-flame', 1, jsonb_build_object('source', 'arpg_power_starter'))
  on conflict (user_id, item_key) do update
  set quantity = greatest(public.inventory_items.quantity, excluded.quantity),
      metadata = public.inventory_items.metadata || excluded.metadata,
      updated_at = now();

  select inventory_items.quantity into current_quantity
  from public.inventory_items
  where inventory_items.user_id = player_id
    and inventory_items.item_key = target_card_id
  for update;
  if coalesce(current_quantity, 0) > 0 then
    raise exception 'Carta já adquirida' using errcode = '23505';
  end if;
  if current_coins < card_price then
    raise exception 'Moedas insuficientes' using errcode = '22023';
  end if;

  update public.profiles
  set coins = profiles.coins - card_price
  where profiles.id = player_id
  returning profiles.coins into current_coins;

  insert into public.inventory_items (user_id, item_key, quantity, metadata)
  values (
    player_id,
    target_card_id,
    1,
    jsonb_build_object('source', 'arpg_power_shop', 'acquired_at', now())
  )
  on conflict (user_id, item_key) do update
  set quantity = greatest(public.inventory_items.quantity, excluded.quantity),
      metadata = public.inventory_items.metadata || excluded.metadata,
      updated_at = now()
  where public.inventory_items.quantity <= 0;
  if not found then
    raise exception 'Carta já adquirida' using errcode = '23505';
  end if;

  select array_agg(owned.card_id order by owned.card_id)
  into owned_card_ids
  from (
    select distinct inventory.item_key as card_id
    from public.inventory_items as inventory
    where inventory.user_id = player_id
      and inventory.quantity > 0
      and inventory.item_key = any(private.active_arpg_power_card_ids())
  ) as owned;

  return jsonb_build_object(
    'coins', current_coins,
    'ownedAbilityIds', to_jsonb(coalesce(owned_card_ids, array[]::text[]))
  );
end;
$$;
