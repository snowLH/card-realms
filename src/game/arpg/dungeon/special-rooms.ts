import type { DungeonRoomType } from "./types";

export type SpecialRoomChoiceId =
  | "rest-heal"
  | "rest-speed"
  | "rest-focus"
  | "event-risk"
  | "event-safe"
  | "shop-heal"
  | "shop-power"
  | "shop-speed"
  | "shop-leave";

export type SpecialRoomOption = {
  id: SpecialRoomChoiceId;
  label: string;
  description: string;
  costShards: number;
};

export type SpecialRoomEncounter = {
  type: "rest" | "event" | "shop";
  title: string;
  description: string;
  options: SpecialRoomOption[];
};
export type SpecialRoomResolution = {
  hpDelta: number;
  shardsDelta: number;
  moveSpeedBonus: number;
  basicDamageMultiplier: number;
  message: string;
};

export const SPECIAL_ROOM_INTERACTION_RADIUS = 128;

export function isWithinSpecialRoomInteractionRange(
  playerX: number,
  playerY: number,
  targetX: number,
  targetY: number,
  radius = SPECIAL_ROOM_INTERACTION_RADIUS,
) {
  return [playerX, playerY, targetX, targetY, radius].every(Number.isFinite)
    && radius >= 0
    && Math.hypot(playerX - targetX, playerY - targetY) <= radius;
}

const REST_OPTIONS: SpecialRoomOption[] = [
  { id: "rest-heal", label: "Descansar", description: "Recupere 35 HP.", costShards: 0 },
  { id: "rest-speed", label: "Alongar e seguir", description: "+16 velocidade pelo restante da run.", costShards: 0 },
  { id: "rest-focus", label: "Meditar", description: "+8% dano básico pelo restante da run.", costShards: 0 },
];

function getRestOptions(regionId: string): SpecialRoomOption[] {
  if (regionId === "mata-encantada") {
    return [
      { id: "rest-heal", label: "Bálsamo da Mata", description: "Recupere 35 HP com ervas medicinais da floresta.", costShards: 0 },
      { id: "rest-speed", label: "Passos da Caipora", description: "+16 velocidade pelo restante da run.", costShards: 0 },
      { id: "rest-focus", label: "Meditação das Raízes", description: "+8% dano básico pelo restante da run.", costShards: 0 },
    ];
  }
  if (regionId === "arquipelago-das-mares") {
    return [
      { id: "rest-heal", label: "Banho de Nascente", description: "Recupere 35 HP em águas límpidas de maré.", costShards: 0 },
      { id: "rest-speed", label: "Brisa do Litoral", description: "+16 velocidade pelo restante da run.", costShards: 0 },
      { id: "rest-focus", label: "Ressonância das Conchas", description: "+8% dano básico pelo restante da run.", costShards: 0 },
    ];
  }
  if (regionId === "montanhas-runicas") {
    return [
      { id: "rest-heal", label: "Fogueira dos Picos", description: "Recupere 35 HP ao abrigo do vento gelado.", costShards: 0 },
      { id: "rest-speed", label: "Vento das Alturas", description: "+16 velocidade pelo restante da run.", costShards: 0 },
      { id: "rest-focus", label: "Foco no Cristal", description: "+8% dano básico pelo restante da run.", costShards: 0 },
    ];
  }
  return REST_OPTIONS;
}

const SHOP_OPTIONS: SpecialRoomOption[] = [
  { id: "shop-heal", label: "Tônico de viagem", description: "Recupere 30 HP.", costShards: 10 },
  { id: "shop-power", label: "Afiar equipamento", description: "+15% dano básico pelo restante da run.", costShards: 16 },
  { id: "shop-speed", label: "Botas de viagem", description: "+12 velocidade pelo restante da run.", costShards: 12 },
  { id: "shop-leave", label: "Seguir viagem", description: "Não comprar nada.", costShards: 0 },
];

export function getRunShardReward(rewardXp: number) {
  return Math.max(1, Math.round(rewardXp / 5));
}
export function getSpecialRoomEncounter(regionId: string, type: DungeonRoomType, stageIndex?: number): SpecialRoomEncounter | null {
  if (type === "rest") {
    let title: string;
    if (stageIndex === 1) {
      title = regionId === "arquipelago-das-mares" ? "Banco de areia dos corais" : regionId === "montanhas-runicas" ? "Refúgio da encosta" : "Clareira da borda";
    } else if (stageIndex === 2) {
      title = regionId === "arquipelago-das-mares" ? "Manguezal abrigado" : regionId === "montanhas-runicas" ? "Caverna dos ventos gelados" : "Remanso do Boitatá";
    } else if (stageIndex !== undefined && stageIndex >= 3) {
      title = regionId === "arquipelago-das-mares" ? "Recife das profundezas" : regionId === "montanhas-runicas" ? "Templo do platô rúnico" : "Santuário das raízes antigas";
    } else {
      title = regionId === "arquipelago-das-mares" ? "Banco de areia tranquilo" : regionId === "montanhas-runicas" ? "Abrigo das lanternas" : "Clareira de descanso";
    }
    return {
      type,
      title,
      description: "A sala está segura. Escolha como preparar o restante da expedição.",
      options: getRestOptions(regionId),
    };
  }
  if (type === "shop") {
    let title: string;
    if (stageIndex === 1) {
      title = regionId === "arquipelago-das-mares" ? "Barcaça da costa" : regionId === "montanhas-runicas" ? "Posto dos batedores" : "Mochileiro da borda";
    } else if (stageIndex === 2) {
      title = regionId === "arquipelago-das-mares" ? "Mercado flutuante" : regionId === "montanhas-runicas" ? "Tenda entre as neves" : "Mercador canoeiro do rio";
    } else if (stageIndex !== undefined && stageIndex >= 3) {
      title = regionId === "arquipelago-das-mares" ? "Empório dos naufrágios" : regionId === "montanhas-runicas" ? "Mercador dos cristais" : "Guardião dos vestígios";
    } else {
      title = regionId === "arquipelago-das-mares" ? "Mercado flutuante" : regionId === "montanhas-runicas" ? "Tenda entre as neves" : "Mercador eremita";
    }
    return {
      type,
      title,
      description: "Fragmentos desta run podem ser trocados aqui. Nada é cobrado das moedas permanentes.",
      options: SHOP_OPTIONS,
    };
  }
  if (type !== "event") return null;
  const mares = regionId === "arquipelago-das-mares";
  const runic = regionId === "montanhas-runicas";

  let title: string;
  let description: string;
  if (stageIndex === 1) {
    title = mares ? "Vozes entre os corais" : runic ? "Ecos da encosta" : "Círculo de brotos silvestres";
    description = mares ? "A maré baixa revela conchas ancestrais vibrando em harmonia." : runic ? "O vento na montanha sopra melodias esquecidas pelas pedras." : "Pequenos brotos dançam em círculo ao redor de uma oferenda da floresta.";
  } else if (stageIndex === 2) {
    title = mares ? "Canto entre as marés" : runic ? "Oráculo da nevasca" : "Fogo fátuo sobre o rio";
    description = mares ? "Uma voz chama por entre a água escura." : runic ? "Runas antigas cintilam sob a neve. O vento exige uma escolha." : "Chamas sobrenaturais do Boitatá flutuam sobre as pedras da correnteza.";
  } else if (stageIndex !== undefined && stageIndex >= 3) {
    title = mares ? "Vórtice da fossa profunda" : runic ? "Monólito das tempestades rúnicas" : "Altar de raízes invertidas";
    description = mares ? "As águas abissais giram em torno de um altar afundado." : runic ? "A eletricidade rúnica reverbera no ar rarefeito do platô." : "Os rastros ao redor do altar apontam em direções impossíveis.";
  } else {
    title = mares ? "Canto entre as marés" : runic ? "Oráculo da nevasca" : "Altar de raízes invertidas";
    description = mares ? "Uma voz chama por entre a água escura." : runic ? "Runas antigas cintilam sob a neve. O vento exige uma escolha." : "Os rastros ao redor do altar apontam em direções impossíveis.";
  }

  return {
    type,
    title,
    description,
    options: [
      { id: "event-risk", label: mares ? "Seguir o canto" : runic ? "Atravessar o gelo" : "Tocar o altar", description: mares ? "-10 HP · +20 fragmentos" : runic ? "-14 HP · +22 fragmentos" : "-12 HP · +18 fragmentos", costShards: 0 },
      { id: "event-safe", label: mares ? "Recolher oferendas" : runic ? "Consultar as runas" : "Contornar em silêncio", description: mares ? "+7 fragmentos" : runic ? "+8 fragmentos" : "+6 fragmentos", costShards: 0 },
    ],
  };
}
export function resolveSpecialRoomChoice(
  regionId: string,
  choiceId: SpecialRoomChoiceId,
): SpecialRoomResolution {
  if (choiceId === "rest-heal") return { hpDelta: 35, shardsDelta: 0, moveSpeedBonus: 0, basicDamageMultiplier: 1, message: "Você recuperou o fôlego antes de seguir." };
  if (choiceId === "rest-speed") return { hpDelta: 0, shardsDelta: 0, moveSpeedBonus: 16, basicDamageMultiplier: 1, message: "Seus passos ficaram mais leves pelo restante da run." };
  if (choiceId === "rest-focus") return { hpDelta: 0, shardsDelta: 0, moveSpeedBonus: 0, basicDamageMultiplier: 1.08, message: "Você refinou sua técnica durante a meditação." };
  if (choiceId === "shop-heal") return { hpDelta: 30, shardsDelta: -10, moveSpeedBonus: 0, basicDamageMultiplier: 1, message: "O tônico restaurou sua vitalidade." };
  if (choiceId === "shop-power") return { hpDelta: 0, shardsDelta: -16, moveSpeedBonus: 0, basicDamageMultiplier: 1.15, message: "Seu equipamento foi afiado para o restante da run." };
  if (choiceId === "shop-speed") return { hpDelta: 0, shardsDelta: -12, moveSpeedBonus: 12, basicDamageMultiplier: 1, message: "As novas botas facilitam a travessia da dungeon." };
  if (choiceId === "shop-leave") return { hpDelta: 0, shardsDelta: 0, moveSpeedBonus: 0, basicDamageMultiplier: 1, message: "Você deixou o mercador e seguiu viagem." };
  if (choiceId === "event-risk") {
    return regionId === "arquipelago-das-mares"
      ? { hpDelta: -10, shardsDelta: 20, moveSpeedBonus: 0, basicDamageMultiplier: 1, message: "O canto cobrou seu preço, mas revelou fragmentos escondidos." }
      : regionId === "montanhas-runicas"
        ? { hpDelta: -14, shardsDelta: 22, moveSpeedBonus: 0, basicDamageMultiplier: 1, message: "O gelo feriu você, mas revelou um cofre rúnico." }
        : { hpDelta: -12, shardsDelta: 18, moveSpeedBonus: 0, basicDamageMultiplier: 1, message: "O altar feriu você, mas liberou fragmentos antigos." };
  }
  if (choiceId !== "event-safe") throw new Error("Escolha desconhecida para sala especial.");
  return regionId === "arquipelago-das-mares"
    ? { hpDelta: 0, shardsDelta: 7, moveSpeedBonus: 0, basicDamageMultiplier: 1, message: "Você recolheu oferendas deixadas pelas águas." }
    : regionId === "montanhas-runicas"
      ? { hpDelta: 0, shardsDelta: 8, moveSpeedBonus: 0, basicDamageMultiplier: 1, message: "Runas preservadas no gelo revelaram fragmentos valiosos." }
      : { hpDelta: 0, shardsDelta: 6, moveSpeedBonus: 0, basicDamageMultiplier: 1, message: "Você contornou o altar e encontrou fragmentos pelo caminho." };
}
