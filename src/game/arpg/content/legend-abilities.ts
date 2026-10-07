import type { Element } from "@/game/types";

/** Two permanent, exclusive attacks per legend. Legacy IDs only select combat templates. */
export const LEGEND_ABILITY_DEFINITIONS = [
  { legendId: "curupira", id: "curupira-root-snare", templateId: "ancestral-roots", name: "Raízes do Curupira", description: "Curupira ergue raízes no ponto mirado para ferir e prender os invasores.", element: "nature" },
  { legendId: "curupira", id: "curupira-ember-arrow", templateId: "boitata-flame", name: "Flecha de Brasa", description: "Curupira dispara uma flecha de brasa que atravessa os inimigos em linha reta.", element: "fire" },
  { legendId: "iara", id: "iara-enchanting-song", templateId: "iara-song", name: "Canto Encantado da Iara", description: "Iara canta uma melodia que fere e interrompe inimigos próximos.", element: "water" },
  { legendId: "iara", id: "iara-living-spring", templateId: "simurgh-renewal", name: "Fonte Viva da Iara", description: "Iara envolve o corpo em água viva, recuperando vida para voltar ao combate.", element: "water" },
  { legendId: "boto", id: "boto-river-whirl", templateId: "saci-whirlwind", name: "Giro do Boto", description: "Boto gira numa onda do rio que atinge as criaturas ao seu redor.", element: "water" },
  { legendId: "boto", id: "boto-tidal-trick", templateId: "kelpie-surge", name: "Truque da Maré", description: "Boto cria uma armadilha de correnteza no ponto mirado para surpreender e prender seus alvos.", element: "water" },
  { legendId: "kappa", id: "kappa-shell-surge", templateId: "kappa-splash", name: "Impacto do Casco", description: "Kappa golpeia o chão e lança uma onda curta ao redor de seu casco.", element: "water" },
  { legendId: "kappa", id: "kappa-river-bind", templateId: "kelpie-surge", name: "Laço do Kappa", description: "Kappa fecha um laço de água sobre o alvo, causando dano e impedindo sua fuga.", element: "water" },
  { legendId: "raiju", id: "raiju-thunder-field", templateId: "roc-horizon-storm", name: "Campo de Trovão", description: "Raiju descarrega uma tempestade no ponto mirado, ferindo e paralisando os inimigos.", element: "storm" },
  { legendId: "raiju", id: "raiju-lightning-fang", templateId: "boitata-flame", name: "Presa Relâmpago", description: "Raiju lança uma presa elétrica que atravessa os adversários em linha reta.", element: "storm" },
  { legendId: "amarok", id: "amarok-moon-howl", templateId: "banshee-wail", name: "Uivo da Lua", description: "Amarok solta um uivo que fere e paralisa as presas ao seu redor.", element: "spirit" },
  { legendId: "amarok", id: "amarok-night-hunt", templateId: "medusa-gaze", name: "Caçada Noturna", description: "Amarok marca uma área com garras espirituais que ferem e imobilizam suas presas.", element: "spirit" },
  { legendId: "kelpie", id: "kelpie-drowning-reins", templateId: "kelpie-surge", name: "Rédeas da Correnteza", description: "Kelpie prende seus alvos em rédeas de água no ponto mirado.", element: "water" },
  { legendId: "kelpie", id: "kelpie-mist-call", templateId: "iara-song", name: "Chamado da Bruma", description: "Kelpie libera um chamado entre as brumas que fere e interrompe inimigos próximos.", element: "water" },
  { legendId: "mapinguari", id: "mapinguari-earth-grip", templateId: "medusa-gaze", name: "Garra da Terra", description: "Mapinguari fecha a terra ao redor de seus alvos, causando dano e imobilizando-os.", element: "nature" },
  { legendId: "mapinguari", id: "mapinguari-forest-crush", templateId: "kraken-grasp", name: "Esmagamento da Mata", description: "Mapinguari faz raízes pesadas esmagarem e prenderem os inimigos na área escolhida.", element: "nature" },
  { legendId: "ahuizotl", id: "ahuizotl-tail-grasp", templateId: "kraken-grasp", name: "Mão da Cauda", description: "Ahuizotl projeta a mão de sua cauda sobre o alvo, prendendo e esmagando a área.", element: "water" },
  { legendId: "ahuizotl", id: "ahuizotl-river-ambush", templateId: "kelpie-surge", name: "Emboscada da Margem", description: "Ahuizotl prepara uma emboscada de água que fere e segura as presas no ponto mirado.", element: "water" },
  { legendId: "ratatoskr", id: "ratatoskr-acorn-shot", templateId: "caipora-arrow", name: "Bolota Certeira", description: "Ratatoskr arremessa uma bolota encantada num disparo rápido contra um alvo isolado.", element: "nature" },
  { legendId: "ratatoskr", id: "ratatoskr-branch-whirl", templateId: "saci-whirlwind", name: "Giro dos Ramos", description: "Ratatoskr agita folhas e ramos num giro que acerta as criaturas próximas.", element: "nature" },
  { legendId: "carbunclo", id: "carbunclo-gem-flare", templateId: "boitata-flame", name: "Clarão da Gema", description: "Carbunclo dispara um clarão ardente de sua gema que atravessa os inimigos.", element: "fire" },
  { legendId: "carbunclo", id: "carbunclo-gem-renewal", templateId: "simurgh-renewal", name: "Pulso da Gema", description: "Carbunclo faz sua gema pulsar e recupera a própria vida.", element: "spirit" },
  { legendId: "alicanto", id: "alicanto-golden-gale", templateId: "roc-horizon-storm", name: "Rajada Dourada", description: "Alicanto lança uma rajada de penas luminosas que fere e trava os alvos na área escolhida.", element: "storm" },
  { legendId: "alicanto", id: "alicanto-mineral-mending", templateId: "simurgh-renewal", name: "Vigor do Minério", description: "Alicanto transforma o brilho de suas penas em energia para restaurar a própria vida.", element: "spirit" },
  { legendId: "yeti", id: "yeti-frozen-roar", templateId: "banshee-wail", name: "Rugido Congelante", description: "Yeti solta um rugido gelado que fere e paralisa as criaturas ao redor.", element: "water" },
  { legendId: "yeti", id: "yeti-avalanche-stomp", templateId: "kappa-splash", name: "Pisada da Avalanche", description: "Yeti golpeia o chão com uma pisada que espalha gelo e atinge os inimigos próximos.", element: "water" },
] as const satisfies readonly {
  legendId: string;
  id: string;
  templateId: string;
  name: string;
  description: string;
  element: Element;
}[];
