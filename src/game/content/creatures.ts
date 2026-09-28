import type { AttackDefinition, CreatureDefinition, Element } from "../types";

type CreatureSeed = Omit<CreatureDefinition, "attacks" | "sprite"> & {
  moves: [string, string, string];
  spriteIndex: number;
};

const SPRITE_SHEET = "/art/folklore-creatures-five-elements.png";
const SPRITE_COLUMNS = 5;
const SPRITE_ROWS = 5;

function attack(
  id: string,
  name: string,
  element: Element,
  energy: 1 | 2 | 3,
  damage: number,
  minRoll: 2 | 3 | 4,
  animation: AttackDefinition["animation"],
  description: string,
  effect?: AttackDefinition["effect"],
): AttackDefinition {
  return { id, name, cost: { [element]: energy }, damage, minRoll, animation, description, effect };
}

const attackFactory: Record<Element, (seed: CreatureSeed) => CreatureDefinition["attacks"]> = {
  fire: (seed) => [
    attack(`${seed.id}-1`, seed.moves[0], "fire", 1, 22, 2, "flame", "Ataque direto com chance de deixar o alvo em chamas.", { type: "burn", chance: 20, amount: 7, duration: 2 }),
    attack(`${seed.id}-2`, seed.moves[1], "fire", 2, 50, 3, "flame", "Uma descarga de calor concentrado.", { type: "burn", chance: 35, amount: 8, duration: 2 }),
    attack(`${seed.id}-3`, seed.moves[2], "fire", 3, 86, 4, "flame", "A manifestação mais intensa da criatura.", { type: "burn", chance: 55, amount: 10, duration: 3 }),
  ],
  water: (seed) => [
    attack(`${seed.id}-1`, seed.moves[0], "water", 1, 20, 2, "wave", "Um golpe fluido e confiável."),
    attack(`${seed.id}-2`, seed.moves[1], "water", 2, 45, 3, "wave", "Encharca o alvo e o deixa vulnerável à Tempestade.", { type: "soaked", chance: 45, duration: 2 }),
    attack(`${seed.id}-3`, seed.moves[2], "water", 3, 74, 4, "wave", "A corrente restaura parte da vitalidade de quem a conduz.", { type: "heal", amount: 20 }),
  ],
  nature: (seed) => [
    attack(`${seed.id}-1`, seed.moves[0], "nature", 1, 18, 2, "nature", "Ataque firme ligado ao território."),
    attack(`${seed.id}-2`, seed.moves[1], "nature", 2, 43, 2, "nature", "Prende os passos do alvo e bloqueia trocas voluntárias.", { type: "rooted", chance: 35, duration: 1 }),
    attack(`${seed.id}-3`, seed.moves[2], "nature", 3, 78, 4, "nature", "O terreno responde e forma uma proteção viva.", { type: "shield", amount: 22 }),
  ],
  storm: (seed) => [
    attack(`${seed.id}-1`, seed.moves[0], "storm", 1, 21, 2, "storm", "Um movimento veloz conduzido pelo vento."),
    attack(`${seed.id}-2`, seed.moves[1], "storm", 2, 48, 3, "storm", "A descarga dificulta a próxima ação do alvo.", { type: "shocked", chance: 35, duration: 1 }),
    attack(`${seed.id}-3`, seed.moves[2], "storm", 3, 82, 4, "storm", "Céu e vento convergem em um único impacto."),
  ],
  spirit: (seed) => [
    attack(`${seed.id}-1`, seed.moves[0], "spirit", 1, 19, 2, "spirit", "Um eco sobrenatural que enfraquece a ofensiva inimiga.", { type: "haunted", chance: 25, duration: 1 }),
    attack(`${seed.id}-2`, seed.moves[1], "spirit", 2, 44, 3, "spirit", "Um rito defensivo acompanha o golpe.", { type: "warded", chance: 100, duration: 2 }),
    attack(`${seed.id}-3`, seed.moves[2], "spirit", 3, 76, 4, "spirit", "A presença ancestral ocupa toda a arena.", { type: "heal", amount: 16 }),
  ],
};

const seeds: CreatureSeed[] = [
  {
    id: "boitata", name: "Boitatá", title: "Serpente de Fogo da Mata",
    description: "Serpente luminosa que vigia campos e florestas contra quem os destrói.",
    lore: "Relatos brasileiros descrevem olhos ou corpo em chamas e sua função de confundir ou punir invasores da mata.",
    folklore: { tradition: "Folclore brasileiro de matriz tupi", origin: "Brasil", sourceNote: "Registrado desde o período colonial, com variações regionais sobre uma serpente ou fogo vivo protetor.", adaptation: "Mantém a forma serpentina, o brilho ígneo e o papel de guardião da natureza." },
    regionId: "roots", element: "fire", traits: ["serpente", "guardião", "luminoso"], rarity: "rare", role: "striker",
    hp: 124, defense: 44, speed: 72, moves: ["Olhar de Brasa", "Rastro Incandescente", "Círculo do Boitatá"],
    obtainableBy: "Provação do fogo guardião na Floresta das Raízes Antigas", spriteIndex: 0,
  },
  {
    id: "mula-sem-cabeca", name: "Mula-sem-cabeça", title: "Galope da Noite em Chamas",
    description: "Mula encantada que atravessa a noite com fogo irrompendo do pescoço.",
    lore: "A lenda brasileira possui muitas versões sobre a maldição e costuma situar sua cavalgada entre a noite de quinta e a manhã de sexta-feira.",
    folklore: { tradition: "Folclore brasileiro", origin: "Brasil", sourceNote: "Narrativa difundida em várias regiões, com versões diferentes para a origem e a quebra do encanto.", adaptation: "Evita fixar uma única causa moral da maldição e preserva a forma, o galope e as chamas." },
    regionId: "mist", element: "fire", traits: ["encantado", "galope", "noturno"], rarity: "epic", role: "skirmisher",
    hp: 132, defense: 46, speed: 90, moves: ["Coice de Faísca", "Galope Maldito", "Clarão sem Cabeça"],
    obtainableBy: "Encontro noturno nas estradas do Pântano da Névoa", spriteIndex: 1,
  },
  {
    id: "salamandra", name: "Salamandra", title: "Habitante das Chamas",
    description: "Ser associado ao fogo em bestiários medievais e na tradição alquímica europeia.",
    lore: "A resistência real das salamandras ao calor de troncos úmidos alimentou relatos de animais capazes de viver dentro do fogo.",
    folklore: { tradition: "Bestiários e alquimia europeia", origin: "Europa medieval e moderna", sourceNote: "A salamandra tornou-se um emblema do elemento fogo em textos naturalistas e ocultistas.", adaptation: "Usa a forma anfíbia tradicional, sem transformá-la em um dragão genérico." },
    regionId: "desert", element: "fire", traits: ["anfíbio", "alquímico", "resistente"], rarity: "uncommon", role: "support",
    hp: 104, defense: 56, speed: 54, moves: ["Passo na Brasa", "Selo Alquímico", "Forno da Salamandra"],
    obtainableBy: "Oficinas abandonadas do Deserto dos Reis Esquecidos", spriteIndex: 2,
  },
  {
    id: "fenix", name: "Fênix", title: "Ave do Retorno Solar",
    description: "Ave extraordinária que encerra e reinicia o próprio ciclo de vida pelo fogo.",
    lore: "Autores greco-romanos narraram uma ave única e longeva ligada ao Sol, cuja renovação foi posteriormente associada às cinzas.",
    folklore: { tradition: "Mitologia greco-romana", origin: "Mediterrâneo antigo", sourceNote: "A tradição clássica dialoga com aves solares egípcias, mas não as trata aqui como uma única entidade.", adaptation: "Preserva a ave solar, a longevidade e o renascimento sem acrescentar anatomia monstruosa." },
    regionId: "desert", element: "fire", traits: ["ave", "solar", "renascimento"], rarity: "legendary", role: "support",
    hp: 166, defense: 58, speed: 84, moves: ["Pena Solar", "Voo das Cinzas", "Ciclo da Fênix"],
    obtainableBy: "Santuário solar do deserto", spriteIndex: 3,
  },
  {
    id: "aitvaras", name: "Aitvaras", title: "Espírito do Rastro Flamejante",
    description: "Espírito doméstico lituano que pode aparecer como ave ou ser voador de cauda ardente.",
    lore: "Diz-se que leva riqueza para a casa que o abriga, embora os presentes possam ter sido tomados de outros.",
    folklore: { tradition: "Folclore lituano", origin: "Lituânia", sourceNote: "Relatos variam entre formas de galo, serpente e criatura aérea semelhante a um pequeno dragão.", adaptation: "Combina a forma de ave-serpente e o rastro de fogo sem apagar sua natureza doméstica ambígua." },
    regionId: "mist", element: "fire", traits: ["doméstico", "aéreo", "ambíguo"], rarity: "rare", role: "controller",
    hp: 112, defense: 40, speed: 82, moves: ["Rastro Rubro", "Presente Tomado", "Telhado em Chamas"],
    obtainableBy: "Telhados antigos do Pântano da Névoa", spriteIndex: 4,
  },
  {
    id: "iara", name: "Iara", title: "Senhora do Canto das Águas",
    description: "Encantada dos rios amazônicos cuja voz atrai quem se aproxima de suas margens.",
    lore: "A figura brasileira reúne camadas indígenas e europeias; versões modernas a descrevem como mulher de beleza extraordinária ligada às águas doces.",
    folklore: { tradition: "Folclore amazônico brasileiro", origin: "Amazônia, Brasil", sourceNote: "A narrativa mudou ao longo do tempo; a adaptação reconhece essa formação histórica em vez de declarar uma versão única.", adaptation: "Preserva o canto, o rio e a agência da encantada, evitando tratá-la como monstro aquático genérico." },
    regionId: "archipelago", element: "water", traits: ["encantada", "canto", "rio"], rarity: "epic", role: "controller",
    hp: 120, defense: 48, speed: 70, moves: ["Voz da Margem", "Espelho do Rio", "Canto da Iara"],
    obtainableBy: "Encontro ritual nas águas calmas do arquipélago", spriteIndex: 5,
  },
  {
    id: "boto-cor-de-rosa", name: "Boto-cor-de-rosa", title: "Encantado das Festas Ribeirinhas",
    description: "Boto amazônico que assume forma humana para visitar festas à margem do rio.",
    lore: "Costuma aparecer vestido de branco e com chapéu, retornando às águas antes do amanhecer.",
    folklore: { tradition: "Folclore amazônico brasileiro", origin: "Amazônia, Brasil", sourceNote: "A história explica encontros misteriosos e vínculos com o rio em comunidades ribeirinhas.", adaptation: "A batalha usa sua forma de boto e sua transformação como ilusão, sem substituir o animal por um humano genérico." },
    regionId: "archipelago", element: "water", traits: ["encantado", "transformação", "rio"], rarity: "rare", role: "skirmisher",
    hp: 110, defense: 42, speed: 86, moves: ["Salto Rosado", "Chapéu Branco", "Retorno ao Rio"],
    obtainableBy: "Festividades ribeirinhas do Arquipélago dos Espíritos", spriteIndex: 6,
  },
  {
    id: "kelpie", name: "Kelpie", title: "Cavalo das Águas Profundas",
    description: "Espírito aquático escocês que assume a forma de cavalo junto a rios e lagos.",
    lore: "Atrai viajantes para o dorso e os leva para a água; algumas versões permitem dominá-lo ao tomar suas rédeas.",
    folklore: { tradition: "Folclore escocês", origin: "Escócia", sourceNote: "Pertence a um conjunto amplo de tradições célticas sobre cavalos d'água.", adaptation: "Mantém forma equina, crina molhada e comportamento traiçoeiro." },
    regionId: "deep-sea", element: "water", traits: ["equino", "metamorfo", "lago"], rarity: "rare", role: "striker",
    hp: 136, defense: 54, speed: 78, moves: ["Casco de Lago", "Rédea Encharcada", "Mergulho do Kelpie"],
    obtainableBy: "Lagos escuros do Mar das Profundezas", spriteIndex: 7,
  },
  {
    id: "kappa", name: "Kappa", title: "Habitante dos Rios Japoneses",
    description: "Yōkai anfíbio reconhecido pela carapaça, pelo bico e pelo prato de água sobre a cabeça.",
    lore: "Pode ser perigoso, mas também respeita etiqueta e promessas; ao se curvar, derrama a água que sustenta sua força.",
    folklore: { tradition: "Folclore japonês", origin: "Japão", sourceNote: "Há muitas descrições regionais, geralmente ligadas a rios, lagos e advertências sobre a água.", adaptation: "Preserva carapaça, prato d'água, pepino e regras de cortesia." },
    regionId: "archipelago", element: "water", traits: ["yōkai", "anfíbio", "etiqueta"], rarity: "uncommon", role: "guardian",
    hp: 146, defense: 78, speed: 38, moves: ["Bico de Rio", "Prato Cheio", "Desafio do Kappa"],
    obtainableBy: "Margens protegidas por oferendas de pepino", spriteIndex: 8,
  },
  {
    id: "ahuizotl", name: "Ahuízotl", title: "Caçador das Águas Mexicas",
    description: "Ser aquático de aspecto canino ou mustelídeo, com uma mão na extremidade da cauda.",
    lore: "Fontes coloniais registraram que atraía pessoas para a água e usava a mão caudal para capturá-las.",
    folklore: { tradition: "Tradição mexica registrada no período colonial", origin: "Vale do México", sourceNote: "É descrito em fontes como o Códice Florentino, com variações de interpretação zoológica e mítica.", adaptation: "Mantém corpo aquático e mão caudal; não o converte em lontra comum." },
    regionId: "deep-sea", element: "water", traits: ["aquático", "mão caudal", "caçador"], rarity: "epic", role: "controller",
    hp: 138, defense: 58, speed: 74, moves: ["Garra da Cauda", "Chamado da Margem", "Poço do Ahuízotl"],
    obtainableBy: "Ruínas lacustres do Mar das Profundezas", spriteIndex: 9,
  },
  {
    id: "curupira", name: "Curupira", title: "Guardião dos Pés Virados",
    description: "Guardião da mata de cabelos vermelhos e pés voltados para trás.",
    lore: "Engana caçadores e invasores com rastros invertidos, assobios e caminhos que parecem mudar de lugar.",
    folklore: { tradition: "Folclore brasileiro de matriz indígena", origin: "Brasil", sourceNote: "É uma das figuras florestais mais antigas registradas no Brasil, com muitas variações regionais.", adaptation: "Preserva a forma humana pequena, os cabelos vermelhos, os pés invertidos e a proteção dos animais." },
    regionId: "roots", element: "nature", traits: ["guardião", "pés invertidos", "floresta"], rarity: "rare", role: "controller",
    hp: 126, defense: 58, speed: 88, moves: ["Rastro Invertido", "Assobio da Mata", "Labirinto do Curupira"],
    obtainableBy: "Trilha de rastros invertidos na Floresta das Raízes Antigas", spriteIndex: 10,
  },
  {
    id: "caipora", name: "Caipora", title: "Protetora dos Animais da Mata",
    description: "Entidade guardiã que confunde caçadores e protege os animais silvestres.",
    lore: "Sua aparência varia conforme a região; é frequentemente associada a assobios, fumo, montaria em porco-do-mato e pactos de respeito.",
    folklore: { tradition: "Folclore brasileiro de matriz indígena", origin: "Brasil", sourceNote: "As tradições de Caipora e Curupira se aproximam em algumas regiões, mas não são tratadas como idênticas aqui.", adaptation: "Usa uma representação regional de guardiã montada e explicita que outras formas existem." },
    regionId: "roots", element: "nature", traits: ["guardião", "animais", "assobio"], rarity: "rare", role: "support",
    hp: 132, defense: 64, speed: 76, moves: ["Chamado da Queixada", "Fumo de Trégua", "Pacto da Caipora"],
    obtainableBy: "Missão de proteção da fauna nas Raízes Antigas", spriteIndex: 11,
  },
  {
    id: "mapinguari", name: "Mapinguari", title: "Gigante das Matas Distantes",
    description: "Ser enorme e coberto de pelos que habita áreas profundas da floresta amazônica.",
    lore: "Os relatos variam: força extraordinária, cheiro marcante e anatomias incomuns aparecem em diferentes versões da tradição oral.",
    folklore: { tradition: "Folclore amazônico", origin: "Amazônia, Brasil", sourceNote: "Não há uma aparência única; descrições mudam entre povos, épocas e regiões.", adaptation: "Assume uma forma bípede robusta e evita declarar características controversas como universais." },
    regionId: "roots", element: "nature", traits: ["gigante", "floresta", "resistente"], rarity: "epic", role: "guardian",
    hp: 204, defense: 88, speed: 24, moves: ["Passo Pesado", "Rugido da Mata", "Investida do Mapinguari"],
    obtainableBy: "Chefe selvagem das trilhas mais profundas", spriteIndex: 12,
  },
  {
    id: "leshy", name: "Leshy", title: "Senhor Mutável da Floresta",
    description: "Espírito eslavo da floresta capaz de alterar tamanho e imitar vozes.",
    lore: "Pode desorientar viajantes, esconder animais e mudar de aparência conforme atravessa seu domínio.",
    folklore: { tradition: "Folclores eslavos", origin: "Europa Oriental e regiões eslavas", sourceNote: "Nome, temperamento e aparência variam entre tradições locais.", adaptation: "Preserva a mudança de tamanho, os sinais vegetais e a soberania sobre a mata." },
    regionId: "mist", element: "nature", traits: ["espírito", "metamorfo", "floresta"], rarity: "epic", role: "controller",
    hp: 154, defense: 74, speed: 52, moves: ["Voz Imitada", "Passo sem Trilha", "Estatura do Leshy"],
    obtainableBy: "Bosques móveis do Pântano da Névoa", spriteIndex: 13,
  },
  {
    id: "amarok", name: "Amarok", title: "Lobo Solitário da Noite",
    description: "Lobo gigantesco da tradição inuíte que caça sozinho.",
    lore: "Histórias sobre Amarok advertem caçadores imprudentes e contrastam sua caça solitária com a alcateia comum.",
    folklore: { tradition: "Tradições inuítes", origin: "Regiões árticas da América do Norte", sourceNote: "A grafia e os relatos variam entre línguas e comunidades inuítes.", adaptation: "Mantém o lobo gigantesco e solitário; evita misturá-lo a lobisomens europeus." },
    regionId: "runic", element: "nature", traits: ["lobo", "ártico", "solitário"], rarity: "legendary", role: "striker",
    hp: 184, defense: 72, speed: 80, moves: ["Mordida Solitária", "Caçada Polar", "Uivo do Amarok"],
    obtainableBy: "Caçada ritual nas Montanhas Rúnicas", spriteIndex: 14,
  },
  {
    id: "saci-perere", name: "Saci-Pererê", title: "Travesso do Redemoinho",
    description: "Figura de uma perna só e gorro vermelho que viaja em redemoinhos e prega peças.",
    lore: "Esconde objetos, embaraça crinas, assusta viajantes e pode ser capturado, segundo versões populares, por meio de seu redemoinho e gorro.",
    folklore: { tradition: "Folclore brasileiro", origin: "Brasil", sourceNote: "A figura reúne influências indígenas, africanas e europeias e mudou bastante entre registros históricos.", adaptation: "Preserva uma perna, gorro vermelho, cachimbo em versões modernas e domínio do redemoinho." },
    regionId: "roots", element: "storm", traits: ["travesso", "redemoinho", "gorro"], rarity: "rare", role: "skirmisher",
    hp: 104, defense: 34, speed: 98, moves: ["Pulo de Vento", "Nó na Crina", "Redemoinho do Saci"],
    obtainableBy: "Encontro com um redemoinho nas trilhas das Raízes", spriteIndex: 15,
  },
  {
    id: "raiju", name: "Raijū", title: "Besta do Trovão",
    description: "Yōkai associado ao relâmpago, descrito em formas animais como lobo, cão ou felino.",
    lore: "É ligado a Raijin e aos fenômenos das tempestades; relatos populares explicam marcas e danos causados por raios.",
    folklore: { tradition: "Folclore japonês", origin: "Japão", sourceNote: "A forma não é fixa e varia entre compilações e regiões.", adaptation: "Usa uma forma canina feita de nuvens e eletricidade, uma das representações tradicionais." },
    regionId: "runic", element: "storm", traits: ["yōkai", "relâmpago", "canino"], rarity: "rare", role: "striker",
    hp: 116, defense: 42, speed: 94, moves: ["Pata de Raio", "Salto entre Nuvens", "Rugido do Raijū"],
    obtainableBy: "Picos atingidos por relâmpagos nas Montanhas Rúnicas", spriteIndex: 16,
  },
  {
    id: "tengu", name: "Tengu", title: "Habitante dos Ventos da Montanha",
    description: "Ser sobrenatural japonês de montanha, ligado a aves, ventos e artes marciais.",
    lore: "Representações antigas tendem ao aspecto de ave; formas posteriores incluem rosto vermelho e nariz longo.",
    folklore: { tradition: "Folclore e tradição religiosa japonesa", origin: "Japão", sourceNote: "Tengu variam de espíritos perigosos a protetores e mestres, conforme período e narrativa.", adaptation: "Usa a forma alada antiga e evita reduzi-lo à caricatura de nariz longo." },
    regionId: "archipelago", element: "storm", traits: ["montanha", "ave", "marcial"], rarity: "epic", role: "controller",
    hp: 134, defense: 56, speed: 88, moves: ["Leque de Rajada", "Passo da Montanha", "Vendaval do Tengu"],
    obtainableBy: "Templos elevados do Arquipélago dos Espíritos", spriteIndex: 17,
  },
  {
    id: "ziz", name: "Ziz", title: "Ave Imensa dos Céus",
    description: "Ave colossal da tradição judaica cuja envergadura alcança os limites do céu.",
    lore: "Textos e comentários a colocam entre os grandes seres da criação, ao lado de Behemoth e Leviatã.",
    folklore: { tradition: "Mitologia e literatura rabínica judaica", origin: "Oriente Médio", sourceNote: "Descrições enfatizam escala cósmica e domínio do céu, não uma espécie comum de monstro.", adaptation: "Preserva a ave colossal e o papel celeste sem fundi-la com outras aves míticas." },
    regionId: "desert", element: "storm", traits: ["ave", "colossal", "celeste"], rarity: "mythic", role: "guardian",
    hp: 212, defense: 82, speed: 62, moves: ["Bater de Asas", "Sombra do Horizonte", "Céu de Ziz"],
    obtainableBy: "Evento celeste sobre o Deserto dos Reis Esquecidos", eventExclusive: true, spriteIndex: 18,
  },
  {
    id: "simurgh", name: "Simurgh", title: "Ave Sábia da Tradição Persa",
    description: "Ave benevolente e antiquíssima associada à sabedoria, cura e proteção.",
    lore: "Na literatura persa, acolhe Zāl e o auxilia por meio de uma pena; outras tradições a ligam à árvore de todas as sementes.",
    folklore: { tradition: "Mitologia e literatura persa", origin: "Irã e mundo persófono", sourceNote: "A Simurgh atravessa períodos pré-islâmicos e obras como o Shahnameh, com funções que variam.", adaptation: "Preserva a grande ave sábia, as penas protetoras e o vínculo com árvores e cura." },
    regionId: "desert", element: "storm", traits: ["ave", "sabedoria", "cura"], rarity: "legendary", role: "support",
    hp: 176, defense: 70, speed: 78, moves: ["Pena Protetora", "Voo sobre Alborz", "Sabedoria da Simurgh"],
    obtainableBy: "Santuário elevado além do deserto", spriteIndex: 19,
  },
  {
    id: "black-shuck", name: "Black Shuck", title: "Cão Negro de East Anglia",
    description: "Cão espectral de pelagem negra e olhos ou olho em brasa que percorre estradas e costas inglesas.",
    lore: "Alguns relatos o tratam como presságio perigoso; outros, como acompanhante ou protetor de viajantes solitários.",
    folklore: { tradition: "Folclore inglês", origin: "East Anglia, Inglaterra", sourceNote: "O nome e o comportamento variam em narrativas locais de cães negros espectrais.", adaptation: "Mantém porte canino, pelagem negra e olhar luminoso, incluindo sua ambiguidade entre ameaça e guarda." },
    regionId: "eclipse", element: "spirit", traits: ["canino", "espectral", "presságio"], rarity: "rare", role: "guardian",
    hp: 152, defense: 72, speed: 68, moves: ["Passo na Estrada", "Olho em Brasa", "Vigília de Black Shuck"],
    obtainableBy: "Estradas costeiras do Reino do Eclipse", spriteIndex: 20,
  },
  {
    id: "domovoi", name: "Domovoi", title: "Espírito Guardião da Casa",
    description: "Espírito doméstico eslavo que protege a família e o lar quando é respeitado.",
    lore: "Ruídos noturnos, pequenos trabalhos e advertências são atribuídos a ele; abandono ou desrespeito podem torná-lo hostil.",
    folklore: { tradition: "Folclores eslavos", origin: "Europa Oriental e regiões eslavas", sourceNote: "Aparência e costumes variam, muitas vezes associados à lareira, ao celeiro e aos ancestrais da casa.", adaptation: "Preserva pequena estatura, pelos, vínculo ancestral e papel doméstico." },
    regionId: "mist", element: "spirit", traits: ["doméstico", "ancestral", "guardião"], rarity: "uncommon", role: "support",
    hp: 102, defense: 60, speed: 48, moves: ["Ruído no Assoalho", "Cuidado da Lareira", "Aviso do Domovoi"],
    obtainableBy: "Casas cuidadas no Pântano da Névoa", spriteIndex: 21,
  },
  {
    id: "qilin", name: "Qilin", title: "Presságio de Governo Justo",
    description: "Ser auspicioso chinês de corpo ungulado, associado à benevolência e ao surgimento de sábios.",
    lore: "É descrito como tão gentil que evita pisar em seres vivos; sua aparência combina traços animais sem equivaler ao unicórnio europeu.",
    folklore: { tradition: "Mitologia chinesa", origin: "China", sourceNote: "Iconografia e descrições mudaram entre dinastias e regiões do Leste Asiático.", adaptation: "Mantém cascos, escamas, chifres e temperamento benevolente; não o chama de dragão ou unicórnio." },
    regionId: "archipelago", element: "spirit", traits: ["auspicioso", "ungulado", "benevolente"], rarity: "legendary", role: "support",
    hp: 180, defense: 80, speed: 66, moves: ["Passo sem Dano", "Sopro Auspicioso", "Chegada do Qilin"],
    obtainableBy: "Provação de benevolência no arquipélago", spriteIndex: 22,
  },
  {
    id: "banshee", name: "Banshee", title: "Mensageira do Lamento",
    description: "Figura feminina sobrenatural irlandesa cujo lamento anuncia uma morte na família.",
    lore: "Não é simplesmente uma atacante: sua função tradicional é pressagiar e lamentar, aparecendo em formas jovens ou idosas.",
    folklore: { tradition: "Folclore irlandês", origin: "Irlanda", sourceNote: "O nome deriva de bean sí, mulher do povo feérico, e os relatos se ligam a famílias e territórios.", adaptation: "Transforma o lamento em controle de batalha sem apagar seu papel de mensageira." },
    regionId: "eclipse", element: "spirit", traits: ["feérico", "lamento", "presságio"], rarity: "epic", role: "controller",
    hp: 118, defense: 44, speed: 76, moves: ["Sussurro do Sídhe", "Véu do Presságio", "Lamento da Banshee"],
    obtainableBy: "Colinas silenciosas do Reino do Eclipse", spriteIndex: 23,
  },
  {
    id: "carbunclo", name: "Carbunclo", title: "Pequeno Portador de Luz",
    description: "Animal esquivo de relatos sul-americanos, reconhecido por uma pedra ou brilho precioso na cabeça.",
    lore: "Buscadores de tesouro o descrevem como uma luz móvel na noite; persegui-lo pode revelar riqueza ou levar o ganancioso a se perder.",
    folklore: { tradition: "Folclores mineiros sul-americanos", origin: "Região andina e Cone Sul", sourceNote: "Carbunclo ou carbúnculo aparece em relatos com formas animais diferentes, sempre ligado a brilho e tesouro.", adaptation: "Usa um pequeno quadrúpede com gema luminosa e mantém a aparência variável como parte do bestiário." },
    regionId: "runic", element: "spirit", traits: ["luminoso", "tesouro", "esquivo"], rarity: "rare", role: "skirmisher",
    hp: 108, defense: 46, speed: 92, moves: ["Clarão da Gema", "Rastro Precioso", "Tesouro do Carbunclo"],
    obtainableBy: "Minas antigas das Montanhas Rúnicas", spriteIndex: 24,
  },
];

export const CREATURES: CreatureDefinition[] = seeds.map(({ moves, spriteIndex, ...seed }) => {
  const completeSeed = { ...seed, moves, spriteIndex } as CreatureSeed;
  return {
    ...seed,
    attacks: attackFactory[seed.element](completeSeed),
    sprite: {
      sheet: SPRITE_SHEET,
      column: spriteIndex % SPRITE_COLUMNS,
      row: Math.floor(spriteIndex / SPRITE_COLUMNS),
      columns: SPRITE_COLUMNS,
      rows: SPRITE_ROWS,
    },
  };
});

export const CREATURE_BY_ID = new Map(CREATURES.map((creature) => [creature.id, creature]));

export const STARTER_TEAM_IDS = ["boitata", "iara", "curupira", "saci-perere", "black-shuck", "boto-cor-de-rosa"] as const;
export const NPC_TEAM_IDS = ["mula-sem-cabeca", "kappa", "mapinguari", "raiju", "domovoi", "qilin"] as const;
