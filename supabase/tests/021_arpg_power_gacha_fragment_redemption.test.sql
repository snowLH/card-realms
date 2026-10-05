begin;

create extension if not exists pgtap with schema extensions;
select plan(30);

select ok(
  has_function_privilege('authenticated', 'public.redeem_arpg_power_gacha_card(uuid,text,uuid)', 'execute'),
  'authenticated players can redeem a power with fragments'
);
select ok(
  not has_function_privilege('anon', 'public.redeem_arpg_power_gacha_card(uuid,text,uuid)', 'execute'),
  'anonymous callers cannot redeem powers'
);
select ok(
  not has_table_privilege('authenticated', 'private.arpg_power_gacha_redemptions', 'select'),
  'authenticated clients cannot inspect the redemption ledger'
);
select is(private.arpg_power_gacha_fragment_cost('common'), 25, 'common cards have a fixed fragment price');
select is(private.arpg_power_gacha_fragment_cost('uncommon'), 40, 'uncommon cards have a fixed fragment price');
select is(private.arpg_power_gacha_fragment_cost('rare'), 70, 'rare cards have a fixed fragment price');
select is(private.arpg_power_gacha_fragment_cost('epic'), 120, 'epic cards have a fixed fragment price');
select is(private.arpg_power_gacha_fragment_cost('legendary'), 225, 'legendary cards have a fixed fragment price');
select is(private.arpg_power_gacha_fragment_cost('mythic'), 300, 'mythic cards have a fixed fragment price');

insert into auth.users (id, email) values
  ('83000000-0000-4000-8000-000000000008', 'gacha-redeem-owner@test.invalid'),
  ('84000000-0000-4000-8000-000000000008', 'gacha-redeem-other@test.invalid');

select is(
  (select coins from public.profiles where id = '83000000-0000-4000-8000-000000000008'),
  500::bigint,
  'fragment redemptions use the normal profile and do not require a currency purchase'
);

insert into private.arpg_power_gacha_state (user_id, legend_fragments)
values ('83000000-0000-4000-8000-000000000008', 25)
on conflict (user_id) do update set legend_fragments = excluded.legend_fragments;

set local role authenticated;
select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000008', true);
select lives_ok(
  $$select public.get_arpg_power_gacha_state()$$,
  'an authenticated player can load fragment costs and owned powers'
);
select is(
  public.get_arpg_power_gacha_state() -> 'ownedCardIds',
  '[]'::jsonb,
  'the new player has no owned gacha pool cards'
);
select is(
  public.get_arpg_power_gacha_state() #>> '{fragmentCosts,common}',
  '25'::text,
  'the state response discloses the fixed common-card price'
);
select lives_ok(
  $$select public.redeem_arpg_power_gacha_card(
    '83000000-0000-4000-8000-000000000008',
    'caipora-arrow',
    '83000000-0000-4000-8000-000000000001'
  )$$,
  'a funded player can redeem an unowned card'
);
reset role;

select is(
  (select count(*) from private.arpg_power_gacha_redemptions
    where user_id = '83000000-0000-4000-8000-000000000008'),
  1::bigint,
  'the server records one successful redemption'
);
select is(
  (select legend_fragments from private.arpg_power_gacha_state
    where user_id = '83000000-0000-4000-8000-000000000008'),
  0,
  'a common redemption spends exactly 25 fragments'
);
select is(
  (select quantity from public.inventory_items
    where user_id = '83000000-0000-4000-8000-000000000008'
      and item_key = 'caipora-arrow'),
  1,
  'a redemption grants the selected power once'
);
select is(
  (select coins from public.profiles where id = '83000000-0000-4000-8000-000000000008'),
  500::bigint,
  'a fragment redemption does not debit coins'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000008', true);
select is(
  public.redeem_arpg_power_gacha_card(
    '83000000-0000-4000-8000-000000000008',
    'caipora-arrow',
    '83000000-0000-4000-8000-000000000001'
  ) ->> 'replayed',
  'true'::text,
  'retrying a redemption key replays the original result'
);
select is(
  public.redeem_arpg_power_gacha_card(
    '83000000-0000-4000-8000-000000000008',
    'caipora-arrow',
    '83000000-0000-4000-8000-000000000001'
  ) ->> 'fragmentsSpent',
  '25'::text,
  'a redemption replay reports the original fixed cost'
);
select ok(
  public.get_arpg_power_gacha_state() -> 'ownedCardIds' ? 'caipora-arrow',
  'the account state includes the redeemed card in its owned list'
);
select throws_ok(
  $$select public.redeem_arpg_power_gacha_card(
    '83000000-0000-4000-8000-000000000008',
    'kappa-splash',
    '83000000-0000-4000-8000-000000000002'
  )$$,
  '22023', null,
  'a player without enough fragments cannot redeem another card'
);
reset role;

select is(
  (select count(*) from public.inventory_items
    where user_id = '83000000-0000-4000-8000-000000000008'
      and item_key = 'kappa-splash'),
  0::bigint,
  'an insufficient-fragment attempt grants no card'
);
select is(
  (select count(*) from private.arpg_power_gacha_redemptions
    where user_id = '83000000-0000-4000-8000-000000000008'),
  1::bigint,
  'an insufficient-fragment attempt is not recorded as a redemption'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000008', true);
select throws_ok(
  $$select public.redeem_arpg_power_gacha_card(
    '83000000-0000-4000-8000-000000000008',
    'caipora-arrow',
    '83000000-0000-4000-8000-000000000003'
  )$$,
  '23505', null,
  'an already owned card cannot be redeemed again'
);
select throws_ok(
  $$select public.redeem_arpg_power_gacha_card(
    '84000000-0000-4000-8000-000000000008',
    'kappa-splash',
    '83000000-0000-4000-8000-000000000004'
  )$$,
  '42501', null,
  'a player cannot redeem against another account id'
);
select throws_ok(
  $$select public.redeem_arpg_power_gacha_card(
    '83000000-0000-4000-8000-000000000008',
    'kappa-splash',
    '83000000-0000-4000-8000-000000000001'
  )$$,
  '22023', null,
  'an idempotency key cannot be reused for another selected card'
);
select throws_ok(
  $$select public.roll_arpg_power_gacha(
    '83000000-0000-4000-8000-000000000005',
    '84000000-0000-4000-8000-000000000008'
  )$$,
  '42501', null,
  'a roll idempotency key is rejected when bound to another account'
);
reset role;

select is(
  (select count(*) from public.inventory_items
    where user_id = '84000000-0000-4000-8000-000000000008'
      and item_key = 'kappa-splash'),
  0::bigint,
  'a mismatched account id cannot grant inventory to another player'
);
select is(
  (select coins from public.profiles where id = '83000000-0000-4000-8000-000000000008'),
  500::bigint,
  'failed and replayed redemptions leave the wallet unchanged'
);

select * from finish(true);
rollback;
