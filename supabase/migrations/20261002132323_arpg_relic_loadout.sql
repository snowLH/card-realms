-- Persist the equipped ARPG relic alongside the rest of the loadout.
-- Existing accounts receive the starter relic. Writes remain server-only.

alter table public.player_arpg_loadouts
  add column if not exists relic_id text not null default 'cartographer-compass';

update public.player_arpg_loadouts
set relic_id = 'cartographer-compass'
where relic_id is null or btrim(relic_id) = '';

-- Remove the previous overload so PostgREST exposes only the current contract.
drop function if exists public.save_arpg_loadout(uuid, text, text, text[], text[]);
drop function if exists private.save_arpg_loadout(uuid, text, text, text[], text[]);

create or replace function private.save_arpg_loadout(
  target_player_id uuid,
  target_weapon_id text,
  target_armor_id text,
  target_relic_id text,
  target_support_ids text[],
  target_ability_ids text[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  distinct_supports integer;
  distinct_abilities integer;
  result_row public.player_arpg_loadouts%rowtype;
begin
  if target_player_id is null then
    raise exception 'Jogador obrigatório' using errcode = '22023';
  end if;

  if target_weapon_id not in (
    'iron-sword','forest-bow','ritual-staff',
    'tide-blade','river-bow','iara-song-staff'
  ) then
    raise exception 'Arma ARPG inválida' using errcode = '22023';
  end if;

  if target_armor_id not in (
    'leather-armor','forest-guardian-armor','ritual-cloak',
    'river-shell-armor','kelpie-mist-cloak','ahuizotl-guard-armor'
  ) then
    raise exception 'Armadura ARPG inválida' using errcode = '22023';
  end if;

  if target_relic_id not in (
    'cartographer-compass','curupira-track-talisman','iara-shell-charm'
  ) then
    raise exception 'Relíquia ARPG inválida' using errcode = '22023';
  end if;

  if cardinality(target_support_ids) <> 2
    or not (target_support_ids <@ array[
      'support-curupira','support-boitata','support-saci','support-iara'
    ]::text[]) then
    raise exception 'Os dois suportes ARPG são inválidos' using errcode = '22023';
  end if;

  select count(distinct value) into distinct_supports
  from unnest(target_support_ids) as values_list(value);
  if distinct_supports <> 2 then
    raise exception 'Os suportes ARPG não podem se repetir' using errcode = '22023';
  end if;

  if cardinality(target_ability_ids) <> 4
    or not (target_ability_ids <@ array[
      'ancestral-roots','boitata-flame','saci-whirlwind','iara-song',
      'caipora-arrow','kappa-splash','kelpie-surge','tengu-gust',
      'banshee-wail','medusa-gaze','kraken-grasp','simurgh-renewal',
      'roc-horizon-storm'
    ]::text[]) then
    raise exception 'As cartas-habilidade ARPG são inválidas' using errcode = '22023';
  end if;

  select count(distinct value) into distinct_abilities
  from unnest(target_ability_ids) as values_list(value);
  if distinct_abilities <> 4 then
    raise exception 'As cartas-habilidade ARPG não podem se repetir' using errcode = '22023';
  end if;

  perform 1 from public.profiles where id = target_player_id;
  if not found then
    raise exception 'Perfil do jogador não encontrado' using errcode = 'P0002';
  end if;

  if target_weapon_id <> 'forest-bow' and not exists (
    select 1 from public.inventory_items
    where user_id = target_player_id
      and item_key = target_weapon_id
      and quantity > 0
  ) then
    raise exception 'A conta não possui esta arma' using errcode = '42501';
  end if;

  if target_armor_id <> 'leather-armor' and not exists (
    select 1 from public.inventory_items
    where user_id = target_player_id
      and item_key = target_armor_id
      and quantity > 0
  ) then
    raise exception 'A conta não possui esta armadura' using errcode = '42501';
  end if;

  if target_relic_id <> 'cartographer-compass' and not exists (
    select 1 from public.inventory_items
    where user_id = target_player_id
      and item_key = target_relic_id
      and quantity > 0
  ) then
    raise exception 'A conta não possui esta relíquia' using errcode = '42501';
  end if;

  if exists (
    select 1
    from unnest(target_support_ids) as selected(support_id)
    where selected.support_id not in ('support-curupira','support-boitata')
      and not exists (
        select 1
        from public.inventory_items inventory
        where inventory.user_id = target_player_id
          and inventory.item_key = selected.support_id
          and inventory.quantity > 0
      )
  ) then
    raise exception 'A conta não possui um ou mais suportes'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from unnest(target_ability_ids) as selected(card_id)
    where selected.card_id not in (
      'ancestral-roots','boitata-flame','saci-whirlwind','iara-song'
    )
      and not exists (
        select 1
        from public.inventory_items inventory
        where inventory.user_id = target_player_id
          and inventory.item_key = selected.card_id
          and inventory.quantity > 0
      )
  ) then
    raise exception 'A conta não possui uma ou mais cartas-habilidade'
      using errcode = '42501';
  end if;

  insert into public.player_arpg_loadouts (
    user_id, weapon_id, armor_id, relic_id, support_ids, ability_ids, updated_at
  ) values (
    target_player_id,
    target_weapon_id,
    target_armor_id,
    target_relic_id,
    target_support_ids,
    target_ability_ids,
    now()
  )
  on conflict (user_id) do update set
    weapon_id = excluded.weapon_id,
    armor_id = excluded.armor_id,
    relic_id = excluded.relic_id,
    support_ids = excluded.support_ids,
    ability_ids = excluded.ability_ids,
    updated_at = excluded.updated_at
  returning * into result_row;

  return jsonb_build_object(
    'weaponId', result_row.weapon_id,
    'armorId', result_row.armor_id,
    'relicId', result_row.relic_id,
    'supportIds', to_jsonb(result_row.support_ids),
    'abilityIds', to_jsonb(result_row.ability_ids),
    'updatedAt', result_row.updated_at
  );
end;
$$;

revoke all on function private.save_arpg_loadout(uuid, text, text, text, text[], text[])
  from public, anon, authenticated;
grant execute on function private.save_arpg_loadout(uuid, text, text, text, text[], text[])
  to service_role;

create or replace function public.save_arpg_loadout(
  target_player_id uuid,
  target_weapon_id text,
  target_armor_id text,
  target_relic_id text,
  target_support_ids text[],
  target_ability_ids text[]
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.save_arpg_loadout(
    target_player_id,
    target_weapon_id,
    target_armor_id,
    target_relic_id,
    target_support_ids,
    target_ability_ids
  );
$$;

revoke all on function public.save_arpg_loadout(uuid, text, text, text, text[], text[])
  from public, anon, authenticated;
grant execute on function public.save_arpg_loadout(uuid, text, text, text, text[], text[])
  to service_role;
