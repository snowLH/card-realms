-- Card Realms 2D expansion: 25 regional areas, 25 creatures, avatar layers
-- and server-authoritative village purchases.

alter table public.profiles
  add column avatar_config jsonb not null default
    '{"skin":"copper","hair":"braids","outfit":"traveler","armor":"none","accent":"gold"}'::jsonb,
  add constraint profiles_avatar_config_object
    check (jsonb_typeof(avatar_config) = 'object');
create table public.region_areas (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{1,79}$'),
  region_id text not null references public.regions(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  subtitle text not null,
  activity text not null check (activity in ('explore','wild','npc','treasure','sanctuary','boss')),
  level_label text not null,
  sort_order smallint not null check (sort_order between 1 and 20),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (region_id, sort_order)
);
create index region_areas_region_idx on public.region_areas (region_id, sort_order);
insert into public.region_areas (id, region_id, name, subtitle, activity, level_label, sort_order) values
  ('roots-gate','roots','Portal da Mata','O primeiro marco dos cartógrafos.','explore','1–3',1),
  ('roots-inverted','roots','Trilha Invertida','Pegadas apontam para o caminho errado.','wild','3–5',2),
  ('roots-whispers','roots','Clareira dos Sussurros','Vozes antigas atravessam as copas.','npc','5–7',3),
  ('roots-ruins','roots','Ruínas da Guardiã','Pedras cobertas por símbolos de proteção.','sanctuary','7–9',4),
  ('roots-heart','roots','Coração das Raízes','O domínio vivo da guardiã da floresta.','boss','10–12',5),
  ('archipelago-dock','archipelago','Cais Cartógrafo','Barcos de madeira ligam as ilhas.','explore','8–10',1),
  ('archipelago-promises','archipelago','Ilhas das Promessas','Oferendas protegem quem cruza as águas.','wild','10–12',2),
  ('archipelago-tides','archipelago','Templo das Marés','Sinos respondem ao movimento do oceano.','sanctuary','12–15',3),
  ('archipelago-reef','archipelago','Recife Ancestral','O recife guarda rotas esquecidas.','treasure','15–17',4),
  ('archipelago-abyss','archipelago','Abismo dos Espíritos','Uma presença antiga desperta sob as ilhas.','boss','18–20',5),
  ('runic-pass','runic','Passagem Glacial','O gelo revela as primeiras runas.','explore','15–17',1),
  ('runic-bridge','runic','Ponte Rúnica','Símbolos brilham a cada travessia.','npc','17–20',2),
  ('runic-mine','runic','Mina do Carbunclo','Gemas vivas iluminam túneis antigos.','treasure','20–22',3),
  ('runic-thunder','runic','Pico do Trovão','Relâmpagos escolhem seus desafiantes.','wild','22–25',4),
  ('runic-shrine','runic','Santuário do Céu','O guardião espera acima das nuvens.','boss','25–28',5),
  ('mist-bank','mist','Margem Enevoada','O caminho desaparece atrás de cada passo.','explore','18–20',1),
  ('mist-village','mist','Vila Afundada','Telhados emergem quando a névoa recua.','npc','20–23',2),
  ('mist-grove','mist','Bosque Móvel','Árvores trocam de lugar durante a noite.','wild','23–26',3),
  ('mist-echoes','mist','Charco dos Ecos','Chamados distantes atraem os desatentos.','treasure','26–29',4),
  ('mist-house','mist','Casa da Névoa','A morada muda antes do amanhecer.','boss','29–32',5),
  ('desert-gate','desert','Portão de Areia','Dunas cobrem uma estrada monumental.','explore','24–27',1),
  ('desert-ossuary','desert','Ossário Colossal','Ossos antigos formam arcos sobre a trilha.','wild','27–30',2),
  ('desert-oasis','desert','Oásis Oculto','Água e sombra recompensam os atentos.','treasure','30–33',3),
  ('desert-sun','desert','Ruínas do Sol','Espelhos de pedra concentram a luz.','sanctuary','33–35',4),
  ('desert-tomb','desert','Tumba dos Reis','O último selo aguarda além das colunas.','boss','36–38',5)
on conflict (id) do update set
  name = excluded.name,
  subtitle = excluded.subtitle,
  activity = excluded.activity,
  level_label = excluded.level_label,
  sort_order = excluded.sort_order,
  enabled = true;
alter table public.region_areas enable row level security;
create policy "enabled region areas are readable"
  on public.region_areas for select to anon, authenticated
  using (enabled);
revoke all on public.region_areas from public;
grant select on public.region_areas to anon, authenticated;
alter table public.player_world_state
  add column current_area_id text references public.region_areas(id),
  add column visited_area_ids text[] not null default '{}'::text[],
  add constraint player_world_visited_area_limit
    check (cardinality(visited_area_ids) between 0 and 200);
with first_areas as (
  select distinct on (areas.region_id) areas.region_id, areas.id
  from public.region_areas areas
  where areas.enabled
  order by areas.region_id, areas.sort_order
)
update public.player_world_state world
set current_area_id = first_areas.id,
    visited_area_ids = array[first_areas.id]
from first_areas
where first_areas.region_id = world.current_region_id;
create or replace function private.travel_to_region(target_region_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  current_region text;
  unlocked text[];
  first_area text;
  visited text[];
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;
  select current_region_id, unlocked_region_ids
  into current_region, unlocked
  from public.player_world_state
  where user_id = player_id
  for update;
  if current_region is null then
    raise exception 'Estado de mundo não encontrado' using errcode = 'P0002';
  end if;
  if not target_region_id = any(unlocked) then
    raise exception 'Região ainda bloqueada' using errcode = '22023';
  end if;
  if target_region_id <> current_region and not exists (
    select 1 from public.region_connections
    where from_region_id = current_region and to_region_id = target_region_id
  ) then
    raise exception 'A região não é adjacente à posição atual' using errcode = '22023';
  end if;

  select id into first_area
  from public.region_areas
  where region_id = target_region_id and enabled
  order by sort_order
  limit 1;

  update public.player_world_state
  set current_region_id = target_region_id,
      current_area_id = first_area,
      visited_area_ids = case
        when first_area is null or first_area = any(visited_area_ids) then visited_area_ids
        else array_append(visited_area_ids, first_area)
      end
  where user_id = player_id
  returning visited_area_ids into visited;

  insert into public.exploration_progress (user_id, region_id, last_visited_at)
  values (player_id, target_region_id, now())
  on conflict (user_id, region_id) do update
  set last_visited_at = excluded.last_visited_at;

  return jsonb_build_object(
    'currentRegionId', target_region_id,
    'currentAreaId', first_area,
    'visitedAreaIds', to_jsonb(visited)
  );
end;
$$;
revoke all on function private.travel_to_region(text) from public, anon;
grant execute on function private.travel_to_region(text) to authenticated, service_role;
create or replace function private.visit_region_area(target_region_id text, target_area_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  current_region text;
  visited text[];
  area_order smallint;
  previous_area text;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  select current_region_id, visited_area_ids
  into current_region, visited
  from public.player_world_state
  where user_id = player_id
  for update;

  if current_region is null then
    raise exception 'Estado de mundo não encontrado' using errcode = 'P0002';
  end if;
  if current_region <> target_region_id then
    raise exception 'Viaje até a região antes de entrar nesta área' using errcode = '22023';
  end if;

  select sort_order into area_order
  from public.region_areas
  where id = target_area_id and region_id = target_region_id and enabled;
  if area_order is null then
    raise exception 'Área indisponível' using errcode = 'P0002';
  end if;

  if area_order > 1 then
    select id into previous_area
    from public.region_areas
    where region_id = target_region_id and sort_order = area_order - 1 and enabled;
    if previous_area is null or not (previous_area = any(visited)) then
      raise exception 'Explore a área anterior primeiro' using errcode = '22023';
    end if;
  end if;

  update public.player_world_state
  set current_area_id = target_area_id,
      visited_area_ids = case
        when target_area_id = any(visited_area_ids) then visited_area_ids
        else array_append(visited_area_ids, target_area_id)
      end
  where user_id = player_id
  returning visited_area_ids into visited;

  insert into public.exploration_progress (user_id, region_id, last_visited_at)
  values (player_id, target_region_id, now())
  on conflict (user_id, region_id) do update
  set last_visited_at = excluded.last_visited_at;

  return jsonb_build_object(
    'currentAreaId', target_area_id,
    'visitedAreaIds', to_jsonb(visited)
  );
end;
$$;
revoke all on function private.visit_region_area(text, text) from public, anon;
grant execute on function private.visit_region_area(text, text) to authenticated, service_role;
create or replace function public.visit_region_area(target_region_id text, target_area_id text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.visit_region_area(target_region_id, target_area_id); $$;
revoke all on function public.visit_region_area(text, text) from public, anon;
grant execute on function public.visit_region_area(text, text) to authenticated, service_role;
create or replace function private.buy_energy_pack(target_element public.card_element, target_quantity integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  price bigint;
  current_coins bigint;
  energy jsonb;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;
  price := case target_quantity when 1 then 18 when 5 then 75 else null end;
  if price is null then
    raise exception 'Pacote de energia inválido' using errcode = '22023';
  end if;

  select coins into current_coins
  from public.profiles
  where id = player_id
  for update;
  if current_coins is null then
    raise exception 'Perfil não encontrado' using errcode = 'P0002';
  end if;
  if current_coins < price then
    raise exception 'Moedas insuficientes' using errcode = '22023';
  end if;

  update public.profiles
  set coins = coins - price
  where id = player_id
  returning coins into current_coins;

  insert into public.player_energy_inventory (user_id, element, quantity)
  values (player_id, target_element, target_quantity)
  on conflict (user_id, element) do update
  set quantity = public.player_energy_inventory.quantity + excluded.quantity,
      updated_at = now();

  select jsonb_object_agg(inventory.element::text, inventory.quantity)
  into energy
  from public.player_energy_inventory inventory
  where inventory.user_id = player_id;

  return jsonb_build_object('coins', current_coins, 'energy', coalesce(energy, '{}'::jsonb));
end;
$$;
revoke all on function private.buy_energy_pack(public.card_element, integer) from public, anon;
grant execute on function private.buy_energy_pack(public.card_element, integer) to authenticated, service_role;
create or replace function public.buy_energy_pack(target_element public.card_element, target_quantity integer)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.buy_energy_pack(target_element, target_quantity); $$;
revoke all on function public.buy_energy_pack(public.card_element, integer) from public, anon;
grant execute on function public.buy_energy_pack(public.card_element, integer) to authenticated, service_role;
create or replace function private.save_avatar_config(target_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;
  if jsonb_typeof(target_config) <> 'object'
    or (select count(*) from jsonb_object_keys(target_config)) <> 5
    or not coalesce(target_config ->> 'skin' = any(array['amber','copper','umber','rose']), false)
    or not coalesce(target_config ->> 'hair' = any(array['braids','short','waves','mohawk']), false)
    or not coalesce(target_config ->> 'outfit' = any(array['traveler','scholar','ranger','merchant']), false)
    or not coalesce(target_config ->> 'armor' = any(array['none','leather','runic','guardian']), false)
    or not coalesce(target_config ->> 'accent' = any(array['gold','emerald','azure','crimson']), false)
  then
    raise exception 'Configuração de personagem inválida' using errcode = '22023';
  end if;
  if target_config ->> 'armor' in ('runic','guardian') and not exists (
    select 1
    from public.inventory_items
    where user_id = player_id
      and item_key = (target_config ->> 'armor') || '-armor'
      and quantity > 0
  ) then
    raise exception 'Esta armadura ainda não foi encontrada' using errcode = '22023';
  end if;

  update public.profiles set avatar_config = target_config where id = player_id;
  if not found then
    raise exception 'Perfil não encontrado' using errcode = 'P0002';
  end if;
  return target_config;
end;
$$;
revoke all on function private.save_avatar_config(jsonb) from public, anon;
grant execute on function private.save_avatar_config(jsonb) to authenticated, service_role;
create or replace function public.save_avatar_config(target_config jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.save_avatar_config(target_config); $$;
revoke all on function public.save_avatar_config(jsonb) from public, anon;
grant execute on function public.save_avatar_config(jsonb) to authenticated, service_role;
with catalog (
  id, name, title, element, rarity, region_id, role, hp, defense, speed,
  description, tradition, origin, traits, moves, obtainable_by, art_slot
) as (
  values
    ('matinta-pereira','Matinta Pereira','Assobio da Noite Amazônica','spirit','rare','roots','controller',118,48,82,'Figura encantada anunciada por um assobio agudo durante a noite.','Folclore amazônico','Amazônia, Brasil',array['metamorfa','assobio','noturna'],array['Assobio Distante','Promessa da Noite','Voo da Matinta'],'Clareira dos Sussurros',25),
    ('cobra-grande','Cobra Grande','Serpente dos Rios Profundos','water','epic','roots','guardian',198,84,34,'Serpente colossal associada aos rios e às transformações da paisagem amazônica.','Folclore amazônico','Amazônia, Brasil',array['serpente','fluvial','colossal'],array['Cauda de Corrente','Olhos da Boiúna','Rio sem Margem'],'Coração das Raízes',26),
    ('anhanga','Anhangá','Protetor de Olhos de Fogo','nature','legendary','roots','support',174,80,76,'Presença protetora da mata frequentemente descrita em forma de veado branco.','Tradições indígenas brasileiras','Brasil',array['cervo','guardião','luminoso'],array['Passo Branco','Olhar Protetor','Pacto de Anhangá'],'Ruínas da Guardiã',27),
    ('comadre-fulozinha','Comadre Fulozinha','Guardiã dos Cabelos Longos','nature','rare','roots','skirmisher',124,52,90,'Encantada da mata nordestina que protege animais e desorienta invasores.','Folclore do Nordeste brasileiro','Nordeste do Brasil',array['encantada','guardiã','assobio'],array['Trança da Mata','Assobio Cruzado','Caminho de Fulozinha'],'Trilha Invertida',28),
    ('uirapuru-encantado','Uirapuru Encantado','Canto que Silencia a Floresta','storm','uncommon','roots','support',96,36,102,'Ave de canto extraordinário cercada por narrativas de encanto e transformação.','Narrativas amazônicas','Amazônia, Brasil',array['ave','canto','encantado'],array['Canto Raro','Pausa da Mata','Voo Encantado'],'Portal da Mata',29),
    ('umibozu','Umibōzu','Sombra sobre o Mar','water','epic','archipelago','guardian',206,86,24,'Aparição marítima gigantesca que surge em águas calmas ou tempestades.','Folclore marítimo japonês','Japão',array['marítimo','gigante','aparição'],array['Onda Silenciosa','Pedido do Barril','Noite sobre o Mar'],'Abismo dos Espíritos',30),
    ('ningyo','Ningyo','Oráculo das Correntes','water','rare','archipelago','support',120,52,78,'Ser aquático japonês de aparência variável, frequentemente ligado a presságios.','Folclore japonês','Japão',array['aquático','oráculo','presságio'],array['Escama Oracular','Voz da Corrente','Maré do Presságio'],'Templo das Marés',31),
    ('selkie','Selkie','Viajante da Pele de Foca','spirit','rare','archipelago','skirmisher',126,48,88,'Ser capaz de deixar a pele de foca para assumir forma humana em terra.','Folclores do Atlântico Norte','Escócia, Orkney e Shetland',array['foca','metamorfa','marítima'],array['Pele Guardada','Passo na Praia','Retorno às Ondas'],'Ilhas das Promessas',32),
    ('bake-kujira','Bake-kujira','Esqueleto da Baleia Fantasma','spirit','legendary','archipelago','controller',188,72,40,'Esqueleto espectral de baleia acompanhado por aves e peixes incomuns.','Folclore japonês','Shimane, Japão',array['baleia','esquelético','fantasma'],array['Canto Oco','Cortejo do Mar','Maré Fantasma'],'Recife Ancestral',33),
    ('nokk','Nøkk','Cavalo das Águas Escuras','water','epic','archipelago','controller',148,62,84,'Espírito aquático metamórfico que pode surgir como cavalo junto a rios e lagos.','Folclores escandinavos','Escandinávia',array['equino','metamorfo','lacustre'],array['Galope Submerso','Canção da Margem','Forma do Nøkk'],'Cais Cartógrafo',34),
    ('thunderbird','Pássaro do Trovão','Asas que Chamam a Tempestade','storm','mythic','runic','striker',190,70,90,'Grande ser aviário associado ao trovão em tradições indígenas norte-americanas.','Tradições indígenas norte-americanas','América do Norte',array['ave','trovão','celeste'],array['Bater do Trovão','Olhar de Relâmpago','Tempestade Celeste'],'Pico do Trovão',35),
    ('alicanto','Alicanto','Ave dos Veios Minerais','spirit','rare','runic','support',110,46,92,'Ave noturna chilena cujas penas brilham conforme o minério de que se alimenta.','Folclore mineiro chileno','Chile',array['ave','minério','luminoso'],array['Pena Metálica','Rastro de Prata','Veio do Alicanto'],'Mina do Carbunclo',36),
    ('fenghuang','Fenghuang','Ave da Harmonia Imperial','fire','legendary','runic','support',168,66,82,'Ave auspiciosa chinesa associada à harmonia, virtude e renovação da ordem.','Mitologia e iconografia chinesa','China',array['ave','auspicioso','harmonia'],array['Pluma das Virtudes','Dança dos Ventos','Harmonia do Fenghuang'],'Santuário do Céu',37),
    ('yeti','Yeti','Habitante das Alturas Nevadas','nature','epic','runic','guardian',210,90,30,'Ser misterioso associado às montanhas e neves do Himalaia.','Narrativas himalaias','Região do Himalaia',array['montanha','peludo','neve'],array['Punho da Geleira','Passo na Neve','Eco do Himalaia'],'Passagem Glacial',38),
    ('ratatoskr','Ratatoskr','Mensageiro da Árvore do Mundo','nature','uncommon','runic','skirmisher',92,32,108,'Esquilo que corre por Yggdrasil levando palavras entre seres rivais.','Mitologia nórdica registrada nas Eddas','Escandinávia medieval',array['esquilo','mensageiro','ágil'],array['Recado Afiado','Corrida no Tronco','Rumor de Yggdrasil'],'Ponte Rúnica',39),
    ('kikimora','Kikimora','Presença Atrás do Fogão','spirit','uncommon','mist','controller',98,52,70,'Espírito doméstico eslavo associado a ruídos, fiação e presságios.','Folclores eslavos','Europa Oriental',array['doméstico','fiandeira','presságio'],array['Fio Embaraçado','Ruído na Parede','Presságio da Kikimora'],'Casa da Névoa',40),
    ('rusalka','Rusalka','Espírito das Águas Verdes','water','rare','mist','controller',116,46,78,'Figura sobrenatural ligada a rios, lagos e vegetação nos folclores eslavos.','Folclores eslavos','Europa Oriental',array['água doce','vegetação','aparição'],array['Cabelo de Junco','Canto do Lago','Dança da Rusalka'],'Charco dos Ecos',41),
    ('puca','Púca','Metamorfo dos Caminhos','spirit','epic','mist','skirmisher',142,54,96,'Ser irlandês que assume formas animais e leva viajantes por rotas imprevisíveis.','Folclore irlandês','Irlanda',array['metamorfo','equino','travesso'],array['Salto do Caminho','Forma Imprevista','Corrida do Púca'],'Bosque Móvel',42),
    ('dullahan','Dullahan','Cavaleiro sem Cabeça','spirit','legendary','mist','striker',178,70,86,'Cavaleiro sobrenatural irlandês que carrega a própria cabeça.','Folclore irlandês','Irlanda',array['cavaleiro','sem cabeça','presságio'],array['Rédea Sombria','Nome Derradeiro','Cavalgada do Dullahan'],'Vila Afundada',43),
    ('fogo-fatuo','Fogo-fátuo','Luz que Desvia Viajantes','fire','common','mist','skirmisher',82,28,112,'Luz errante vista sobre pântanos e caminhos.','Narrativas de luzes errantes','Múltiplas regiões',array['luz','errante','pântano'],array['Faísca Errante','Desvio da Trilha','Brilho do Brejo'],'Margem Enevoada',44),
    ('ammit','Ammit','Devoradora dos Corações','nature','legendary','desert','guardian',218,92,32,'Ser funerário egípcio com partes de crocodilo, leão e hipopótamo.','Religião e mitologia do Egito Antigo','Egito Antigo',array['composto','julgamento','funerário'],array['Mandíbula do Julgamento','Peso do Coração','Sentença de Ammit'],'Tumba dos Reis',45),
    ('manticora','Manticora','Predadora dos Relatos Persas','fire','epic','desert','striker',166,62,80,'Criatura de corpo leonino, rosto humano e cauda perigosa.','Relatos antigos e bestiários medievais','Pérsia em fontes gregas',array['leonino','cauda','bestiário'],array['Cauda de Espinhos','Salto Leonino','Rugido da Manticora'],'Ossário Colossal',46),
    ('esfinge','Esfinge','Guardiã dos Limiares Sagrados','spirit','legendary','desert','controller',186,84,48,'Ser leonino de cabeça humana associado à proteção monumental egípcia.','Iconografia do Egito Antigo','Egito Antigo',array['leonino','guardião','monumental'],array['Vigília de Pedra','Palavra Régia','Limiar da Esfinge'],'Ruínas do Sol',47),
    ('roc','Roc','Ave que Oculta o Sol','storm','mythic','desert','guardian',224,78,68,'Ave gigantesca das narrativas de viagem árabes e persas.','Literatura árabe e persa','Oriente Médio',array['ave','colossal','viajante'],array['Garra do Roc','Sombra do Sol','Voo do Horizonte'],'Portão de Areia',48),
    ('ifrit','Ifrit','Espírito de Fogo Rebelde','fire','epic','desert','striker',156,58,84,'Classe poderosa de jinn associada ao fogo e a forças extraordinárias.','Tradições islâmicas e folclores árabes','Oriente Médio',array['jinn','fogo','poderoso'],array['Punho de Brasa','Vento do Ifrit','Coluna de Fogo'],'Oásis Oculto',49)
), prepared as (
  select c.*, jsonb_build_array(
    jsonb_build_object('id',c.id || '-1','name',c.moves[1],'cost',jsonb_build_object(c.element,1),'damage',22,'minRoll',2),
    jsonb_build_object('id',c.id || '-2','name',c.moves[2],'cost',jsonb_build_object(c.element,2),'damage',48,'minRoll',3),
    jsonb_build_object('id',c.id || '-3','name',c.moves[3],'cost',jsonb_build_object(c.element,3),'damage',82,'minRoll',4)
  ) attacks
  from catalog c
)
insert into public.creature_catalog (
  id,name,title,element,rarity,region_id,role,hp,defense,speed,
  description,lore,folklore_inspiration,folklore_tradition,folklore_origin,
  folklore_source_note,adaptation_note,traits,attacks,obtainable_by,
  art_slot,sprite_key,event_exclusive,enabled
)
select
  id,name,title,element::public.card_element,rarity::public.card_rarity,region_id,role,hp,defense,speed,
  description,description,tradition || ' — ' || origin,tradition,origin,
  'A iconografia e os detalhes variam entre fontes e comunidades.',
  'Adaptação 2D original para Card Realms, sem copiar símbolos cerimoniais.',
  traits,attacks,obtainable_by,art_slot,id,false,true
from prepared
on conflict (id) do update set
  name=excluded.name,title=excluded.title,element=excluded.element,rarity=excluded.rarity,
  region_id=excluded.region_id,role=excluded.role,hp=excluded.hp,defense=excluded.defense,
  speed=excluded.speed,description=excluded.description,lore=excluded.lore,
  folklore_inspiration=excluded.folklore_inspiration,
  folklore_tradition=excluded.folklore_tradition,folklore_origin=excluded.folklore_origin,
  folklore_source_note=excluded.folklore_source_note,adaptation_note=excluded.adaptation_note,
  traits=excluded.traits,attacks=excluded.attacks,obtainable_by=excluded.obtainable_by,
  art_slot=excluded.art_slot,sprite_key=excluded.sprite_key,event_exclusive=false,enabled=true;
create or replace function private.claim_region_treasure(target_region_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  current_region text;
  opened text[];
  current_coins bigint;
  equipment_key text;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;
  select current_region_id, opened_treasures into current_region, opened
  from public.player_world_state where user_id = player_id for update;
  if current_region <> target_region_id then
    raise exception 'Viaje até a região antes de recolher o tesouro' using errcode = '22023';
  end if;
  if target_region_id = any(opened) then
    raise exception 'Tesouro já recolhido' using errcode = '23505';
  end if;

  equipment_key := case target_region_id
    when 'roots' then 'guardian-armor'
    when 'runic' then 'runic-armor'
    else null
  end;

  insert into public.reward_ledger (user_id, source_type, source_id, reward)
  values (player_id,'region_treasure',target_region_id,
    jsonb_build_object('coins',45,'item','bond-fragment','quantity',1,'itemKey',equipment_key));
  update public.player_world_state
  set opened_treasures = array_append(opened_treasures,target_region_id)
  where user_id = player_id;
  insert into public.exploration_progress (user_id,region_id,treasures_found,last_visited_at)
  values (player_id,target_region_id,1,now())
  on conflict (user_id,region_id) do update
  set treasures_found = public.exploration_progress.treasures_found + 1,
      last_visited_at = excluded.last_visited_at;
  insert into public.inventory_items (user_id,item_key,quantity)
  values (player_id,'bond-fragment',1)
  on conflict (user_id,item_key) do update
  set quantity = public.inventory_items.quantity + 1;
  if equipment_key is not null then
    insert into public.inventory_items (user_id,item_key,quantity,metadata)
    values (player_id,equipment_key,1,'{"kind":"avatar-armor","source":"region-treasure"}'::jsonb)
    on conflict (user_id,item_key) do update set quantity = greatest(public.inventory_items.quantity,1);
  end if;
  update public.profiles set coins = coins + 45 where id = player_id returning coins into current_coins;
  return jsonb_build_object(
    'coins',current_coins,
    'openedTreasures',to_jsonb(array_append(opened,target_region_id)),
    'itemKey',equipment_key
  );
end;
$$;
revoke all on function private.claim_region_treasure(text) from public, anon;
grant execute on function private.claim_region_treasure(text) to authenticated, service_role;
