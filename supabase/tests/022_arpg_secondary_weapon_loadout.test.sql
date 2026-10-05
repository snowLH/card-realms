begin;

create extension if not exists pgtap with schema extensions;
select plan(20);

select has_column(
  'public', 'player_arpg_loadouts', 'secondary_weapon_id',
  'ARPG loadouts persist a second weapon'
);
select col_not_null(
  'public', 'player_arpg_loadouts', 'secondary_weapon_id',
  'the second weapon is required for every stored loadout'
);
select col_has_default(
  'public', 'player_arpg_loadouts', 'secondary_weapon_id',
  'new loadouts receive a valid second weapon by default'
);
select ok(
  exists (
    select 1
    from pg_attrdef as defaults
    join pg_attribute as columns
      on columns.attrelid = defaults.adrelid
     and columns.attnum = defaults.adnum
    where defaults.adrelid = 'public.player_arpg_loadouts'::regclass
      and columns.attname = 'secondary_weapon_id'
      and pg_get_expr(defaults.adbin, defaults.adrelid) like '%iron-sword%'
  ),
  'the default secondary weapon is iron-sword'
);
select ok(
  has_function_privilege(
    'authenticated', 'public.save_arpg_loadout(text,text,text,text,text[])', 'execute'
  )
  and has_function_privilege(
    'authenticated', 'public.save_arpg_loadout(text,text,text,text[])', 'execute'
  )
  and not has_function_privilege(
    'anon', 'public.save_arpg_loadout(text,text,text,text,text[])', 'execute'
  )
  and to_regprocedure('private.save_arpg_loadout(text,text,text,text[])') is null,
  'the five-argument RPC is active and the four-argument compatibility wrapper stays public-only'
);

insert into auth.users (id, email) values
  ('52000000-0000-4000-8000-000000000001', 'secondary-owner@test.invalid'),
  ('53000000-0000-4000-8000-000000000002', 'secondary-backfill@test.invalid');

-- Simulate the shape of an existing row before the new column backfill, then
-- exercise the same data update and starter-ownership preservation as the
-- migration. The surrounding test transaction rolls these catalog changes back.
alter table public.player_arpg_loadouts
  drop constraint if exists player_arpg_loadouts_secondary_weapon_id_check;
alter table public.player_arpg_loadouts
  alter column secondary_weapon_id drop not null;
alter table public.player_arpg_loadouts
  alter column secondary_weapon_id drop default;

insert into public.player_arpg_loadouts (user_id, weapon_id, secondary_weapon_id)
values ('53000000-0000-4000-8000-000000000002', 'iron-sword', null)
on conflict (user_id) do update set
  weapon_id = excluded.weapon_id,
  secondary_weapon_id = null;

update public.player_arpg_loadouts
set secondary_weapon_id = case
  when weapon_id = 'iron-sword' then 'forest-bow'
  else 'iron-sword'
end
where secondary_weapon_id is null
   or secondary_weapon_id = weapon_id;

insert into public.inventory_items (user_id, item_key, quantity, metadata)
select
  loadout.user_id,
  'forest-bow',
  1,
  jsonb_build_object('source', 'arpg_secondary_weapon_backfill')
from public.player_arpg_loadouts as loadout
where loadout.weapon_id = 'iron-sword'
  and loadout.secondary_weapon_id = 'forest-bow'
on conflict (user_id, item_key) do update
set quantity = greatest(public.inventory_items.quantity, 1),
    metadata = public.inventory_items.metadata || excluded.metadata,
    updated_at = now();

alter table public.player_arpg_loadouts
  alter column secondary_weapon_id set default 'iron-sword';
alter table public.player_arpg_loadouts
  alter column secondary_weapon_id set not null;
alter table public.player_arpg_loadouts
  add constraint player_arpg_loadouts_secondary_weapon_id_check
  check (
    secondary_weapon_id <> weapon_id
    and secondary_weapon_id in (
      'iron-sword', 'forest-bow', 'ritual-staff',
      'tide-blade', 'river-bow', 'iara-song-staff',
      'runic-sabre', 'alicanto-bow', 'raiju-staff'
    )
  );

select ok(
  not exists (
    select 1
    from public.player_arpg_loadouts as loadout
    where loadout.secondary_weapon_id is null
       or loadout.secondary_weapon_id = loadout.weapon_id
       or loadout.secondary_weapon_id not in (
         'iron-sword', 'forest-bow', 'ritual-staff',
         'tide-blade', 'river-bow', 'iara-song-staff',
         'runic-sabre', 'alicanto-bow', 'raiju-staff'
       )
       or (loadout.weapon_id = 'iron-sword' and loadout.secondary_weapon_id <> 'forest-bow')
  ),
  'backfill leaves every loadout with a valid, distinct secondary weapon, including iron-sword primaries'
);
select is(
  (select secondary_weapon_id
   from public.player_arpg_loadouts
   where user_id = '53000000-0000-4000-8000-000000000002'),
  'forest-bow'::text,
  'an existing iron-sword primary is backfilled to the distinct forest-bow'
);
select ok(
  exists (
    select 1 from public.inventory_items
    where user_id = '53000000-0000-4000-8000-000000000002'
      and item_key = 'forest-bow' and quantity > 0
  ),
  'the backfilled starter secondary remains owned by its existing player'
);

insert into public.player_arpg_loadouts (user_id)
values ('52000000-0000-4000-8000-000000000001')
on conflict (user_id) do nothing;
select is(
  (select secondary_weapon_id
   from public.player_arpg_loadouts
   where user_id = '52000000-0000-4000-8000-000000000001'),
  'iron-sword'::text,
  'new loadout rows default to the distinct starter secondary'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '52000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.save_arpg_loadout(
      'forest-bow', 'ritual-staff', 'leather-armor', 'cartographer-compass',
      array['ancestral-roots','boitata-flame']::text[]
    )$$,
  '42501', null,
  'the five-argument RPC rejects an unowned secondary weapon'
);
select throws_ok(
  $$select public.save_arpg_loadout(
      'ritual-staff', 'iron-sword', 'leather-armor', 'cartographer-compass',
      array['ancestral-roots','boitata-flame']::text[]
    )$$,
  '42501', null,
  'the five-argument RPC rejects an unowned primary weapon'
);
select throws_ok(
  $$select public.save_arpg_loadout(
      'forest-bow', 'forest-bow', 'leather-armor', 'cartographer-compass',
      array['ancestral-roots','boitata-flame']::text[]
    )$$,
  '22023', null,
  'the five-argument RPC rejects duplicate weapons'
);

reset role;
insert into public.inventory_items (user_id, item_key, quantity, metadata)
values (
  '52000000-0000-4000-8000-000000000001',
  'ritual-staff', 1, '{"source":"test"}'::jsonb
)
on conflict (user_id, item_key) do update set quantity = 1;

set local role authenticated;
select set_config('request.jwt.claim.sub', '52000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.save_arpg_loadout(
      'forest-bow', 'ritual-staff', 'leather-armor', 'cartographer-compass',
      array['ancestral-roots','boitata-flame']::text[]
    )$$,
  'a player can save both owned weapons with the five-argument RPC'
);
select is(
  public.save_arpg_loadout(
    'forest-bow', 'ritual-staff', 'leather-armor', 'cartographer-compass',
    array['ancestral-roots','boitata-flame']::text[]
  ) ->> 'weaponId',
  'forest-bow'::text,
  'the save result returns the primary weapon'
);
select is(
  public.save_arpg_loadout(
    'forest-bow', 'ritual-staff', 'leather-armor', 'cartographer-compass',
    array['ancestral-roots','boitata-flame']::text[]
  ) ->> 'secondaryWeaponId',
  'ritual-staff'::text,
  'the save result returns the secondary weapon'
);
select is(
  (select weapon_id || '/' || secondary_weapon_id
   from public.player_arpg_loadouts
   where user_id = auth.uid()),
  'forest-bow/ritual-staff'::text,
  'both selected weapons persist in the loadout row'
);
reset role;

select is(
  private.arpg_raid_loadout_snapshot('52000000-0000-4000-8000-000000000001') ->> 'secondaryWeaponId',
  'ritual-staff'::text,
  'new ARPG Raid snapshots include the saved secondary weapon'
);
delete from public.inventory_items
where user_id = '52000000-0000-4000-8000-000000000001'
  and item_key = 'ritual-staff';
select throws_ok(
  $$select private.arpg_raid_loadout_snapshot('52000000-0000-4000-8000-000000000001')$$,
  '42501', null,
  'Raid snapshot creation rejects a secondary weapon the player no longer owns'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '52000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.save_arpg_loadout(
      'forest-bow', 'leather-armor', 'cartographer-compass',
      array['ancestral-roots','boitata-flame']::text[]
    )$$,
  'the public four-argument compatibility wrapper still saves a default secondary'
);
select is(
  public.save_arpg_loadout(
    'forest-bow', 'leather-armor', 'cartographer-compass',
    array['ancestral-roots','boitata-flame']::text[]
  ) ->> 'secondaryWeaponId',
  'iron-sword'::text,
  'the legacy wrapper delegates with the default secondary weapon'
);

select * from finish(true);
rollback;
