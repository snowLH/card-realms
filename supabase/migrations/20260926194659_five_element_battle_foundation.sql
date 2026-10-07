-- Align the persistent catalog and battle boundary with the v2 game domain.
-- The application remains server-authoritative; clients may read battle rows but
-- cannot write actions or state directly.

-- Replace the prototype's seven-category enum with the five-element ruleset.
alter type public.card_element rename to card_element_legacy;
create type public.card_element as enum (
  'fire', 'water', 'nature', 'storm', 'spirit'
);
alter table public.creature_catalog
  alter column element type public.card_element
  using (
    case element::text
      when 'electric' then 'storm'
      when 'ice' then 'water'
      when 'shadow' then 'spirit'
      when 'neutral' then 'spirit'
      else element::text
    end
  )::public.card_element;
drop type public.card_element_legacy;
grant usage on type public.card_element to anon, authenticated;
-- Folklore provenance is first-class data rather than one unstructured label.
alter table public.creature_catalog
  add column folklore_tradition text not null default '',
  add column folklore_origin text not null default '',
  add column folklore_source_note text not null default '',
  add column adaptation_note text not null default '',
  add column sprite_key text,
  add column event_exclusive boolean not null default false;
update public.creature_catalog
set folklore_tradition = folklore_inspiration,
    folklore_origin = 'Protótipo legado',
    folklore_source_note = 'Entrada anterior à auditoria de proveniência.',
    adaptation_note = 'Mantida desabilitada apenas para preservar referências de saves existentes.',
    sprite_key = id,
    enabled = false;
alter table public.creature_catalog
  alter column sprite_key set not null,
  add constraint creature_catalog_sprite_key_unique unique (sprite_key),
  drop constraint creature_catalog_art_slot_check,
  add constraint creature_catalog_art_slot_check check (art_slot between 0 and 4095);
-- The API accepts energy attachment from a real card in hand; free energy
-- acquisition was a prototype-only action and is deliberately removed.
alter table public.battle_actions
  drop constraint battle_actions_action_type_check,
  add constraint battle_actions_action_type_check
    check (action_type in ('attach_energy', 'switch', 'attack', 'pass', 'surrender'));
update public.missions
set title = 'Laços dos cinco caminhos',
    description = 'Use criaturas dos cinco elementos em batalha.',
    objective = '{"type":"elements_used","count":5}'::jsonb
where id = 'weekly-bonds';
with catalog (
  id, name, title, element, rarity, region_id, role, hp, defense, speed,
  description, tradition, origin, source_note, adaptation, traits, moves,
  obtainable_by, art_slot, event_exclusive
) as (
  values
    ('boitata', 'Boitatá', 'Serpente de Fogo da Mata', 'fire', 'rare', 'roots', 'striker', 124, 44, 72,
      'Serpente luminosa que vigia campos e florestas contra quem os destrói.',
      'Folclore brasileiro de matriz tupi', 'Brasil',
      'Registrado desde o período colonial, com variações regionais sobre uma serpente ou fogo vivo protetor.',
      'Mantém a forma serpentina, o brilho ígneo e o papel de guardião da natureza.',
      array['serpente','guardião','luminoso'], array['Olhar de Brasa','Rastro Incandescente','Círculo do Boitatá'],
      'Provação do fogo guardião na Floresta das Raízes Antigas', 0, false),
    ('mula-sem-cabeca', 'Mula-sem-cabeça', 'Galope da Noite em Chamas', 'fire', 'epic', 'mist', 'skirmisher', 132, 46, 90,
      'Mula encantada que atravessa a noite com fogo irrompendo do pescoço.',
      'Folclore brasileiro', 'Brasil',
      'Narrativa difundida em várias regiões, com versões diferentes para a origem e a quebra do encanto.',
      'Evita fixar uma única causa moral da maldição e preserva a forma, o galope e as chamas.',
      array['encantado','galope','noturno'], array['Coice de Faísca','Galope Maldito','Clarão sem Cabeça'],
      'Encontro noturno nas estradas do Pântano da Névoa', 1, false),
    ('salamandra', 'Salamandra', 'Habitante das Chamas', 'fire', 'uncommon', 'desert', 'support', 104, 56, 54,
      'Ser associado ao fogo em bestiários medievais e na tradição alquímica europeia.',
      'Bestiários e alquimia europeia', 'Europa medieval e moderna',
      'A salamandra tornou-se emblema do elemento fogo em textos naturalistas e ocultistas.',
      'Usa a forma anfíbia tradicional, sem transformá-la em um dragão genérico.',
      array['anfíbio','alquímico','resistente'], array['Passo na Brasa','Selo Alquímico','Forno da Salamandra'],
      'Oficinas abandonadas do Deserto dos Reis Esquecidos', 2, false),
    ('fenix', 'Fênix', 'Ave do Retorno Solar', 'fire', 'legendary', 'desert', 'support', 166, 58, 84,
      'Ave extraordinária que encerra e reinicia o próprio ciclo de vida pelo fogo.',
      'Mitologia greco-romana', 'Mediterrâneo antigo',
      'Autores clássicos narraram uma ave única e longeva ligada ao Sol.',
      'Preserva a ave solar, a longevidade e o renascimento sem anatomia monstruosa.',
      array['ave','solar','renascimento'], array['Pena Solar','Voo das Cinzas','Ciclo da Fênix'],
      'Santuário solar do deserto', 3, false),
    ('aitvaras', 'Aitvaras', 'Espírito do Rastro Flamejante', 'fire', 'rare', 'mist', 'controller', 112, 40, 82,
      'Espírito doméstico lituano que pode aparecer como ave ou ser voador de cauda ardente.',
      'Folclore lituano', 'Lituânia',
      'Relatos variam entre formas de galo, serpente e criatura aérea de cauda ígnea.',
      'Combina a forma de ave e o rastro de fogo sem apagar sua natureza doméstica ambígua.',
      array['doméstico','aéreo','ambíguo'], array['Rastro Rubro','Presente Tomado','Telhado em Chamas'],
      'Telhados antigos do Pântano da Névoa', 4, false),

    ('iara', 'Iara', 'Senhora do Canto das Águas', 'water', 'epic', 'archipelago', 'controller', 120, 48, 70,
      'Encantada dos rios amazônicos cuja voz atrai quem se aproxima de suas margens.',
      'Folclore amazônico brasileiro', 'Amazônia, Brasil',
      'A narrativa mudou ao longo do tempo e reúne camadas indígenas e europeias.',
      'Preserva o canto, o rio e a agência da encantada, sem reduzi-la a monstro aquático.',
      array['encantada','canto','rio'], array['Voz da Margem','Espelho do Rio','Canto da Iara'],
      'Encontro ritual nas águas calmas do arquipélago', 5, false),
    ('boto-cor-de-rosa', 'Boto-cor-de-rosa', 'Encantado das Festas Ribeirinhas', 'water', 'rare', 'archipelago', 'skirmisher', 110, 42, 86,
      'Boto amazônico que assume forma humana para visitar festas à margem do rio.',
      'Folclore amazônico brasileiro', 'Amazônia, Brasil',
      'Costuma aparecer vestido de branco e retornar às águas antes do amanhecer.',
      'A batalha usa sua forma de boto e sua transformação como ilusão.',
      array['encantado','transformação','rio'], array['Salto Rosado','Chapéu Branco','Retorno ao Rio'],
      'Festividades ribeirinhas do Arquipélago dos Espíritos', 6, false),
    ('kelpie', 'Kelpie', 'Cavalo das Águas Profundas', 'water', 'rare', 'deep-sea', 'striker', 136, 54, 78,
      'Espírito aquático escocês que assume a forma de cavalo junto a rios e lagos.',
      'Folclore escocês', 'Escócia',
      'Pertence a um conjunto amplo de tradições célticas sobre cavalos d''água.',
      'Mantém forma equina, crina molhada e comportamento traiçoeiro.',
      array['equino','metamorfo','lago'], array['Casco de Lago','Rédea Encharcada','Mergulho do Kelpie'],
      'Lagos escuros do Mar das Profundezas', 7, false),
    ('kappa', 'Kappa', 'Habitante dos Rios Japoneses', 'water', 'uncommon', 'archipelago', 'guardian', 146, 78, 38,
      'Yōkai anfíbio reconhecido pela carapaça, pelo bico e pelo prato de água sobre a cabeça.',
      'Folclore japonês', 'Japão',
      'Há muitas descrições regionais ligadas a rios, lagos e advertências sobre a água.',
      'Preserva carapaça, prato d''água, pepino e regras de cortesia.',
      array['yōkai','anfíbio','etiqueta'], array['Bico de Rio','Prato Cheio','Desafio do Kappa'],
      'Margens protegidas por oferendas de pepino', 8, false),
    ('ahuizotl', 'Ahuízotl', 'Caçador das Águas Mexicas', 'water', 'epic', 'deep-sea', 'controller', 138, 58, 74,
      'Ser aquático de aspecto canino ou mustelídeo, com uma mão na extremidade da cauda.',
      'Tradição mexica registrada no período colonial', 'Vale do México',
      'É descrito em fontes como o Códice Florentino, com variações de interpretação.',
      'Mantém corpo aquático e mão caudal; não o converte em lontra comum.',
      array['aquático','mão caudal','caçador'], array['Garra da Cauda','Chamado da Margem','Poço do Ahuízotl'],
      'Ruínas lacustres do Mar das Profundezas', 9, false),

    ('curupira', 'Curupira', 'Guardião dos Pés Virados', 'nature', 'rare', 'roots', 'controller', 126, 58, 88,
      'Guardião da mata de cabelos vermelhos e pés voltados para trás.',
      'Folclore brasileiro de matriz indígena', 'Brasil',
      'É uma das figuras florestais mais antigas registradas no Brasil, com muitas variações.',
      'Preserva cabelos vermelhos, pés invertidos e a proteção dos animais.',
      array['guardião','pés invertidos','floresta'], array['Rastro Invertido','Assobio da Mata','Labirinto do Curupira'],
      'Trilha de rastros invertidos na Floresta das Raízes Antigas', 10, false),
    ('caipora', 'Caipora', 'Protetora dos Animais da Mata', 'nature', 'rare', 'roots', 'support', 132, 64, 76,
      'Entidade guardiã que confunde caçadores e protege os animais silvestres.',
      'Folclore brasileiro de matriz indígena', 'Brasil',
      'A aparência varia regionalmente e pode incluir montaria em porco-do-mato.',
      'Usa uma representação regional de guardiã montada e reconhece outras formas.',
      array['guardião','animais','assobio'], array['Chamado da Queixada','Fumo de Trégua','Pacto da Caipora'],
      'Missão de proteção da fauna nas Raízes Antigas', 11, false),
    ('mapinguari', 'Mapinguari', 'Gigante das Matas Distantes', 'nature', 'epic', 'roots', 'guardian', 204, 88, 24,
      'Ser enorme e coberto de pelos que habita áreas profundas da floresta amazônica.',
      'Folclore amazônico', 'Amazônia, Brasil',
      'Força, cheiro marcante e anatomias incomuns variam entre versões da tradição oral.',
      'Assume uma forma bípede robusta sem declarar traços controversos como universais.',
      array['gigante','floresta','resistente'], array['Passo Pesado','Rugido da Mata','Investida do Mapinguari'],
      'Chefe selvagem das trilhas mais profundas', 12, false),
    ('leshy', 'Leshy', 'Senhor Mutável da Floresta', 'nature', 'epic', 'mist', 'controller', 154, 74, 52,
      'Espírito eslavo da floresta capaz de alterar tamanho e imitar vozes.',
      'Folclores eslavos', 'Europa Oriental e regiões eslavas',
      'Nome, temperamento e aparência variam entre tradições locais.',
      'Preserva mudança de tamanho, sinais vegetais e soberania sobre a mata.',
      array['espírito','metamorfo','floresta'], array['Voz Imitada','Passo sem Trilha','Estatura do Leshy'],
      'Bosques móveis do Pântano da Névoa', 13, false),
    ('amarok', 'Amarok', 'Lobo Solitário da Noite', 'nature', 'legendary', 'runic', 'striker', 184, 72, 80,
      'Lobo gigantesco da tradição inuíte que caça sozinho.',
      'Tradições inuítes', 'Regiões árticas da América do Norte',
      'A grafia e os relatos variam entre línguas e comunidades inuítes.',
      'Mantém o lobo gigantesco e solitário, sem misturá-lo a lobisomens europeus.',
      array['lobo','ártico','solitário'], array['Mordida Solitária','Caçada Polar','Uivo do Amarok'],
      'Caçada ritual nas Montanhas Rúnicas', 14, false),

    ('saci-perere', 'Saci-Pererê', 'Travesso do Redemoinho', 'storm', 'rare', 'roots', 'skirmisher', 104, 34, 98,
      'Figura de uma perna só e gorro vermelho que viaja em redemoinhos e prega peças.',
      'Folclore brasileiro', 'Brasil',
      'A figura reúne influências indígenas, africanas e europeias e mudou entre registros.',
      'Preserva uma perna, gorro vermelho e domínio do redemoinho.',
      array['travesso','redemoinho','gorro'], array['Pulo de Vento','Nó na Crina','Redemoinho do Saci'],
      'Encontro com um redemoinho nas trilhas das Raízes', 15, false),
    ('raiju', 'Raijū', 'Besta do Trovão', 'storm', 'rare', 'runic', 'striker', 116, 42, 94,
      'Yōkai associado ao relâmpago, descrito em formas animais como lobo, cão ou felino.',
      'Folclore japonês', 'Japão',
      'A forma não é fixa e varia entre compilações e regiões.',
      'Usa uma forma canina feita de nuvens e eletricidade.',
      array['yōkai','relâmpago','canino'], array['Pata de Raio','Salto entre Nuvens','Rugido do Raijū'],
      'Picos atingidos por relâmpagos nas Montanhas Rúnicas', 16, false),
    ('tengu', 'Tengu', 'Habitante dos Ventos da Montanha', 'storm', 'epic', 'archipelago', 'controller', 134, 56, 88,
      'Ser sobrenatural japonês de montanha, ligado a aves, ventos e artes marciais.',
      'Folclore e tradição religiosa japonesa', 'Japão',
      'Tengu variam de espíritos perigosos a protetores e mestres.',
      'Usa a forma alada antiga e evita reduzi-lo a uma caricatura.',
      array['montanha','ave','marcial'], array['Leque de Rajada','Passo da Montanha','Vendaval do Tengu'],
      'Templos elevados do Arquipélago dos Espíritos', 17, false),
    ('ziz', 'Ziz', 'Ave Imensa dos Céus', 'storm', 'mythic', 'desert', 'guardian', 212, 82, 62,
      'Ave colossal da tradição judaica cuja envergadura alcança os limites do céu.',
      'Mitologia e literatura rabínica judaica', 'Oriente Médio',
      'Textos a colocam entre os grandes seres da criação, ao lado de Behemoth e Leviatã.',
      'Preserva a ave colossal e o papel celeste sem fundi-la com outras aves míticas.',
      array['ave','colossal','celeste'], array['Bater de Asas','Sombra do Horizonte','Céu de Ziz'],
      'Evento celeste sobre o Deserto dos Reis Esquecidos', 18, true),
    ('simurgh', 'Simurgh', 'Ave Sábia da Tradição Persa', 'storm', 'legendary', 'desert', 'support', 176, 70, 78,
      'Ave benevolente e antiquíssima associada à sabedoria, cura e proteção.',
      'Mitologia e literatura persa', 'Irã e mundo persófono',
      'A Simurgh atravessa períodos pré-islâmicos e obras como o Shahnameh.',
      'Preserva a grande ave sábia, as penas protetoras e o vínculo com cura.',
      array['ave','sabedoria','cura'], array['Pena Protetora','Voo sobre Alborz','Sabedoria da Simurgh'],
      'Santuário elevado além do deserto', 19, false),

    ('black-shuck', 'Black Shuck', 'Cão Negro de East Anglia', 'spirit', 'rare', 'eclipse', 'guardian', 152, 72, 68,
      'Cão espectral de pelagem negra e olhar em brasa que percorre estradas inglesas.',
      'Folclore inglês', 'East Anglia, Inglaterra',
      'O nome e o comportamento variam em narrativas locais de cães negros espectrais.',
      'Mantém porte canino, pelagem negra e ambiguidade entre ameaça e guarda.',
      array['canino','espectral','presságio'], array['Passo na Estrada','Olho em Brasa','Vigília de Black Shuck'],
      'Estradas costeiras do Reino do Eclipse', 20, false),
    ('domovoi', 'Domovoi', 'Espírito Guardião da Casa', 'spirit', 'uncommon', 'mist', 'support', 102, 60, 48,
      'Espírito doméstico eslavo que protege a família e o lar quando é respeitado.',
      'Folclores eslavos', 'Europa Oriental e regiões eslavas',
      'Aparência e costumes variam e se ligam à lareira, celeiro e ancestrais.',
      'Preserva pequena estatura, vínculo ancestral e papel doméstico.',
      array['doméstico','ancestral','guardião'], array['Ruído no Assoalho','Cuidado da Lareira','Aviso do Domovoi'],
      'Casas cuidadas no Pântano da Névoa', 21, false),
    ('qilin', 'Qilin', 'Presságio de Governo Justo', 'spirit', 'legendary', 'archipelago', 'support', 180, 80, 66,
      'Ser auspicioso chinês de corpo ungulado, associado à benevolência e a sábios.',
      'Mitologia chinesa', 'China',
      'Iconografia e descrições mudaram entre dinastias e regiões do Leste Asiático.',
      'Mantém cascos, escamas, chifres e temperamento benevolente; não é unicórnio.',
      array['auspicioso','ungulado','benevolente'], array['Passo sem Dano','Sopro Auspicioso','Chegada do Qilin'],
      'Provação de benevolência no arquipélago', 22, false),
    ('banshee', 'Banshee', 'Mensageira do Lamento', 'spirit', 'epic', 'eclipse', 'controller', 118, 44, 76,
      'Figura feminina sobrenatural irlandesa cujo lamento anuncia uma morte na família.',
      'Folclore irlandês', 'Irlanda',
      'O nome deriva de bean sí e os relatos se ligam a famílias e territórios.',
      'Transforma o lamento em controle sem apagar seu papel de mensageira.',
      array['feérico','lamento','presságio'], array['Sussurro do Sídhe','Véu do Presságio','Lamento da Banshee'],
      'Colinas silenciosas do Reino do Eclipse', 23, false),
    ('carbunclo', 'Carbunclo', 'Pequeno Portador de Luz', 'spirit', 'rare', 'runic', 'skirmisher', 108, 46, 92,
      'Animal esquivo de relatos sul-americanos, reconhecido por uma pedra preciosa luminosa.',
      'Folclores mineiros sul-americanos', 'Região andina e Cone Sul',
      'Carbunclo aparece em relatos com formas animais diferentes, ligado a brilho e tesouro.',
      'Usa um pequeno quadrúpede com gema luminosa e mantém a aparência variável.',
      array['luminoso','tesouro','esquivo'], array['Clarão da Gema','Rastro Precioso','Tesouro do Carbunclo'],
      'Minas antigas das Montanhas Rúnicas', 24, false)
), prepared as (
  select
    c.*,
    jsonb_build_array(
      jsonb_build_object(
        'id', c.id || '-1', 'name', c.moves[1],
        'cost', jsonb_build_object(c.element, 1),
        'damage', case c.element when 'nature' then 18 when 'spirit' then 19 when 'water' then 20 when 'storm' then 21 else 22 end,
        'minRoll', 2
      ),
      jsonb_build_object(
        'id', c.id || '-2', 'name', c.moves[2],
        'cost', jsonb_build_object(c.element, 2),
        'damage', case c.element when 'nature' then 43 when 'spirit' then 44 when 'water' then 45 when 'storm' then 48 else 50 end,
        'minRoll', case when c.element = 'nature' then 2 else 3 end
      ),
      jsonb_build_object(
        'id', c.id || '-3', 'name', c.moves[3],
        'cost', jsonb_build_object(c.element, 3),
        'damage', case c.element when 'water' then 74 when 'spirit' then 76 when 'nature' then 78 when 'storm' then 82 else 86 end,
        'minRoll', 4
      )
    ) as attacks
  from catalog c
)
insert into public.creature_catalog (
  id, name, title, element, rarity, region_id, role, hp, defense, speed,
  description, lore, folklore_inspiration, folklore_tradition, folklore_origin,
  folklore_source_note, adaptation_note, traits, attacks, obtainable_by,
  art_slot, sprite_key, event_exclusive, enabled
)
select
  id, name, title, element::public.card_element, rarity::public.card_rarity,
  region_id, role, hp, defense, speed, description, source_note,
  tradition || ' — ' || origin, tradition, origin, source_note, adaptation,
  traits, attacks, obtainable_by, art_slot, id, event_exclusive, true
from prepared
on conflict (id) do update set
  name = excluded.name,
  title = excluded.title,
  element = excluded.element,
  rarity = excluded.rarity,
  region_id = excluded.region_id,
  role = excluded.role,
  hp = excluded.hp,
  defense = excluded.defense,
  speed = excluded.speed,
  description = excluded.description,
  lore = excluded.lore,
  folklore_inspiration = excluded.folklore_inspiration,
  folklore_tradition = excluded.folklore_tradition,
  folklore_origin = excluded.folklore_origin,
  folklore_source_note = excluded.folklore_source_note,
  adaptation_note = excluded.adaptation_note,
  traits = excluded.traits,
  attacks = excluded.attacks,
  obtainable_by = excluded.obtainable_by,
  art_slot = excluded.art_slot,
  sprite_key = excluded.sprite_key,
  event_exclusive = excluded.event_exclusive,
  enabled = true;
-- Security-definer authorization helpers do not belong in an API-exposed schema.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;
drop policy "participants read battles" on public.battles;
drop policy "players create battles" on public.battles;
drop policy "creators update lobbies" on public.battles;
drop policy "participants read participants" on public.battle_participants;
drop policy "players join battles" on public.battle_participants;
drop policy "players update own participation" on public.battle_participants;
drop policy "participants read actions" on public.battle_actions;
drop policy "participants submit actions" on public.battle_actions;
drop policy "participants read battle events" on public.battle_events;
create or replace function private.is_battle_participant(target_battle_id uuid)
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
revoke all on function private.is_battle_participant(uuid) from public;
grant execute on function private.is_battle_participant(uuid) to authenticated, service_role;
create policy "participants read battles" on public.battles for select
using (private.is_battle_participant(id));
create policy "participants read participants" on public.battle_participants for select
using (private.is_battle_participant(battle_id));
create policy "participants read actions" on public.battle_actions for select
using (private.is_battle_participant(battle_id));
create policy "participants read battle events" on public.battle_events for select
using (private.is_battle_participant(battle_id));
-- Direct action inserts are intentionally not restored. The battle API validates
-- the encrypted state token, applies rules, rolls dice and advances the NPC.
revoke insert, update, delete on public.battles, public.battle_participants,
  public.battle_actions, public.battle_events from authenticated;
drop function public.is_battle_participant(uuid);
-- New accounts now receive a legal six-creature team from the real-folklore catalog.
drop trigger on_auth_user_created on auth.users;
create or replace function private.handle_new_user()
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
  insert into public.teams (user_id, is_active)
  values (new.id, true)
  returning id into new_team_id;

  for creature_row in
    select id from public.creature_catalog
    where id = any(array['boitata','iara','curupira','saci-perere','black-shuck','boto-cor-de-rosa'])
    order by array_position(
      array['boitata','iara','curupira','saci-perere','black-shuck','boto-cor-de-rosa'], id
    )
  loop
    slot_number := slot_number + 1;
    insert into public.player_creatures (user_id, creature_id, acquired_from)
    values (new.id, creature_row.id, 'starter')
    returning id into creature_instance_id;

    insert into public.team_members (team_id, slot, player_creature_id)
    values (new_team_id, slot_number, creature_instance_id);
  end loop;

  if slot_number <> 6 then
    raise exception 'O catálogo inicial precisa fornecer exatamente seis criaturas';
  end if;

  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
grant execute on function private.handle_new_user() to service_role;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();
drop function public.handle_new_user();
