import type { CultureId, WeatherEffectId } from "../domain/types";
import type { AiProfile } from "../gameplay/ai-strategist";

export type CampaignChapter = {
  chapterIndex: number;
  title: string;
  realmName: string;
  countryLabel: string;
  opponentName: string;
  opponentTitle: string;
  opponentCulture: CultureId;
  aiProfile: AiProfile;
  initialWeather: WeatherEffectId;
  prologue: string;
  victoryQuote: string;
  rewardCardIds: readonly [string, string, string];
};

export const CAMPAIGN_CHAPTERS: readonly CampaignChapter[] = [
  {
    chapterIndex: 1,
    title: "Capítulo I — O Despertar de Pindorama",
    realmName: "Floresta Ancestral de Pindorama",
    countryLabel: "Brasil",
    opponentName: "Curupira Guardião",
    opponentTitle: "Senhor dos Rastros Invertidos",
    opponentCulture: "brasil",
    aiProfile: "defensive",
    initialWeather: "chuva-ancestral",
    prologue:
      "Nas profundezas das matas brasileiras, raízes vivas começam a pulsar com o Sopro Ancestral. O Curupira testa a sabedoria dos estrategistas antes de conceder a benção da floresta.",
    victoryQuote:
      "A floresta reconheceu seu valor! Os caminhos antes desorientados agora se abrem para os seus exércitos folclóricos.",
    rewardCardIds: ["legend-curupira", "legend-iara", "territory-mata-profunda"],
  },
  {
    chapterIndex: 2,
    title: "Capítulo II — O Santuário dos Mil Yōkai",
    realmName: "Ilhas Espirituais do Sol Nascente",
    countryLabel: "Japão",
    opponentName: "Kitsune de Nove Caudas",
    opponentTitle: "Tecelã das Ilusões Místicas",
    opponentCulture: "japao",
    aiProfile: "strategic",
    initialWeather: "brumas-espirituais",
    prologue:
      "Atravessando o grande oceano, você alcança um santuário oculto por névoas violetas. A Kitsune surge entre chamas kitsunebi, prometendo metamorfosear a própria realidade da mesa.",
    victoryQuote:
      "O véu de ilusão foi dissipado pela sua disciplina tática! As lendas do arquipélago curvam-se diante da sua astúcia.",
    rewardCardIds: ["legend-kitsune", "legend-tengu", "structure-portao-torii"],
  },
  {
    chapterIndex: 3,
    title: "Capítulo III — Os Picos Gélidos de Niflheim",
    realmName: "Fjords Congelados de Yggdrasil",
    countryLabel: "Escandinávia",
    opponentName: "Jötunn Yeti",
    opponentTitle: "Colosso das Neves Eternas",
    opponentCulture: "nordico",
    aiProfile: "defensive",
    initialWeather: "nevasca-glacial",
    prologue:
      "O ar congela instantaneamente quando seus passos tocam as tundras do norte. O imenso Jötunn Yeti ergue muralhas de gelo ancestral para esmagar qualquer invasor dos Nove Reinos.",
    victoryQuote:
      "O trono rúnico vibra com o estrondo da sua vitória! Os segredos do Fimbulwinter e as runas sagradas agora servem ao seu reino.",
    rewardCardIds: ["legend-amarok", "legend-ratatoskr", "event-fimbulwinter"],
  },
  {
    chapterIndex: 4,
    title: "Capítulo IV — As Dunas Sagradas de Kemet",
    realmName: "Deserto Sagrado do Nilo Eterno",
    countryLabel: "Egito",
    opponentName: "Esfinge Guardiã",
    opponentTitle: "Julgadora dos Sete Enigmas",
    opponentCulture: "egito",
    aiProfile: "adaptive",
    initialWeather: "sol-escaldante",
    prologue:
      "O calor abrasador do deserto queima a areia aos pés dos monumentos milenares. A Esfinge bloqueia a passagem com um enigma de vida e morte: apenas quem domina a pesagem das almas avançará.",
    victoryQuote:
      "Sua alma foi pesada contra a pena da verdade e considerada digna! O ouro dos templos e a proteção dos deuses do sol coroam sua jornada.",
    rewardCardIds: ["legend-esfinge", "legend-ammit", "territory-deserto-sagrado"],
  },
  {
    chapterIndex: 5,
    title: "Capítulo V — O Panteão do Monte Olimpo",
    realmName: "Cumes Flamejantes do Monte Olimpo",
    countryLabel: "Grécia",
    opponentName: "Minotauro Enfurecido",
    opponentTitle: "Campeão das Lendas Primordiais",
    opponentCulture: "grecia",
    aiProfile: "aggressive",
    initialWeather: "tempestade-de-raios",
    prologue:
      "A batalha final de reinos acontece nos cumes de mármore do Monte Olimpo. Entre relâmpagos e fogo da terra, o Minotauro e os campeões míticos desafiam seu exército pelo título supremo de Grão-Mestre das Lendas.",
    victoryQuote:
      "TRIUNFO SUPREMO! Você unificou as lendas dos cinco continentes sob o mesmo tabuleiro vivo! As Crônicas das Lendas cantarão suas glórias pela eternidade!",
    rewardCardIds: ["legend-fenix", "legend-minotauro", "event-ira-titas"],
  },
];

export function getCampaignChapter(chapterIndex: number): CampaignChapter {
  return (
    CAMPAIGN_CHAPTERS.find((ch) => ch.chapterIndex === chapterIndex) ?? CAMPAIGN_CHAPTERS[0]
  );
}
