begin;

create extension if not exists pgtap with schema extensions;
select plan(38);

select has_column(
  'public', 'player_arpg_loadouts', 'legacy_ability_ids',
  'the prior four-card loadout is retained for compatibility'
);
select ok(
  has_function_privilege('authenticated', 'public.purchase_arpg_power_card(text)', 'execute'),
  'authenticated players can use the narrow power purchase RPC'
);
select ok(
  not has_function_privilege('anon', 'public.purchase_arpg_power_card(text)', 'execute'),
  'anonymous callers cannot purchase power cards'
);
select ok(
  has_function_privilege('authenticated', 'public.save_arpg_loadout(text,text,text,text[])', 'execute'),
  'authenticated players can save a two-card loadout'
);

insert into auth.users (id, email) values
  ('60000000-0000-4000-8000-000000000006', 'power-owner@test.invalid'),
  ('70000000-0000-4000-8000-000000000007', 'power-poor@test.invalid');
update public.profiles set coins = 10 where id = '70000000-0000-4000-8000-000000000007';

select is(
  (select coins from public.profiles where id = '60000000-0000-4000-8000-000000000006'),
  500::bigint,
  'new profiles begin with 500 coins'
);
select results_eq(
  $$select item_key, quantity from public.inventory_items
    where user_id = '60000000-0000-4000-8000-000000000006'
      and item_key in ('ancestral-roots','boitata-flame')
    order by item_key$$,
  $$values ('ancestral-roots'::text, 1::integer), ('boitata-flame'::text, 1::integer)$$,
  'a new profile receives exactly the two free starter cards'
);
select is(
  (select count(*) from public.inventory_items
    where user_id = '60000000-0000-4000-8000-000000000006'
      and item_key in ('saci-whirlwind','iara-song')),
  0::bigint,
  'Saci and Iara are not granted free to new profiles'
);
select is(
  jsonb_array_length(private.arpg_raid_loadout_snapshot(
    '60000000-0000-4000-8000-000000000006'
  ) -> 'abilityIds'),
  2,
  'new Raid snapshots expose exactly two attacks'
);
select ok(
  not (private.arpg_raid_loadout_snapshot(
    '60000000-0000-4000-8000-000000000006'
  ) ? 'supportIds'),
  'new Raid snapshots omit archived supporter IDs'
);
select is(
  private.claim_arpg_boss_card_reward(
    '60000000-0000-4000-8000-000000000006',
    '61000000-0000-4000-8000-000000000006',
    'arquipelago-das-mares'
  ) ->> 'cardId',
  null::text,
  'the old dungeon boss reward RPC no longer grants a permanent card'
);

select lives_ok(
  $$select private.claim_arpg_expedition_reward(
    '60000000-0000-4000-8000-000000000006',
    '61000000-0000-4000-8000-000000000006',
    'mata-encantada', true
  )$$,
  'a dungeon clear still grants its equipment reward'
);
select ok(
  not ((private.claim_arpg_expedition_reward(
    '60000000-0000-4000-8000-000000000006',
    '61000000-0000-4000-8000-000000000006',
    'mata-encantada', true
  ) -> 'items') @> '["caipora-arrow"]'::jsonb)
  and not ((private.claim_arpg_expedition_reward(
    '60000000-0000-4000-8000-000000000006',
    '61000000-0000-4000-8000-000000000006',
    'mata-encantada', true
  ) -> 'items') @> '["support-saci"]'::jsonb),
  'dungeon clears no longer grant power cards or supporters'
);
select is(
  (select count(*) from public.inventory_items
    where user_id = '60000000-0000-4000-8000-000000000006'
      and item_key in (
        'saci-whirlwind','iara-song','caipora-arrow','kappa-splash','kelpie-surge',
        'support-saci','support-iara','kraken-grasp'
      )),
  0::bigint,
  'the dungeon reward left no permanent cards or support items behind'
);
select lives_ok(
  $$select private.claim_arpg_expedition_reward(
    '60000000-0000-4000-8000-000000000006',
    '62000000-0000-4000-8000-000000000006',
    'montanhas-runicas', true
  )$$,
  'the third available expedition can persist its first-clear reward'
);
select ok(
  (private.claim_arpg_expedition_reward(
    '60000000-0000-4000-8000-000000000006',
    '62000000-0000-4000-8000-000000000006',
    'montanhas-runicas', true
  ) -> 'items') @> '["runic-sabre","highland-coat","raiju-staff"]'::jsonb
  and not ((private.claim_arpg_expedition_reward(
    '60000000-0000-4000-8000-000000000006',
    '62000000-0000-4000-8000-000000000006',
    'montanhas-runicas', true
  ) -> 'items') @> '["roc-horizon-storm"]'::jsonb),
  'the runic first-clear reward contains its gear and no permanent power'
);
select is(
  (select count(*) from public.inventory_items
    where user_id = '60000000-0000-4000-8000-000000000006'
      and item_key in (
        'saci-whirlwind','iara-song','caipora-arrow','kappa-splash','kelpie-surge',
        'tengu-gust','banshee-wail','medusa-gaze','kraken-grasp','simurgh-renewal',
        'support-saci','support-iara'
      )),
  0::bigint,
  'finishing the runic dungeon grants no permanent power or supporter inventory'
);
update public.profiles set coins = 500 where id = '60000000-0000-4000-8000-000000000006';

set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000006', true);

select lives_ok(
  $$select public.save_arpg_loadout(
    'forest-bow', 'leather-armor', 'cartographer-compass',
    array['ancestral-roots','boitata-flame']::text[]
  )$$,
  'a player can save exactly two owned attacks without supporter fields'
);
select is(
  (select ability_ids from public.player_arpg_loadouts where user_id = auth.uid()),
  array['ancestral-roots','boitata-flame']::text[],
  'the saved loadout contains exactly two equipped attacks'
);
select is(
  (select support_ids from public.player_arpg_loadouts where user_id = auth.uid()),
  array[]::text[],
  'a new loadout row does not write active supporter IDs'
);
select lives_ok(
  $$select public.save_arpg_loadout(
    'runic-sabre', 'highland-coat', 'cartographer-compass',
    array['ancestral-roots','boitata-flame']::text[]
  )$$,
  'a player can equip Runic Mountains gear received from its dungeon'
);
select is(
  (select weapon_id || '/' || armor_id
    from public.player_arpg_loadouts where user_id = auth.uid()),
  'runic-sabre/highland-coat'::text,
  'the saved loadout retains the selected Runic weapon and armor'
);
select throws_ok(
  $$select public.save_arpg_loadout(
    'forest-bow', 'leather-armor', 'cartographer-compass',
    array['ancestral-roots','boitata-flame','saci-whirlwind','iara-song']::text[]
  )$$,
  '22023', null,
  'the save RPC rejects the legacy four-card write shape'
);
select throws_ok(
  $$select public.save_arpg_loadout(
    'forest-bow', 'leather-armor', 'cartographer-compass',
    array['caipora-arrow','boitata-flame']::text[]
  )$$,
  '42501', null,
  'the save RPC rejects an unowned attack card'
);
select throws_ok(
  $$select public.save_arpg_loadout(
    'forest-bow', 'leather-armor', 'cartographer-compass',
    array['ancestral-roots','ancestral-roots']::text[]
  )$$,
  '22023', null,
  'the save RPC rejects duplicate powers in the two slots'
);

select lives_ok(
  $$select public.purchase_arpg_power_card('saci-whirlwind')$$,
  'the lobby purchase RPC grants a purchasable card'
);
select is(
  (select coins from public.profiles where id = auth.uid()),
  380::bigint,
  'the RPC charges the fixed uncommon price of 120 coins'
);
select is(
  (select quantity from public.inventory_items
    where user_id = auth.uid() and item_key = 'saci-whirlwind'),
  1,
  'the purchased card enters permanent inventory once'
);
select throws_ok(
  $$select public.purchase_arpg_power_card('saci-whirlwind')$$,
  '23505', null,
  'the RPC rejects buying a card twice'
);
select is(
  (select coins from public.profiles where id = auth.uid()),
  380::bigint,
  'a duplicate purchase does not charge the player again'
);
select lives_ok(
  $$select public.save_arpg_loadout(
    'runic-sabre', 'highland-coat', 'cartographer-compass',
    array['saci-whirlwind','boitata-flame']::text[]
  )$$,
  'a purchased card can be equipped with dungeon gear in the two attack slots'
);
reset role;
select is(
  private.arpg_raid_loadout_snapshot('60000000-0000-4000-8000-000000000006') ->> 'weaponId',
  'runic-sabre'::text,
  'Raid snapshots retain an owned Runic weapon'
);
delete from public.inventory_items
where user_id = '60000000-0000-4000-8000-000000000006'
  and item_key = 'runic-sabre';
select throws_ok(
  $$select private.arpg_raid_loadout_snapshot('60000000-0000-4000-8000-000000000006')$$,
  '42501', null,
  'Raid snapshot creation rejects equipment the account no longer owns'
);
insert into public.inventory_items (user_id, item_key, quantity, metadata)
values (
  '60000000-0000-4000-8000-000000000006', 'runic-sabre', 1,
  '{"source":"arpg_expedition_first_clear","expeditionId":"montanhas-runicas"}'::jsonb
);
select is(
  private.arpg_raid_loadout_snapshot('60000000-0000-4000-8000-000000000006') -> 'abilityIds',
  '["saci-whirlwind","boitata-flame"]'::jsonb,
  'Raid snapshots use the saved two-card loadout'
);
delete from public.inventory_items
where user_id = '60000000-0000-4000-8000-000000000006'
  and item_key = 'saci-whirlwind';
select throws_ok(
  $$select private.arpg_raid_loadout_snapshot('60000000-0000-4000-8000-000000000006')$$,
  '42501', null,
  'Raid snapshot creation rejects a power the account no longer owns'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000006', true);
select throws_ok(
  $$select public.purchase_arpg_power_card('ancestral-roots')$$,
  '22023', null,
  'free starter cards are not sold'
);
reset role;
update public.profiles
set coins = 700
where id = '60000000-0000-4000-8000-000000000006';
set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000006', true);
select lives_ok(
  $$select public.purchase_arpg_power_card('roc-horizon-storm')$$,
  'the mythic Roc card can be purchased in the lobby shop'
);

select set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000007', true);
select throws_ok(
  $$select public.purchase_arpg_power_card('caipora-arrow')$$,
  '22023', null,
  'a player without enough coins cannot buy a card'
);
select is(
  (select coins from public.profiles where id = auth.uid()),
  10::bigint,
  'an insufficient-funds purchase leaves the wallet unchanged'
);

select * from finish(true);
rollback;
