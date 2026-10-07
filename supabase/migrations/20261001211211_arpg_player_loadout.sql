-- Persistent ARPG loadout for the new real-time gameplay.
-- Authenticated clients may read their own row, but writes go through the server.

create table if not exists public.player_arpg_loadouts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  weapon_id text not null default 'forest-bow',
  armor_id text not null default 'leather-armor',
  support_ids text[] not null default array['support-curupira','support-boitata']::text[],
  ability_ids text[] not null default array[
    'ancestral-roots','boitata-flame','saci-whirlwind','iara-song'
  ]::text[],
  updated_at timestamptz not null default now(),
  check (cardinality(support_ids) = 2),
  check (cardinality(ability_ids) = 4),
  check (support_ids[1] <> support_ids[2])
);
alter table public.player_arpg_loadouts enable row level security;
revoke all on public.player_arpg_loadouts from public, anon, authenticated;
grant select on public.player_arpg_loadouts to authenticated;
grant select, insert, update, delete on public.player_arpg_loadouts to service_role;
create policy "players read own arpg loadout"
on public.player_arpg_loadouts
for select
to authenticated
using ((select auth.uid()) = user_id);
insert into public.player_arpg_loadouts (user_id)
select id from public.profiles
on conflict (user_id) do nothing;
create or replace function private.save_arpg_loadout(
  target_player_id uuid,
  target_weapon_id text,
  target_armor_id text,
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

  if cardinality(target_support_ids) <> 2
    or not (target_support_ids <@ array['support-curupira','support-boitata']::text[]) then
    raise exception 'Os dois suportes ARPG são inválidos' using errcode = '22023';
  end if;

  select count(distinct value) into distinct_supports
  from unnest(target_support_ids) as values_list(value);
  if distinct_supports <> 2 then
    raise exception 'Os suportes ARPG não podem se repetir' using errcode = '22023';
  end if;

  if cardinality(target_ability_ids) <> 4
    or not (target_ability_ids <@ array[
      'ancestral-roots','boitata-flame','saci-whirlwind','iara-song'
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

  insert into public.player_arpg_loadouts (
    user_id, weapon_id, armor_id, support_ids, ability_ids, updated_at
  ) values (
    target_player_id, target_weapon_id, target_armor_id,
    target_support_ids, target_ability_ids, now()
  )
  on conflict (user_id) do update set
    weapon_id = excluded.weapon_id,
    armor_id = excluded.armor_id,
    support_ids = excluded.support_ids,
    ability_ids = excluded.ability_ids,
    updated_at = excluded.updated_at
  returning * into result_row;

  return jsonb_build_object(
    'weaponId', result_row.weapon_id,
    'armorId', result_row.armor_id,
    'supportIds', to_jsonb(result_row.support_ids),
    'abilityIds', to_jsonb(result_row.ability_ids),
    'updatedAt', result_row.updated_at
  );
end;
$$;
revoke all on function private.save_arpg_loadout(uuid, text, text, text[], text[])
  from public, anon, authenticated;
grant execute on function private.save_arpg_loadout(uuid, text, text, text[], text[])
  to service_role;
create or replace function public.save_arpg_loadout(
  target_player_id uuid,
  target_weapon_id text,
  target_armor_id text,
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
    target_support_ids,
    target_ability_ids
  );
$$;
revoke all on function public.save_arpg_loadout(uuid, text, text, text[], text[])
  from public, anon, authenticated;
grant execute on function public.save_arpg_loadout(uuid, text, text, text[], text[])
  to service_role;
