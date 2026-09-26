import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Card Realms — Mundo dos Colecionadores",
    short_name: "Card Realms",
    description: "RPG online 2D de cartas, exploração e criaturas inspiradas em folclores do mundo.",
    start_url: "/",
    display: "standalone",
    background_color: "#07101d",
    theme_color: "#08111f",
    orientation: "any",
    categories: ["games", "entertainment"],
    lang: "pt-BR",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
