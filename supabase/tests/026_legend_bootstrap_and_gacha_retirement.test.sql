begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('f3000000-0000-4000-8000-000000000001', 'legend-contract-bootstrap@test.invalid');

select is(
  (
    select coalesce(array_agg(inventory.item_key order by inventory.item_key), array[]::text[])
    from public.inventory_items as inventory
    where inventory.user_id = 'f3000000-0000-4000-8000-000000000001'
      and (
        inventory.item_key in ('ancestral-roots', 'boitata-flame')
        or inventory.item_key in (
          select catalog.card_id from private.arpg_power_gacha_catalog as catalog
        )
        or exists (
          select 1
          from unnest(array[
            'curupira', 'iara', 'boto', 'kappa', 'raiju', 'amarok', 'kelpie',
            'mapinguari', 'ahuizotl', 'ratatoskr', 'carbunclo', 'alicanto', 'yeti'
          ]::text[]) as legends(legend_id)
          cross join lateral unnest(
            private.legend_signature_ability_ids(legends.legend_id)
          ) as ability(ability_id)
          where ability.ability_id = inventory.item_key
        )
      )
  ),
  array['curupira-ember-arrow', 'curupira-root-snare']::text[],
  'a new profile receives only Curupira signature abilities, not legacy or gacha cards'
);
select is(
  (select count(*)::bigint
   from public.inventory_items as inventory
   where inventory.user_id = 'f3000000-0000-4000-8000-000000000001'
     and inventory.item_key like 'support-%'),
  0::bigint,
  'a new profile receives no supporter inventory'
);
select is(
  (select count(*)::bigint
   from public.inventory_items as inventory
   where inventory.user_id = 'f3000000-0000-4000-8000-000000000001'
     and inventory.item_key in (
       'leather-armor', 'forest-guardian-armor', 'ritual-cloak',
       'river-shell-armor', 'kelpie-mist-cloak', 'ahuizotl-guard-armor',
       'highland-coat', 'amarok-hunter-armor', 'carbunclo-mantle'
     )),
  0::bigint,
  'a new profile receives no armor inventory'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'public.purchase_arpg_power_card(text)',
      'private.purchase_arpg_power_card(text)',
      'public.get_arpg_power_gacha_state()',
      'private.get_arpg_power_gacha_state()',
      'private.roll_arpg_power_gacha(uuid)',
      'public.roll_arpg_power_gacha(uuid,uuid)',
      'private.roll_arpg_power_gacha(uuid,uuid)',
      'public.redeem_arpg_power_gacha_card(uuid,text,uuid)',
      'private.redeem_arpg_power_gacha_card(uuid,text,uuid)',
      'private.arpg_power_gacha_odds(integer)',
      'private.arpg_power_gacha_fragment_cost(text)'
    ]::text[]) as legacy(function_name)
    where has_function_privilege('authenticated', legacy.function_name, 'execute')
  )
  and not exists (
    select 1
    from unnest(array[
      'public.purchase_arpg_power_card(text)',
      'private.purchase_arpg_power_card(text)',
      'public.get_arpg_power_gacha_state()',
      'private.get_arpg_power_gacha_state()',
      'private.roll_arpg_power_gacha(uuid)',
      'public.roll_arpg_power_gacha(uuid,uuid)',
      'private.roll_arpg_power_gacha(uuid,uuid)',
      'public.redeem_arpg_power_gacha_card(uuid,text,uuid)',
      'private.redeem_arpg_power_gacha_card(uuid,text,uuid)',
      'private.arpg_power_gacha_odds(integer)',
      'private.arpg_power_gacha_fragment_cost(text)'
    ]::text[]) as legacy(function_name)
    where has_function_privilege('anon', legacy.function_name, 'execute')
  )
  and not exists (
    select 1
    from unnest(array[
      'public.purchase_arpg_power_card(text)',
      'private.purchase_arpg_power_card(text)',
      'public.get_arpg_power_gacha_state()',
      'private.get_arpg_power_gacha_state()',
      'private.roll_arpg_power_gacha(uuid)',
      'public.roll_arpg_power_gacha(uuid,uuid)',
      'private.roll_arpg_power_gacha(uuid,uuid)',
      'public.redeem_arpg_power_gacha_card(uuid,text,uuid)',
      'private.redeem_arpg_power_gacha_card(uuid,text,uuid)',
      'private.arpg_power_gacha_odds(integer)',
      'private.arpg_power_gacha_fragment_cost(text)'
    ]::text[]) as legacy(function_name)
    where has_function_privilege('service_role', legacy.function_name, 'execute')
  ),
  'API roles cannot execute legacy standalone power purchase or gacha helpers'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_row
    where trigger_row.tgrelid = 'public.profiles'::regclass
      and trigger_row.tgname = 'seed_arpg_power_starters_after_profile'
      and not trigger_row.tgisinternal
  ),
  'new profiles no longer run the legacy starter-power trigger'
);
select ok(
  to_regprocedure('public.roll_arpg_power_gacha(uuid)') is null,
  'the retired public one-argument gacha RPC is absent'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub', 'f3000000-0000-4000-8000-000000000001', true
);
select lives_ok(
  $$select public.save_arpg_loadout(
      'forest-bow', 'leather-armor', 'cartographer-compass',
      array['curupira-root-snare','curupira-ember-arrow']::text[]
    )$$,
  'the current Legend entitlement still supports the strict active loadout'
);
select throws_ok(
  $$select public.purchase_arpg_power_card('iara-enchanting-song')$$,
  '42501', null,
  'an ability cannot be bought through the retired standalone purchase RPC'
);
select throws_ok(
  $$select public.get_arpg_power_gacha_state()$$,
  '42501', null,
  'the public gacha state RPC is inaccessible'
);
select throws_ok(
  $$select public.roll_arpg_power_gacha(
      'f3000000-0000-4000-8000-000000000002'::uuid,
      'f3000000-0000-4000-8000-000000000001'::uuid
    )$$,
  '42501', null,
  'the two-argument public gacha RPC is inaccessible'
);
select throws_ok(
  $$select private.get_arpg_power_gacha_state()$$,
  '42501', null,
  'authenticated callers cannot bypass the retired public gacha wrapper'
);
select throws_ok(
  $$select private.roll_arpg_power_gacha(
      'f3000000-0000-4000-8000-000000000002'::uuid,
      'f3000000-0000-4000-8000-000000000001'::uuid
    )$$,
  '42501', null,
  'authenticated callers cannot invoke the private gacha authority directly'
);
select throws_ok(
  $$select private.redeem_arpg_power_gacha_card(
      'f3000000-0000-4000-8000-000000000001'::uuid,
      'iara-enchanting-song',
      'f3000000-0000-4000-8000-000000000002'::uuid
    )$$,
  '42501', null,
  'authenticated callers cannot invoke private fragment redemption'
);
reset role;

select * from finish();
rollback;
