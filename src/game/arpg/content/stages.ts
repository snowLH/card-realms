import type { ArpgExpeditionId } from "./expeditions";
import type { DungeonGraph } from "../dungeon/types";
import { computeRoomDistances } from "../dungeon/graph";

export type ArpgStageDefinition = {
  index: number;
  total: number;
  id: string;
  name: string;
  subtitle: string;
  description: string;
  folkloreQuote: string;
  accentColor: string;
  badge: string;
  environmentalDetail: string;
};

export const EXPEDITION_STAGES: Record<ArpgExpeditionId, ArpgStageDefinition[]> = {
  "mata-encantada": [
    {
      index: 1,
      total: 3,
      id: "mata-borda",
      name: "Borda da Mata",
      subtitle: "Clareiras & Trilhas Vivas",
      description: "O ar ainda recebe a luz do sol entre as copas. Brotos e espíritos menores guardam os primeiros caminhos da floresta.",
      folkloreQuote: "Abra os olhos: onde a folha cai ao contrário, o rastro do Curupira começa.",
      accentColor: "#78a95d",
      badge: "Zona 1/3",
      environmentalDetail: "Trilhas de terra batida, folhas secas e brotos silvestres",
    },
    {
      index: 2,
      total: 3,
      id: "mata-boitata",
      name: "Travessia do Boitatá",
      subtitle: "Margens Pantanosas & Leito Fluvial",
      description: "Águas escuras cortam a floresta. O calor sobrenatural do Boitatá ainda queima nas pedras ribeirinhas.",
      folkloreQuote: "Não olhe fixo para a serpente de fogo; avance pelas pedras firmes sobre a correnteza.",
      accentColor: "#4f7d8c",
      badge: "Zona 2/3",
      environmentalDetail: "Cursos de água mística, pontes de troncos e terreno alagado",
    },
    {
      index: 3,
      total: 3,
      id: "mata-raizes",
      name: "Santuário das Raízes",
      subtitle: "Ruínas Ancestrais & Bosque Profundo",
      description: "Raízes seculares envolvem pedras talhadas por povos esquecidos. As sombras guardam o portal para o Guardião Ancestral.",
      folkloreQuote: "O coração da mata protege seus segredos com espinhos e silêncio milenar.",
      accentColor: "#4a6b42",
      badge: "Zona 3/3",
      environmentalDetail: "Ruínas cobertas de musgo, raízes monumentais e pedras sagradas",
    },
    {
      index: 4,
      total: 3,
      id: "mata-arena",
      name: "Clareira do Curupira",
      subtitle: "Coração da Mata · Arena Ancestral",
      description: "O guardião milenar aguarda em seu círculo sagrado. Restaure a memória do protetor das matas.",
      folkloreQuote: "Restaure a lenda antes que a floresta esqueça sua própria voz.",
      accentColor: "#e28241",
      badge: "Confronto Final",
      environmentalDetail: "Círculo de fogo fátuo e arena ancestral do Curupira",
    },
  ],
  "arquipelago-das-mares": [
    {
      index: 1,
      total: 3,
      id: "mares-costa",
      name: "Costa dos Corais",
      subtitle: "Praias Claras & Bancos de Areia",
      description: "O mar banha as primeiras ilhotas. Botos-cor-de-rosa observam com curiosidade e desafio entre as ondas.",
      folkloreQuote: "A maré traz mistérios das profundezas antes mesmo que os barcos possam ancorar.",
      accentColor: "#5da9a3",
      badge: "Zona 1/3",
      environmentalDetail: "Bancos de areia dourada, conchas e águas cristalinas",
    },
    {
      index: 2,
      total: 3,
      id: "mares-ilhotas",
      name: "Ilhotas Inundadas",
      subtitle: "Manguezais & Canais Traiçoeiros",
      description: "A maré sobe veloz por canais sinuosos. Kappas protegem seus pequenos altares de pedra lisa contra invasores.",
      folkloreQuote: "Respeite as águas rasas, ou a correnteza o levará para além do horizonte.",
      accentColor: "#3e7b99",
      badge: "Zona 2/3",
      environmentalDetail: "Canais de maré, pontões de madeira e manguezais densos",
    },
    {
      index: 3,
      total: 3,
      id: "mares-fossa",
      name: "Fossa das Tempestades",
      subtitle: "Recifes Profundos & Naufrágios",
      description: "Águas agitadas por tempestades mágicas. Kelpies e Ahuízotls guardam o redemoinho que desce ao santuário.",
      folkloreQuote: "Nas profundezas do vórtice, ouve-se o chamado das antigas marés.",
      accentColor: "#2d5475",
      badge: "Zona 3/3",
      environmentalDetail: "Recifes afiados, destroços navais e redemoinhos místicos",
    },
    {
      index: 4,
      total: 3,
      id: "mares-arena",
      name: "Santuário das Profundezas",
      subtitle: "Palácio Submerso · Trono da Iara",
      description: "O canto hipnótico ressoa das águas profundas do palácio de coral. Liberte a Iara da corrupção.",
      folkloreQuote: "A beleza do canto das águas é eterna quando livre da mágoa.",
      accentColor: "#61a7c7",
      badge: "Confronto Final",
      environmentalDetail: "Palácio de coral submerso e fonte das marés",
    },
  ],
  "montanhas-runicas": [
    {
      index: 1,
      total: 3,
      id: "runic-passagem",
      name: "Passagem dos Pinheiros",
      subtitle: "Encostas Nevadas & Trilhas do Ratatoskr",
      description: "Ventos cortantes agitam as coníferas cobertas de neve. Criaturas velozes saltam entre os galhos gelados.",
      folkloreQuote: "Nas alturas, o vento repete as mensagens que os deuses esqueceram.",
      accentColor: "#8da3b8",
      badge: "Zona 1/3",
      environmentalDetail: "Encostas de neve compacta, pinheiros e rochas escuras",
    },
    {
      index: 2,
      total: 3,
      id: "runic-glaciares",
      name: "Desfiladeiro dos Glaciares",
      subtitle: "Fendas de Gelo & Cavernas Cristalinas",
      description: "Paredões translúcidos de gelo milenar onde faíscas de Raijū e o brilho do Carbunclo se refletem.",
      folkloreQuote: "O gelo preserva a memória do trovão e a faísca da terra.",
      accentColor: "#6c8ea8",
      badge: "Zona 2/3",
      environmentalDetail: "Placas de gelo escorregadias, cavernas de cristal e fendas profundas",
    },
    {
      index: 3,
      total: 3,
      id: "runic-muralhas",
      name: "Muralhas Esquecidas",
      subtitle: "Bastiões Arruinados de Camelot",
      description: "Restos da fortaleza mítica congelados no tempo. Yetis e espectros guardam a passagem para o grande salão.",
      folkloreQuote: "Mesmo sob o gelo da montanha, a honra de uma távola antiga recusa-se a perecer.",
      accentColor: "#7e6d9b",
      badge: "Zona 3/3",
      environmentalDetail: "Muralhas de cantaria com glifos arcaicos e sentinelas de pedra",
    },
    {
      index: 4,
      total: 3,
      id: "runic-arena",
      name: "Trono do Rei Caído",
      subtitle: "O Salão Congelado de Arthur",
      description: "O Rei Arthur repete em delírio sua última batalha. Faça a lenda recordar seu verdadeiro juramento.",
      folkloreQuote: "Desperte o rei de seu longo inverno.",
      accentColor: "#b1a4c5",
      badge: "Confronto Final",
      environmentalDetail: "Salão monumental da Távola Redonda congelada no tempo",
    },
  ],
};

export function getExpeditionStages(regionId: string): ArpgStageDefinition[] {
  const stages = EXPEDITION_STAGES[regionId as ArpgExpeditionId];
  if (stages) return stages;
  return EXPEDITION_STAGES["mata-encantada"];
}

export function getRoomStage(graph: DungeonGraph, roomId: string): ArpgStageDefinition {
  const stages = getExpeditionStages(graph.regionId);
  if (roomId === graph.bossRoomId) {
    return stages[stages.length - 1];
  }

  const distances = computeRoomDistances(graph);
  const ordinaryRooms = Object.values(graph.rooms)
    .filter((room) => room.id !== graph.bossRoomId)
    .sort((a, b) => {
      const distA = distances.get(a.id) ?? 0;
      const distB = distances.get(b.id) ?? 0;
      if (distA !== distB) return distA - distB;
      return a.id.localeCompare(b.id);
    });

  const totalOrdinary = ordinaryRooms.length;
  if (totalOrdinary === 0) return stages[0];

  const roomIndex = ordinaryRooms.findIndex((room) => room.id === roomId);
  if (roomIndex === -1) return stages[0];

  // Distribute rooms evenly across the 3 sequential zones
  const tier1Cutoff = Math.max(1, Math.floor(totalOrdinary / 3));
  const tier2Cutoff = Math.max(tier1Cutoff + 1, Math.floor((2 * totalOrdinary) / 3));

  if (roomIndex < tier1Cutoff) {
    return stages[0]; // Zona 1
  }
  if (roomIndex < tier2Cutoff) {
    return stages[1]; // Zona 2
  }
  return stages[2]; // Zona 3
}
