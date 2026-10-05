import type { CombatRole, CreatureDefinition, Element, EvolutionLine, Rarity, SpriteDefinition } from "../types";
import type { CreatureSeed } from "./creature-seed";

export const REQUESTED_EVOLUTION_ATLAS = "/art/folklore-requested-evolution-atlas.svg";
export const REQUESTED_ATLAS_COLUMNS = 20;
export const REQUESTED_ATLAS_ROWS = 15;

type RequestedSpec = {
  id: string;
  name: string;
  tradition: string;
  origin: string;
  description: string;
  element: Element;
  rarity: Rarity;
  regionId: string;
  role: CombatRole;
};

const REQUESTED_ROWS = `
wendigo|Wendigo|Tradições algonquinas da América do Norte|América do Norte|Espírito associado à fome extrema e ao inverno.|spirit|mythic|eclipse|controller
curupira|Curupira|Folclore brasileiro|Brasil|Guardião das florestas com pés virados para trás.|nature|epic|roots|controller
saci-perere|Saci-Pererê|Folclore brasileiro|Brasil|Espírito travesso de uma perna só.|storm|rare|roots|skirmisher
boitata|Boitatá|Folclore brasileiro|Brasil|Serpente de fogo protetora das matas.|fire|epic|roots|guardian
mula-sem-cabeca|Mula-sem-cabeça|Folclore brasileiro|Brasil|Criatura amaldiçoada envolta em fogo.|fire|epic|mist|skirmisher
iara|Iara|Folclore brasileiro|Brasil|Entidade aquática que encanta pessoas com sua voz.|water|epic|archipelago|controller
cuca|Cuca|Folclore brasileiro|Brasil|Criatura monstruosa associada a histórias infantis.|spirit|epic|roots|controller
boto-cor-de-rosa|Boto-cor-de-rosa|Folclore amazônico brasileiro|Amazônia, Brasil|Boto que assume forma humana.|water|rare|archipelago|skirmisher
mapinguari|Mapinguari|Folclore amazônico|Amazônia, Brasil|Criatura gigantesca das florestas.|nature|epic|roots|guardian
corpo-seco|Corpo-Seco|Folclore brasileiro|Brasil|Morto amaldiçoado rejeitado pela própria terra.|spirit|rare|mist|guardian
lobisomem|Lobisomem|Tradições europeias e brasileiras|Europa e Brasil|Humano que se transforma em lobo.|nature|rare|mist|striker
vampiro|Vampiro|Folclore da Europa Oriental|Europa Oriental|Morto-vivo que se alimenta dos vivos.|spirit|epic|eclipse|controller
banshee|Banshee|Folclore irlandês|Irlanda|Espírito cujo lamento anuncia uma morte.|spirit|epic|eclipse|controller
leprechaun|Leprechaun|Folclore irlandês|Irlanda|Pequeno ser feérico ligado a tesouros.|nature|uncommon|mist|support
dullahan|Dullahan|Folclore irlandês|Irlanda|Cavaleiro sem cabeça.|spirit|legendary|mist|striker
kelpie|Kelpie|Folclore escocês|Escócia|Espírito aquático que assume forma de cavalo.|water|rare|deep-sea|striker
selkie|Selkie|Folclore escocês e irlandês|Escócia e Irlanda|Seres-foca capazes de assumir forma humana.|water|rare|archipelago|support
nuckelavee|Nuckelavee|Folclore das Ilhas Órcades|Ilhas Órcades|Criatura marinha monstruosa semelhante a um cavalo.|water|legendary|deep-sea|striker
redcap|Redcap|Folclore da fronteira anglo-escocesa|Grã-Bretanha|Goblin violento associado a ruínas.|fire|rare|mist|striker
black-shuck|Black Shuck|Folclore inglês|Inglaterra|Enorme cão negro sobrenatural.|spirit|epic|eclipse|guardian
grindylow|Grindylow|Folclore inglês|Inglaterra|Criatura aquática de lagos e pântanos.|water|uncommon|deep-sea|controller
jenny-greenteeth|Jenny Greenteeth|Folclore inglês|Inglaterra|Espírito aquático de aparência assustadora.|water|rare|deep-sea|controller
brownie|Brownie|Folclore escocês|Escócia|Espírito doméstico que ajuda moradores.|nature|uncommon|mist|support
puca|Púca|Folclore irlandês|Irlanda|Espírito metamórfico imprevisível.|spirit|rare|mist|skirmisher
each-uisge|Each-Uisge|Folclore escocês|Escócia|Cavalo aquático perigoso.|water|epic|deep-sea|striker
kraken|Kraken|Tradições escandinavas|Escandinávia|Enorme monstro marinho.|water|legendary|deep-sea|guardian
draugr|Draugr|Folclore escandinavo|Escandinávia|Morto-vivo que protege túmulos ou riquezas.|spirit|rare|runic|guardian
troll|Troll|Folclore escandinavo|Escandinávia|Criatura das montanhas e cavernas.|nature|uncommon|runic|guardian
huldra|Huldra|Folclore escandinavo|Escandinávia|Espírito feminino das florestas.|nature|rare|runic|controller
nokk|Nøkk|Folclore escandinavo|Escandinávia|Espírito aquático metamórfico.|water|rare|archipelago|controller
fossegrim|Fossegrim|Folclore norueguês|Noruega|Espírito das cachoeiras e da música.|water|rare|runic|support
mara|Mara|Tradições germânicas e escandinavas|Europa Setentrional|Espírito associado a pesadelos.|spirit|rare|eclipse|controller
lindworm|Lindworm|Folclore da Europa Central e Escandinávia|Europa Central e Escandinávia|Criatura semelhante a um dragão-serpente.|fire|epic|runic|striker
alp|Alp|Folclore alemão|Alemanha|Espírito associado a pesadelos e sufocamento durante o sono.|spirit|uncommon|eclipse|controller
kobold|Kobold|Folclore alemão|Alemanha|Espírito doméstico ou subterrâneo.|nature|uncommon|runic|support
nachzehrer|Nachzehrer|Folclore alemão|Alemanha|Morto-vivo associado a epidemias e túmulos.|spirit|rare|eclipse|guardian
wolpertinger|Wolpertinger|Folclore bávaro|Baviera, Alemanha|Criatura híbrida de vários animais.|nature|uncommon|runic|skirmisher
baba-yaga|Baba Yaga|Tradições eslavas|Europa Oriental|Feiticeira sobrenatural que vive numa cabana sobre pernas.|spirit|legendary|mist|controller
leshy|Leshy|Tradição eslava|Europa Oriental|Espírito guardião das florestas.|nature|epic|mist|guardian
rusalka|Rusalka|Tradição eslava|Europa Oriental|Espírito feminino ligado às águas.|water|epic|mist|controller
domovoi|Domovoi|Tradição eslava|Europa Oriental|Espírito protetor das casas.|spirit|uncommon|mist|support
vodyanoy|Vodyanoy|Tradição eslava|Europa Oriental|Espírito masculino de rios e lagos.|water|rare|archipelago|guardian
kikimora|Kikimora|Tradição eslava|Europa Oriental|Espírito doméstico.|spirit|rare|mist|controller
koschei|Koschei|Tradição eslava|Europa Oriental|Ser sobrenatural associado à imortalidade.|spirit|legendary|eclipse|controller
zmey-gorynych|Zmey Gorynych|Folclore russo|Rússia|Dragão de múltiplas cabeças.|fire|legendary|runic|striker
strzyga|Strzyga|Folclore polonês|Polônia|Criatura semelhante a um vampiro.|spirit|rare|eclipse|striker
lamia|Lamia|Mitologia grega|Grécia|Criatura feminina monstruosa associada a crianças.|spirit|epic|desert|controller
minotauro|Minotauro|Mitologia grega|Grécia|Criatura com corpo humano e cabeça de touro.|nature|epic|desert|guardian
medusa|Medusa|Mitologia grega|Grécia|Górgona cujo olhar petrifica.|spirit|legendary|desert|controller
quimera|Quimera|Mitologia grega|Grécia|Criatura formada por partes de diferentes animais.|fire|legendary|desert|striker
hidra-de-lerna|Hidra de Lerna|Mitologia grega|Grécia|Serpente monstruosa de várias cabeças.|water|epic|deep-sea|guardian
cerbero|Cerbero|Mitologia grega|Grécia|Cão de várias cabeças que guarda o mundo dos mortos.|fire|legendary|eclipse|guardian
harpia|Harpia|Mitologia grega|Grécia|Criatura com características de mulher e ave.|storm|rare|desert|skirmisher
ciclope|Ciclope|Mitologia grega|Grécia|Gigante de um único olho.|nature|epic|desert|guardian
empusa|Empusa|Mitologia grega|Grécia|Espírito monstruoso associado a Hécate.|spirit|rare|desert|controller
manticora|Manticora|Tradição persa|Pérsia|Criatura com corpo de leão e características humanas e monstruosas.|fire|epic|desert|striker
simurgh|Simurgh|Tradição persa|Pérsia|Enorme ave sobrenatural ligada à sabedoria.|storm|legendary|desert|support
div|Div|Tradições persas e da Ásia Central|Pérsia e Ásia Central|Espírito ou demônio monstruoso.|spirit|epic|desert|striker
peri|Peri|Tradição persa|Pérsia|Ser sobrenatural alado.|spirit|rare|desert|support
djinn|Djinn|Tradições árabes e islâmicas|Mundo árabe|Seres sobrenaturais de natureza própria.|storm|legendary|desert|controller
ifrit|Ifrit|Tradição árabe e islâmica|Mundo árabe|Tipo poderoso de djinn.|fire|legendary|desert|striker
ghoul|Ghoul|Folclore árabe|Mundo árabe|Criatura associada a cemitérios e lugares desertos.|spirit|uncommon|desert|striker
bahamut|Bahamut|Cosmologia medieval islâmica|Mundo islâmico medieval|Criatura colossal associada à estrutura do mundo.|water|mythic|deep-sea|guardian
nasnas|Nasnas|Folclore árabe|Mundo árabe|Criatura descrita como possuindo apenas metade de um corpo.|spirit|rare|desert|skirmisher
aqrabuamelu|Aqrabuamelu|Mitologia mesopotâmica|Mesopotâmia|Homens-escorpião.|nature|epic|desert|guardian
pazuzu|Pazuzu|Mitologia mesopotâmica|Mesopotâmia|Entidade demoníaca ligada aos ventos.|storm|legendary|desert|controller
lamassu|Lamassu|Mitologia mesopotâmica|Mesopotâmia|Guardião híbrido com características humanas, bovinas e aladas.|storm|legendary|desert|guardian
anzu|Anzû|Mitologia mesopotâmica|Mesopotâmia|Enorme criatura alada semelhante a uma águia.|storm|epic|desert|striker
ammit|Ammit|Mitologia do Egito Antigo|Egito Antigo|Criatura híbrida que devora os corações dos condenados.|spirit|legendary|desert|guardian
apep|Apep|Mitologia do Egito Antigo|Egito Antigo|Serpente colossal associada ao caos.|spirit|mythic|eclipse|striker
esfinge|Sphinx|Tradições egípcias e gregas|Egito e Grécia|Criatura com corpo de leão e cabeça humana.|spirit|legendary|desert|controller
grootslang|Grootslang|Folclore da África Austral|África Austral|Criatura gigantesca semelhante a uma mistura de serpente e elefante.|nature|legendary|desert|guardian
tokoloshe|Tokoloshe|Tradições do sul da África|África Austral|Pequeno ser sobrenatural perigoso.|spirit|uncommon|roots|skirmisher
impundulu|Impundulu|Tradições da África Austral|África Austral|Pássaro-relâmpago sobrenatural.|storm|legendary|runic|striker
adze|Adze|Tradições Ewe|África Ocidental|Espírito capaz de assumir forma de inseto.|spirit|rare|roots|skirmisher
sasabonsam|Sasabonsam|Tradições Akan|África Ocidental|Criatura das florestas.|nature|epic|roots|controller
mami-wata|Mami Wata|Tradições da África Ocidental e Central|África Ocidental e Central|Espírito associado à água.|water|legendary|archipelago|support
kishi|Kishi|Folclore angolano|Angola|Entidade com aparência humana de um lado e monstruosa do outro.|spirit|rare|roots|striker
jorogumo|Jorōgumo|Folclore japonês|Japão|Aranha sobrenatural capaz de assumir forma de mulher.|spirit|epic|mist|controller
kappa|Kappa|Folclore japonês|Japão|Yōkai aquático.|water|uncommon|archipelago|guardian
tengu|Tengu|Folclore japonês|Japão|Seres sobrenaturais associados às montanhas.|storm|epic|archipelago|skirmisher
oni|Oni|Folclore japonês|Japão|Ogros ou demônios do folclore japonês.|fire|epic|runic|striker
kitsune|Kitsune|Folclore japonês|Japão|Raposas sobrenaturais com poderes mágicos.|spirit|legendary|mist|controller
nekomata|Nekomata|Folclore japonês|Japão|Gato sobrenatural de cauda dividida.|spirit|rare|mist|skirmisher
rokurokubi|Rokurokubi|Folclore japonês|Japão|Pessoa sobrenatural cujo pescoço pode se alongar.|spirit|uncommon|mist|controller
nurikabe|Nurikabe|Folclore japonês|Japão|Yōkai que bloqueia caminhos.|nature|rare|runic|guardian
yuki-onna|Yuki-onna|Folclore japonês|Japão|Espírito feminino associado à neve.|water|epic|runic|controller
gashadokuro|Gashadokuro|Folclore moderno japonês|Japão|Esqueleto gigante do folclore moderno japonês.|spirit|legendary|eclipse|guardian
jiangshi|Jiangshi|Folclore chinês|China|Cadáver reanimado conhecido por se locomover aos saltos.|spirit|epic|eclipse|guardian
huli-jing|Huli Jing|Folclore chinês|China|Espírito-raposa capaz de transformação.|spirit|legendary|mist|controller
nian|Nian|Tradições chinesas de Ano-Novo|China|Criatura monstruosa associada às tradições do Ano-Novo.|fire|legendary|runic|striker
taotie|Taotie|Tradição chinesa|China|Criatura ou motivo monstruoso ligado à voracidade.|nature|epic|desert|striker
qilin|Qilin|Tradição chinesa|China|Criatura auspiciosa semelhante a um animal fantástico com características diversas.|spirit|legendary|archipelago|support
penanggalan|Penanggalan|Folclore malaio|Malásia|Entidade cuja cabeça e órgãos se separam do corpo.|spirit|epic|eclipse|skirmisher
pontianak|Pontianak|Folclore malaio e indonésio|Malásia e Indonésia|Espírito feminino associado à morte durante o parto.|spirit|epic|eclipse|controller
aswang|Aswang|Folclore filipino|Filipinas|Categoria de criaturas metamórficas e monstruosas.|spirit|epic|mist|skirmisher
manananggal|Manananggal|Folclore filipino|Filipinas|Criatura capaz de separar a parte superior do corpo.|spirit|epic|eclipse|skirmisher
tikbalang|Tikbalang|Folclore filipino|Filipinas|Criatura humanoide com características de cavalo.|nature|rare|roots|skirmisher
bunyip|Bunyip|Tradições aborígenes australianas|Austrália|Criatura associada a rios, lagos e pântanos.|water|rare|archipelago|guardian
yowie|Yowie|Folclore australiano moderno|Austrália|Criatura humanoide selvagem semelhante ao Bigfoot.|nature|rare|roots|guardian
`;
export const REQUESTED_CREATURE_SPECS: RequestedSpec[] = REQUESTED_ROWS.trim().split("\n").map((row) => {
  const [id, name, tradition, origin, description, element, rarity, regionId, role] = row.split("|");
  return { id, name, tradition, origin, description, element: element as Element, rarity: rarity as Rarity, regionId, role: role as CombatRole };
});

const rarityStats: Record<Rarity, [number, number, number]> = {
  common: [98, 42, 58], uncommon: [108, 48, 62], rare: [122, 56, 68],
  epic: [138, 64, 72], legendary: [154, 72, 76], mythic: [170, 80, 80],
};

const moveWords: Record<Element, [string, string, string]> = {
  fire: ["Centelha", "Chama", "Incêndio"], water: ["Corrente", "Maré", "Dilúvio"],
  nature: ["Raiz", "Trama", "Domínio"], storm: ["Rajada", "Trovão", "Tempestade"],
  spirit: ["Eco", "Véu", "Manifestação"],
};

const regionNames: Record<string, string> = {
  roots: "Floresta das Raízes Antigas", archipelago: "Arquipélago dos Espíritos", runic: "Terras Rúnicas",
  mist: "Pântano da Névoa", desert: "Deserto dos Reis Esquecidos", "deep-sea": "Mar das Profundezas", eclipse: "Terras do Eclipse",
};
function seedFor(spec: RequestedSpec, index: number): CreatureSeed {
  const [hp, defense, speed] = rarityStats[spec.rarity];
  const words = moveWords[spec.element];
  return {
    id: spec.id, name: spec.name, title: `Manifestação de ${spec.tradition}`,
    description: spec.description,
    lore: `${spec.name} entra no Atlas preservando a tradição e a origem indicadas para esta expansão.`,
    folklore: {
      tradition: spec.tradition, origin: spec.origin,
      sourceNote: "Entrada baseada na tradição e origem fornecidas para a expansão de 100 criaturas; bibliografia específica permanece etapa de curadoria editorial.",
      adaptation: "Combate, elemento, raridade, estatísticas e as duas pré-evoluções são adaptações de Card Realms; a forma final preserva o nome tradicional informado.",
    },
    regionId: spec.regionId, element: spec.element,
    traits: [spec.element, spec.role, "folclore"], rarity: spec.rarity, role: spec.role,
    hp, defense, speed, moves: [`${words[0]} de ${spec.name}`, `${words[1]} de ${spec.name}`, `${words[2]} de ${spec.name}`],
    obtainableBy: `Expedições e recompensas em ${regionNames[spec.regionId] ?? spec.regionId}`,
    spriteIndex: index * 3 + 2, spriteSheet: REQUESTED_EVOLUTION_ATLAS,
    spriteColumns: REQUESTED_ATLAS_COLUMNS, spriteRows: REQUESTED_ATLAS_ROWS,
  };
}
function requestedSprite(index: number): SpriteDefinition {
  return {
    sheet: REQUESTED_EVOLUTION_ATLAS,
    column: index % REQUESTED_ATLAS_COLUMNS,
    row: Math.floor(index / REQUESTED_ATLAS_COLUMNS),
    columns: REQUESTED_ATLAS_COLUMNS,
    rows: REQUESTED_ATLAS_ROWS,
  };
}

export function missingRequestedCreatureSeeds(existingIds: ReadonlySet<string>): CreatureSeed[] {
  return REQUESTED_CREATURE_SPECS.flatMap((spec, index) => existingIds.has(spec.id) ? [] : [seedFor(spec, index)]);
}

const stageNames: Record<Element, [[string, string], [string, string]]> = {
  fire: [["Faísca de", "Primeiro vínculo ígneo"], ["Brasa de", "Forma intermediária ígnea"]],
  water: [["Gota de", "Primeiro vínculo aquático"], ["Maré de", "Forma intermediária aquática"]],
  nature: [["Broto de", "Primeiro vínculo natural"], ["Guardião de", "Forma intermediária natural"]],
  storm: [["Sopro de", "Primeiro vínculo da tempestade"], ["Arauto de", "Forma intermediária da tempestade"]],
  spirit: [["Eco de", "Primeiro vínculo espiritual"], ["Vulto de", "Forma intermediária espiritual"]],
};
export function requestedEvolutionLine(creature: CreatureDefinition): EvolutionLine | undefined {
  const index = REQUESTED_CREATURE_SPECS.findIndex((spec) => spec.id === creature.id);
  if (index < 0) return undefined;
  const names = stageNames[creature.element];
  const adaptation = "Forma de pré-evolução criada para Card Realms; não é apresentada como forma tradicional do folclore.";
  return [
    { stage: 0, name: `${names[0][0]} ${creature.name}`, title: names[0][1], sprite: requestedSprite(index * 3), adaptation },
    { stage: 1, name: `${names[1][0]} ${creature.name}`, title: names[1][1], sprite: requestedSprite(index * 3 + 1), adaptation },
    { stage: 2, name: creature.name, title: creature.title, sprite: creature.sprite, adaptation: "Forma final baseada na criatura tradicional registrada no Bestiário." },
  ];
}

export function attachRequestedEvolutionLines(creatures: CreatureDefinition[]): CreatureDefinition[] {
  return creatures.map((creature) => {
    const evolutionLine = requestedEvolutionLine(creature);
    return evolutionLine ? { ...creature, evolutionLine } : creature;
  });
}
