-- Harden the online boundary before staging homologation.
-- Authoritative battle state is server-only; authenticated clients receive DTOs
-- from the application API and use Realtime only as an invalidation signal.

drop policy if exists "participants read battles" on public.battles;
drop policy if exists "participants read participants" on public.battle_participants;
drop policy if exists "participants read actions" on public.battle_actions;
drop policy if exists "participants read battle events" on public.battle_events;

revoke all on public.battles, public.battle_participants,
  public.battle_actions, public.battle_events from anon, authenticated;

do $$
begin
  alter publication supabase_realtime drop table public.battle_events;
exception
  when undefined_object then null;
end $$;

-- Friendship rows may only be created as pending and only the addressee may
-- accept/block them. Column grants make participant IDs immutable to clients.
drop policy if exists "friends see shared requests" on public.friendships;
drop policy if exists "players send friend requests" on public.friendships;
drop policy if exists "addressees respond to friend requests" on public.friendships;
drop policy if exists "friends remove shared requests" on public.friendships;

revoke insert, update on public.friendships from authenticated;
grant insert (requester_id, addressee_id) on public.friendships to authenticated;
grant update (status) on public.friendships to authenticated;

create policy "friends see shared requests" on public.friendships
for select to authenticated
using ((select auth.uid()) in (requester_id, addressee_id));

create policy "players send pending friend requests" on public.friendships
for insert to authenticated
with check (
  (select auth.uid()) = requester_id
  and status = 'pending'
);

create policy "addressees respond to friend requests" on public.friendships
for update to authenticated
using (
  (select auth.uid()) = addressee_id
  and status in ('pending', 'accepted')
)
with check (
  (select auth.uid()) = addressee_id
  and status in ('accepted', 'blocked')
);

create policy "friends remove shared requests" on public.friendships
for delete to authenticated
using ((select auth.uid()) in (requester_id, addressee_id));

create unique index one_friendship_per_pair
on public.friendships (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);

-- Realtime Authorization must use the requested topic, not a client-published
-- payload field. Clients receive Broadcast only; they never receive presence or
-- permission to publish authoritative game messages.
drop policy if exists "players receive own pvp broadcasts" on realtime.messages;

create policy "players receive own pvp broadcasts"
on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (
    (select realtime.topic()) = 'pvp:player:' || (select auth.uid())::text
    or case
      when (select realtime.topic()) ~
        '^pvp:battle:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then private.is_battle_participant(
        split_part((select realtime.topic()), ':', 3)::uuid
      )
      else false
    end
  )
);

-- Index every frequently traversed foreign key that is not already covered by
-- a primary/unique index. This also keeps cascades and RLS membership checks
-- from degrading as staging data grows.
create index if not exists creature_catalog_evolves_to_idx
  on public.creature_catalog (evolves_to) where evolves_to is not null;
create index if not exists player_creatures_creature_idx
  on public.player_creatures (creature_id);
create index if not exists teams_user_idx
  on public.teams (user_id);
create index if not exists team_members_player_creature_idx
  on public.team_members (player_creature_id);
create index if not exists exploration_progress_region_idx
  on public.exploration_progress (region_id);
create index if not exists friendships_addressee_status_idx
  on public.friendships (addressee_id, status, created_at desc);
create index if not exists house_items_house_idx
  on public.house_items (house_id);
create index if not exists loot_boxes_user_idx
  on public.loot_boxes (user_id, created_at desc);
create index if not exists battles_created_by_idx
  on public.battles (created_by) where created_by is not null;
create index if not exists battles_region_idx
  on public.battles (region_id) where region_id is not null;
create index if not exists battles_active_turn_idx
  on public.battles (turn_user_id) where status = 'active';
create index if not exists battles_winner_idx
  on public.battles (winner_id) where winner_id is not null;
create index if not exists battle_participants_user_idx
  on public.battle_participants (user_id, battle_id);
create index if not exists battle_actions_user_idx
  on public.battle_actions (user_id, battle_id);
create index if not exists event_participation_user_idx
  on public.event_participation (user_id, event_id);
create index if not exists player_missions_mission_idx
  on public.player_missions (mission_id, user_id);
create index if not exists region_connections_target_idx
  on public.region_connections (target_region_id, source_region_id);
create index if not exists player_world_state_region_idx
  on public.player_world_state (current_region_id);
create index if not exists player_achievements_achievement_idx
  on public.player_achievements (achievement_id, user_id);
create index if not exists battle_results_opponent_idx
  on public.battle_results (opponent_id) where opponent_id is not null;
