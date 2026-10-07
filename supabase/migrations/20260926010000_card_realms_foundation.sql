-- Card Realms: persistent online foundation.
-- The public schema is intentionally protected with RLS and explicit grants.

create extension if not exists pgcrypto with schema extensions;
create type public.card_element as enum (
  'fire', 'water', 'nature', 'electric', 'ice', 'shadow', 'neutral'
);
create type public.card_rarity as enum (
  'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'
);
create type public.battle_mode as enum (
  'story', 'guardian', 'pvp', 'coop_boss'
);
create type public.battle_status as enum (
  'lobby', 'active', 'finished', 'abandoned'
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[a-zA-Z0-9_]{3,24}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_url text,
  level integer not null default 1 check (level >= 1),
  xp bigint not null default 0 check (xp >= 0),
  coins bigint not null default 500 check (coins >= 0),
  gems bigint not null default 0 check (gems >= 0),
  equipped_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_username_unique on public.profiles (lower(username));
create table public.regions (
  id text primary key,
  name text not null,
  subtitle text not null,
  inspiration text not null,
  level_min integer not null check (level_min >= 1),
  level_max integer check (level_max is null or level_max >= level_min),
  sort_order integer not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.creature_catalog (
  id text primary key,
  name text not null unique,
  title text not null,
  element public.card_element not null,
  rarity public.card_rarity not null,
  region_id text references public.regions(id) on delete set null,
  role text not null check (role in ('striker', 'guardian', 'support', 'controller', 'skirmisher')),
  hp integer not null check (hp between 1 and 999),
  defense integer not null check (defense between 0 and 999),
  speed integer not null check (speed between 0 and 999),
  description text not null,
  lore text not null,
  folklore_inspiration text not null,
  traits text[] not null default '{}',
  attacks jsonb not null check (jsonb_typeof(attacks) = 'array' and jsonb_array_length(attacks) = 3),
  obtainable_by text not null,
  evolution_family text,
  evolution_stage smallint check (evolution_stage is null or evolution_stage between 1 and 5),
  evolves_to text references public.creature_catalog(id) deferrable initially deferred,
  art_slot smallint not null check (art_slot between 0 and 6),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index creature_catalog_element_idx on public.creature_catalog (element);
create index creature_catalog_region_idx on public.creature_catalog (region_id);
create table public.player_creatures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  creature_id text not null references public.creature_catalog(id),
  nickname text check (nickname is null or char_length(nickname) between 1 and 24),
  level integer not null default 1 check (level between 1 and 100),
  xp bigint not null default 0 check (xp >= 0),
  bond integer not null default 0 check (bond between 0 and 100),
  variant text not null default 'standard',
  acquired_from text not null default 'starter',
  acquired_at timestamptz not null default now()
);
create index player_creatures_user_idx on public.player_creatures (user_id, acquired_at desc);
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Equipe principal' check (char_length(name) between 1 and 40),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index one_active_team_per_player on public.teams (user_id) where is_active;
create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  slot smallint not null check (slot between 1 and 6),
  player_creature_id uuid not null references public.player_creatures(id) on delete cascade,
  primary key (team_id, slot),
  unique (team_id, player_creature_id)
);
create table public.exploration_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  region_id text not null references public.regions(id) on delete cascade,
  creatures_discovered integer not null default 0 check (creatures_discovered >= 0),
  treasures_found integer not null default 0 check (treasures_found >= 0),
  sanctuary_completed boolean not null default false,
  guardian_defeated boolean not null default false,
  last_visited_at timestamptz not null default now(),
  primary key (user_id, region_id)
);
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);
create table public.houses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null default 'Refúgio do Cartógrafo' check (char_length(name) between 1 and 60),
  theme text not null default 'cartographer',
  is_public boolean not null default false,
  layout jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table public.house_items (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  item_key text not null,
  position jsonb not null default '{"x":0,"y":0}'::jsonb,
  rotation integer not null default 0,
  placed_at timestamptz not null default now()
);
create table public.loot_boxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  box_type text not null check (box_type in ('wooden', 'silver', 'golden', 'event')),
  status text not null default 'sealed' check (status in ('sealed', 'opening', 'opened')),
  reward jsonb,
  earned_from text not null,
  created_at timestamptz not null default now(),
  opened_at timestamptz
);
create table public.reward_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  reward jsonb not null check (jsonb_typeof(reward) = 'object'),
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_id)
);
create table public.battles (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  mode public.battle_mode not null,
  status public.battle_status not null default 'lobby',
  region_id text references public.regions(id) on delete set null,
  round integer not null default 1 check (round >= 1),
  turn_user_id uuid references public.profiles(id) on delete set null,
  winner_id uuid references public.profiles(id) on delete set null,
  state jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create table public.battle_participants (
  battle_id uuid not null references public.battles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  seat smallint not null check (seat between 1 and 4),
  team_snapshot jsonb not null check (jsonb_typeof(team_snapshot) = 'array' and jsonb_array_length(team_snapshot) = 6),
  is_ready boolean not null default false,
  rating_before integer,
  rating_after integer,
  primary key (battle_id, user_id),
  unique (battle_id, seat)
);
create table public.battle_actions (
  id bigint generated always as identity primary key,
  battle_id uuid not null references public.battles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_action_id uuid not null,
  action_type text not null check (action_type in ('acquire_energy', 'attach_energy', 'switch', 'attack', 'pass', 'surrender')),
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  unique (battle_id, client_action_id)
);
create table public.battle_events (
  id bigint generated always as identity primary key,
  battle_id uuid not null references public.battles(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  sequence integer not null,
  created_at timestamptz not null default now(),
  unique (battle_id, sequence)
);
alter table public.battle_events replica identity full;
create table public.world_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  event_type text not null check (event_type in ('weekend', 'seasonal', 'coop_boss', 'region_bonus')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  rules jsonb not null default '{}'::jsonb,
  rewards jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  check (ends_at > starts_at)
);
create table public.event_participation (
  event_id uuid not null references public.world_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  progress jsonb not null default '{}'::jsonb,
  reward_claimed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create table public.missions (
  id text primary key,
  title text not null,
  description text not null,
  objective jsonb not null,
  rewards jsonb not null,
  repeatable text not null default 'once' check (repeatable in ('once', 'daily', 'weekly')),
  enabled boolean not null default true
);
create table public.player_missions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  mission_id text not null references public.missions(id) on delete cascade,
  progress integer not null default 0 check (progress >= 0),
  completed_at timestamptz,
  claimed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, mission_id)
);
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger creature_catalog_set_updated_at before update on public.creature_catalog
for each row execute function public.set_updated_at();
create trigger teams_set_updated_at before update on public.teams
for each row execute function public.set_updated_at();
create trigger friendships_set_updated_at before update on public.friendships
for each row execute function public.set_updated_at();
create trigger houses_set_updated_at before update on public.houses
for each row execute function public.set_updated_at();
create trigger battles_set_updated_at before update on public.battles
for each row execute function public.set_updated_at();
create trigger event_participation_set_updated_at before update on public.event_participation
for each row execute function public.set_updated_at();
create trigger player_missions_set_updated_at before update on public.player_missions
for each row execute function public.set_updated_at();
create or replace function public.check_team_member_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  team_owner uuid;
  creature_owner uuid;
begin
  select user_id into team_owner from public.teams where id = new.team_id;
  select user_id into creature_owner from public.player_creatures where id = new.player_creature_id;
  if team_owner is null or creature_owner is null or team_owner <> creature_owner then
    raise exception 'A criatura e a equipe precisam pertencer ao mesmo jogador';
  end if;
  return new;
end;
$$;
create trigger team_member_owner_guard before insert or update on public.team_members
for each row execute function public.check_team_member_owner();
insert into public.regions (id, name, subtitle, inspiration, level_min, level_max, sort_order) values
  ('roots', 'Floresta das Raízes Antigas', 'Onde árvores guardam pactos e caminhos', 'Lendas florestais brasileiras e sul-americanas', 1, 12, 1),
  ('archipelago', 'Arquipélago dos Espíritos', 'Marés, ilhas e memórias navegantes', 'Folclores costeiros e oceânicos do mundo', 8, 20, 2),
  ('runic', 'Montanhas Rúnicas', 'Pedra, gelo e trovões sob inscrições antigas', 'Tradições montanhesas, nórdicas e centro-asiáticas', 15, 28, 3),
  ('mist', 'Pântano da Névoa', 'O limiar entre o doméstico e o encantado', 'Contos de casas, brumas e espíritos guardiões', 18, 32, 4),
  ('desert', 'Deserto dos Reis Esquecidos', 'Cidades soterradas sob o sol de cobre', 'Narrativas do norte da África e do Oriente Médio', 24, 38, 5),
  ('deep-sea', 'Mar das Profundezas', 'Ilhas vivas e santuários submersos', 'Lendas marítimas e cosmologias insulares', 32, 48, 6),
  ('eclipse', 'Reino do Eclipse', 'Luz e sombra disputam um céu imóvel', 'Contos de transformação, noite e equilíbrio', 40, null, 7);
insert into public.creature_catalog
  (id, name, title, element, rarity, region_id, role, hp, defense, speed, description, lore, folklore_inspiration, traits, attacks, obtainable_by, evolution_family, evolution_stage, evolves_to, art_slot)
values
  ('ignavora', 'Ignavora', 'Lagarta das Cinzas Vivas', 'fire', 'rare', 'roots', 'striker', 120, 42, 58,
   'Guarda brasas antigas sob escamas de carvão.', 'Nasceu onde uma estrela tocou as colinas vulcânicas de Aurória.',
   'Lendas universais de salamandras e fogos protetores', array['chama','cinzas'],
   '[{"id":"ignavora-1","name":"Chama Inicial","cost":1,"damage":25,"minRoll":2},{"id":"ignavora-2","name":"Explosão Ancestral","cost":2,"damage":60,"minRoll":3},{"id":"ignavora-3","name":"Fúria das Cinzas","cost":3,"damage":100,"minRoll":4}]',
   'Vínculo selvagem na Floresta das Raízes Antigas', 'ignavora', 1, null, 0),
  ('marulino', 'Marulino', 'Lontra das Marés Cantantes', 'water', 'common', 'archipelago', 'support', 98, 41, 68,
   'Conversa com as correntes por meio de assobios.', 'Barcos perdidos seguem seu canto de volta aos arrecifes.',
   'Lendas costeiras e animais-guia oceânicos', array['maré','canto'],
   '[{"id":"marulino-1","name":"Jato de Maré","cost":1,"damage":22,"minRoll":2},{"id":"marulino-2","name":"Canção das Correntes","cost":2,"damage":52,"minRoll":3},{"id":"marulino-3","name":"Abraço do Oceano","cost":3,"damage":86,"minRoll":4}]',
   'Encontro nos arrecifes do Arquipélago dos Espíritos', 'marulino', 1, null, 1),
  ('ibiram', 'Ibirãm', 'Guardião das Raízes Antigas', 'nature', 'rare', 'roots', 'guardian', 142, 76, 47,
   'Uma raposa coberta por folhas que escuta árvores centenárias.', 'É tratado pelos aldeões como mensageiro, nunca como animal doméstico.',
   'Narrativas florestais sul-americanas, sem representar entidade sagrada específica', array['natureza','raízes'],
   '[{"id":"ibiram-1","name":"Garra de Cipó","cost":1,"damage":20,"minRoll":2},{"id":"ibiram-2","name":"Círculo das Raízes","cost":2,"damage":48,"minRoll":2},{"id":"ibiram-3","name":"Memória da Mata","cost":3,"damage":92,"minRoll":4}]',
   'Vínculo após restaurar três clareiras', 'ibiram', 1, null, 2),
  ('raivel', 'Raivel', 'Falcão da Tempestade Rúnica', 'electric', 'rare', 'runic', 'skirmisher', 108, 44, 88,
   'Cruza o céu entre relâmpagos que desenham runas.', 'Seu chamado avisa as aldeias antes das grandes tempestades.',
   'Aves de trovão e símbolos rúnicos reinterpretados', array['trovão','céu'],
   '[{"id":"raivel-1","name":"Bico Voltaico","cost":1,"damage":24,"minRoll":2},{"id":"raivel-2","name":"Runa de Trovão","cost":2,"damage":55,"minRoll":3},{"id":"raivel-3","name":"Tempestade Coroada","cost":3,"damage":94,"minRoll":4}]',
   'Ninhos altos das Montanhas Rúnicas', null, null, null, 3),
  ('glaciarin', 'Glaciarin', 'Lince do Espelho de Gelo', 'ice', 'uncommon', 'runic', 'controller', 114, 55, 62,
   'Seus passos deixam pequenos espelhos congelados.', 'Caçadores seguem os reflexos para encontrar abrigo nas nevascas.',
   'Felinos da neve e contos de montanhas geladas', array['gelo','reflexo'],
   '[{"id":"glaciarin-1","name":"Garra de Geada","cost":1,"damage":22,"minRoll":2},{"id":"glaciarin-2","name":"Espelho Invernal","cost":2,"damage":54,"minRoll":3},{"id":"glaciarin-3","name":"Coroa da Nevasca","cost":3,"damage":96,"minRoll":4}]',
   'Passagens secretas das Montanhas Rúnicas', null, null, null, 4),
  ('lumissombra', 'Lumissombra', 'Gata do Limiar Lunar', 'shadow', 'epic', 'eclipse', 'controller', 122, 57, 73,
   'Seu pelo alterna entre constelações claras e vazios profundos.', 'Guarda portais antigos sem pertencer a nenhum dos lados.',
   'Animais liminares e narrativas de eclipses de diferentes tradições', array['lunar','limiar'],
   '[{"id":"lumissombra-1","name":"Eco do Limiar","cost":1,"damage":21,"minRoll":2},{"id":"lumissombra-2","name":"Selo da Lua Nova","cost":2,"damage":50,"minRoll":3},{"id":"lumissombra-3","name":"Eclipse Gêmeo","cost":3,"damage":88,"minRoll":4}]',
   'Santuário do Eclipse durante evento lunar', null, null, null, 5),
  ('pedrassu', 'Pedrassu', 'Tatu da Serra Azul', 'neutral', 'common', 'roots', 'guardian', 134, 82, 24,
   'Enrola-se numa esfera de pedra riscada por minerais azuis.', 'Seus túneis arejam o solo e preservam sementes durante secas.',
   'Fauna sul-americana e histórias de animais formadores da paisagem', array['montanha','mineral'],
   '[{"id":"pedrassu-1","name":"Rolamento Azul","cost":1,"damage":23,"minRoll":2},{"id":"pedrassu-2","name":"Couraça Serrana","cost":2,"damage":52,"minRoll":3},{"id":"pedrassu-3","name":"Falha Geológica","cost":3,"damage":90,"minRoll":4}]',
   'Trilhas rochosas da Floresta das Raízes Antigas', null, null, null, 6);
-- Resolve the deferred self-reference checks before later ALTER TABLE statements.
set constraints all immediate;
insert into public.missions (id, title, description, objective, rewards, repeatable) values
  ('roots-guardian', 'Vozes da mata', 'Vença a Guardiã Aya na Provação das Raízes.', '{"type":"win_battle","region":"roots","count":1}', '{"coins":120,"xp":80}', 'once'),
  ('daily-explore', 'Passos do cartógrafo', 'Explore duas regiões de Aurória.', '{"type":"explore","count":2}', '{"coins":60,"xp":30}', 'daily'),
  ('weekly-bonds', 'Laços de sete caminhos', 'Use criaturas dos sete tipos em batalha.', '{"type":"elements_used","count":7}', '{"coins":250,"box":"silver"}', 'weekly');
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_team_id uuid;
  creature_row record;
  creature_instance_id uuid;
  slot_number smallint := 0;
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    'viajante_' || substr(replace(new.id::text, '-', ''), 1, 10),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), 'Novo Viajante')
  );

  insert into public.houses (user_id) values (new.id);
  insert into public.teams (user_id, is_active) values (new.id, true) returning id into new_team_id;

  for creature_row in
    select id from public.creature_catalog
    where id = any(array['ignavora','marulino','ibiram','raivel','lumissombra','pedrassu'])
    order by array_position(array['ignavora','marulino','ibiram','raivel','lumissombra','pedrassu'], id)
  loop
    slot_number := slot_number + 1;
    insert into public.player_creatures (user_id, creature_id, acquired_from)
    values (new.id, creature_row.id, 'starter') returning id into creature_instance_id;
    insert into public.team_members (team_id, slot, player_creature_id)
    values (new_team_id, slot_number, creature_instance_id);
  end loop;

  return new;
end;
$$;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
create or replace function public.is_battle_participant(target_battle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.battle_participants
    where battle_id = target_battle_id and user_id = auth.uid()
  ) or exists (
    select 1 from public.battles
    where id = target_battle_id and created_by = auth.uid()
  );
$$;
alter table public.profiles enable row level security;
alter table public.regions enable row level security;
alter table public.creature_catalog enable row level security;
alter table public.player_creatures enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.exploration_progress enable row level security;
alter table public.friendships enable row level security;
alter table public.houses enable row level security;
alter table public.house_items enable row level security;
alter table public.loot_boxes enable row level security;
alter table public.reward_ledger enable row level security;
alter table public.battles enable row level security;
alter table public.battle_participants enable row level security;
alter table public.battle_actions enable row level security;
alter table public.battle_events enable row level security;
alter table public.world_events enable row level security;
alter table public.event_participation enable row level security;
alter table public.missions enable row level security;
alter table public.player_missions enable row level security;
create policy "catalog is readable" on public.creature_catalog for select using (enabled);
create policy "regions are readable" on public.regions for select using (enabled);
create policy "published events are readable" on public.world_events for select using (published);
create policy "missions are readable" on public.missions for select using (enabled);
create policy "players read own profile" on public.profiles for select using (auth.uid() = id);
create policy "players update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "players manage own creatures" on public.player_creatures for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "players manage own teams" on public.teams for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "players read own team members" on public.team_members for select
using (exists (select 1 from public.teams where teams.id = team_id and teams.user_id = auth.uid()));
create policy "players add own team members" on public.team_members for insert
with check (exists (select 1 from public.teams where teams.id = team_id and teams.user_id = auth.uid()));
create policy "players update own team members" on public.team_members for update
using (exists (select 1 from public.teams where teams.id = team_id and teams.user_id = auth.uid()))
with check (exists (select 1 from public.teams where teams.id = team_id and teams.user_id = auth.uid()));
create policy "players remove own team members" on public.team_members for delete
using (exists (select 1 from public.teams where teams.id = team_id and teams.user_id = auth.uid()));
create policy "players manage own exploration" on public.exploration_progress for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "friends see shared requests" on public.friendships for select
using (auth.uid() in (requester_id, addressee_id));
create policy "players send friend requests" on public.friendships for insert
with check (auth.uid() = requester_id);
create policy "addressees respond to friend requests" on public.friendships for update
using (auth.uid() = addressee_id)
with check (auth.uid() = addressee_id);
create policy "friends remove shared requests" on public.friendships for delete
using (auth.uid() in (requester_id, addressee_id));
create policy "players view visible houses" on public.houses for select
using (user_id = auth.uid() or is_public);
create policy "players update own house" on public.houses for update
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "players view visible house items" on public.house_items for select
using (exists (select 1 from public.houses where houses.id = house_id and (houses.user_id = auth.uid() or houses.is_public)));
create policy "players add own house items" on public.house_items for insert
with check (exists (select 1 from public.houses where houses.id = house_id and houses.user_id = auth.uid()));
create policy "players update own house items" on public.house_items for update
using (exists (select 1 from public.houses where houses.id = house_id and houses.user_id = auth.uid()))
with check (exists (select 1 from public.houses where houses.id = house_id and houses.user_id = auth.uid()));
create policy "players remove own house items" on public.house_items for delete
using (exists (select 1 from public.houses where houses.id = house_id and houses.user_id = auth.uid()));
create policy "players read own boxes" on public.loot_boxes for select using (auth.uid() = user_id);
create policy "players read own rewards" on public.reward_ledger for select using (auth.uid() = user_id);
create policy "participants read battles" on public.battles for select using (public.is_battle_participant(id));
create policy "players create battles" on public.battles for insert with check (created_by = auth.uid());
create policy "creators update lobbies" on public.battles for update
using (created_by = auth.uid() and status = 'lobby')
with check (created_by = auth.uid());
create policy "participants read participants" on public.battle_participants for select
using (public.is_battle_participant(battle_id));
create policy "players join battles" on public.battle_participants for insert
with check (user_id = auth.uid());
create policy "players update own participation" on public.battle_participants for update
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "participants read actions" on public.battle_actions for select
using (public.is_battle_participant(battle_id));
create policy "participants submit actions" on public.battle_actions for insert
with check (user_id = auth.uid() and public.is_battle_participant(battle_id));
create policy "participants read battle events" on public.battle_events for select
using (public.is_battle_participant(battle_id));
create policy "players manage own event progress" on public.event_participation for all
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "players manage own mission progress" on public.player_missions for all
using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;
grant usage on type public.card_element, public.card_rarity, public.battle_mode, public.battle_status to anon, authenticated;
grant select on public.regions, public.creature_catalog, public.world_events, public.missions to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, display_name, avatar_url, equipped_title) on public.profiles to authenticated;
grant select on public.player_creatures to authenticated;
grant update (nickname) on public.player_creatures to authenticated;
grant select, insert, update, delete on public.teams, public.team_members, public.friendships, public.house_items to authenticated;
grant select, update on public.houses to authenticated;
grant select on public.exploration_progress, public.loot_boxes, public.reward_ledger,
  public.battles, public.battle_participants, public.battle_actions, public.battle_events,
  public.event_participation, public.player_missions to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.is_battle_participant(uuid) to authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.check_team_member_owner() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
do $$
begin
  alter publication supabase_realtime add table public.battle_events;
exception
  when duplicate_object then null;
end $$;
