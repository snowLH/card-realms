import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Card Realms — Folklore ARPG",
    short_name: "Card Realms",
    description: "ARPG 2D de folclore com dungeons roguelite, cartas-habilidade, suportes e loot.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b100d",
    theme_color: "#18100f",
    orientation: "landscape",
    categories: ["games", "entertainment"],
    lang: "pt-BR",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/card-realms-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/card-realms-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/card-realms-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
