import type { Element } from "@/game/types";
import type { WeatherEffectId } from "./types";

export type WeatherDefinition = {
  id: WeatherEffectId;
  name: string;
  shortName: string;
  icon: string;
  tagline: string;
  description: string;
  favoredElement?: Element;
  attackBonusForFavored?: number;
  bonusTurnHealWater?: number;
  burnTurnEndNonFire?: boolean;
};

export const WEATHER_DEFINITIONS: Readonly<Record<WeatherEffectId, WeatherDefinition>> = {
  "clima-sereno": {
    id: "clima-sereno",
    name: "Clima Sereno",
    shortName: "Sereno",
    icon: "☀️",
    tagline: "Ventos tranquilos sopram sobre a arena das lendas.",
    description: "Sem alterações climáticas ativas. A batalha flui conforme a harmonia natural dos territórios.",
  },
  "chuva-ancestral": {
    id: "chuva-ancestral",
    name: "Chuva das Marés Ancestrais",
    shortName: "Chuva Mítica",
    icon: "🌧️",
    tagline: "Águas torrenciais inundam a arena restaurando espíritos aquáticos.",
    description: "Lendas de Água recebem +1 de cura no início do turno e terrenos de Rio se expandem com vigor.",
    favoredElement: "water",
    bonusTurnHealWater: 1,
  },
  "nevasca-glacial": {
    id: "nevasca-glacial",
    name: "Nevasca de Niflheim",
    shortName: "Nevasca",
    icon: "❄️",
    tagline: "Frio ártico e ventos cortantes congelam a terra.",
    description: "Lendas do Gelo ganham +1 de Escudo ao entrar em campo. Movimentação tática custa mais atenção.",
    favoredElement: "water",
  },
  "sol-escaldante": {
    id: "sol-escaldante",
    name: "Sol Sagrado de Rá e Tupã",
    shortName: "Sol Ardente",
    icon: "🔥",
    tagline: "Raios abrasadores incendeiam a terra e fortalecem criaturas ígneas.",
    description: "Lendas de Fogo recebem +1 ATQ em suas Investidas. Terra Vulcânica queima com fúria dobrada.",
    favoredElement: "fire",
    attackBonusForFavored: 1,
  },
  "brumas-espirituais": {
    id: "brumas-espirituais",
    name: "Brumas das Mil Almas",
    shortName: "Brumas Místicas",
    icon: "🌫️",
    tagline: "Vapores etéreos cobrem o tabuleiro ocultando lendas entre véus.",
    description: "Lendas de Espírito e Sombra ganham Véu de Ilusão ao serem invocadas, bloqueando o primeiro ataque recebido.",
    favoredElement: "spirit",
  },
  "tempestade-de-raios": {
    id: "tempestade-de-raios",
    name: "Tempestade do Trovão Primordial",
    shortName: "Tempestade",
    icon: "⚡",
    tagline: "Relâmpagos rasgam o céu e eletrificam o campo de batalha.",
    description: "Lendas de Tempestade recebem +1 ATQ. Ataques diretos ao Coração do Reino reverberam fagulhas elétricas.",
    favoredElement: "storm",
    attackBonusForFavored: 1,
  },
};

export function getWeatherDefinition(weather: WeatherEffectId): WeatherDefinition {
  return WEATHER_DEFINITIONS[weather] ?? WEATHER_DEFINITIONS["clima-sereno"];
}
