-- Raid performance hardening after production advisors.

create index if not exists raid_actions_user_idx
  on public.raid_actions (user_id, created_at desc);

create index if not exists raid_reward_ledger_player_idx
  on public.raid_reward_ledger (player_id, granted_at desc);

create index if not exists raid_reward_ledger_room_idx
  on public.raid_reward_ledger (room_id);

create index if not exists raid_rooms_host_idx
  on public.raid_rooms (host_id, created_at desc);

drop policy if exists "players read own raid rewards" on public.raid_reward_ledger;
create policy "players read own raid rewards"
on public.raid_reward_ledger for select to authenticated
using (player_id = (select auth.uid()));

drop policy if exists "raid players receive private broadcasts" on realtime.messages;
create policy "raid players receive private broadcasts"
on realtime.messages for select to authenticated
using (
  exists (
    select 1
    from public.raid_participants participant
    where participant.user_id = (select auth.uid())
      and topic = 'raid:room:' || participant.room_id::text
  )
);
