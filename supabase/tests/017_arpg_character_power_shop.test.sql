begin;

create extension if not exists pgtap with schema extensions;
select plan(19);

select ok(
  has_function_privilege('authenticated', 'public.purchase_playable_legend(text)', 'execute')
  and has_function_privilege('authenticated', 'public.save_avatar_config(jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.purchase_playable_legend(text)', 'execute')
  and not has_function_privilege('anon', 'public.save_avatar_config(jsonb)', 'execute'),
  'authenticated players can acquire Legends and save their active Legend'
);
select ok(
  not (select prosecdef
       from pg_catalog.pg_proc
       where oid = 'public.purchase_playable_legend(text)'::pg_catalog.regprocedure),
  'the public Legend purchase wrapper runs with invoker privileges'
);
select ok(
  not has_function_privilege('authenticated', 'public.purchase_arpg_power_card(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.get_arpg_power_gacha_state()', 'execute')
  and not has_function_privilege('authenticated', 'public.roll_arpg_power_gacha(uuid,uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.redeem_arpg_power_gacha_card(uuid,text,uuid)', 'execute')
  and not has_function_privilege('anon', 'public.purchase_arpg_power_card(text)', 'execute')
  and not has_function_privilege('anon', 'public.get_arpg_power_gacha_state()', 'execute')
  and not has_function_privilege('anon', 'public.roll_arpg_power_gacha(uuid,uuid)', 'execute')
  and not has_function_privilege('anon', 'public.redeem_arpg_power_gacha_card(uuid,text,uuid)', 'execute'),
  'clients cannot access the retired standalone power shop or gacha RPCs'
);
select ok(
  not has_function_privilege('authenticated', 'private.purchase_arpg_power_card(text)', 'execute')
  and not has_function_privilege('anon', 'private.purchase_arpg_power_card(text)', 'execute'),
  'clients cannot bypass the retired standalone power purchase wrapper'
);

insert into auth.users (id, email) values
  ('60000000-0000-4000-8000-000000000006', 'legend-power-owner@test.invalid'),
  ('70000000-0000-4000-8000-000000000007', 'legend-power-poor@test.invalid');

update public.profiles
set avatar_config = jsonb_build_object(
      'legendId', 'curupira', 'favoriteLegendId', 'curupira',
      'skin', 'copper', 'hair', 'mohawk', 'outfit', 'ranger',
      'armor', 'none', 'accent', 'crimson'
    ),
    coins = 500
where id = '60000000-0000-4000-8000-000000000006';
update public.profiles
set coins = 10
where id = '70000000-0000-4000-8000-000000000007';

select is(
  (select count(*) from public.inventory_items
   where user_id = '60000000-0000-4000-8000-000000000006'
     and item_key = 'legend-iara'),
  0::bigint,
  'the fixture starts without the Iara Legend'
);
select is(
  (select coins from public.profiles where id = '60000000-0000-4000-8000-000000000006'),
  500::bigint,
  'the fixture starts with the expected Legend-shop balance'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000006', true);

select lives_ok(
  $$select public.purchase_playable_legend('iara')$$,
  'a player can purchase the Iara Legend'
);
select is(
  (select coins from public.profiles where id = auth.uid()),
  320::bigint,
  'the Legend purchase charges its fixed price once'
);
select results_eq(
  $$select item_key, quantity, metadata ->> 'source'
    from public.inventory_items
    where user_id = auth.uid()
      and item_key = 'legend-iara'$$,
  $$values ('legend-iara'::text, 1::integer, 'legend_shop'::text)$$,
  'the Legend purchase records the Legend entitlement'
);
select lives_ok(
  $$select public.save_avatar_config(
      '{"legendId":"iara","favoriteLegendId":"iara","skin":"copper","hair":"mohawk","outfit":"ranger","armor":"none","accent":"crimson"}'::jsonb
    )$$,
  'an owned Legend can become the active Legend'
);
select is(
  (select (avatar_config ->> 'legendId') || '/' || (avatar_config ->> 'favoriteLegendId')
   from public.profiles where id = auth.uid()),
  'iara/iara'::text,
  'the saved avatar uses the owned Legend'
);
select is(
  (select ability_ids from public.player_arpg_loadouts where user_id = auth.uid()),
  array['iara-enchanting-song','iara-living-spring']::text[],
  'activating a Legend equips its signature pair without a separate power purchase'
);
select throws_ok(
  $$select public.purchase_arpg_power_card('iara-enchanting-song')$$,
  '42501', null,
  'a signature power cannot be purchased through the retired standalone RPC'
);
select throws_ok(
  $$select public.get_arpg_power_gacha_state()$$,
  '42501', null,
  'the retired power gacha state RPC is unavailable to authenticated players'
);
select throws_ok(
  $$select public.purchase_playable_legend('iara')$$,
  '23505', null,
  'a Legend cannot be purchased twice'
);
select is(
  (select coins from public.profiles where id = auth.uid()),
  320::bigint,
  'a duplicate purchase leaves the wallet unchanged'
);
select throws_ok(
  $$select public.purchase_playable_legend('invented-legend')$$,
  '22023', null,
  'the Legend shop rejects items outside its catalogue'
);

select set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000007', true);
select throws_ok(
  $$select public.purchase_playable_legend('iara')$$,
  '22023', null,
  'a player without enough coins cannot purchase a Legend'
);
select is(
  (select coins from public.profiles where id = auth.uid()),
  10::bigint,
  'an insufficient-funds purchase leaves the wallet unchanged'
);

select * from finish();
rollback;
