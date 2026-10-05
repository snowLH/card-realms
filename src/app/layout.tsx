import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import "./globals.css";
import "./game-ui.css";
import "./medieval-theme.css";
import "./mobile-pixel-overhaul.css";
import "./arpg.css";

export const metadata: Metadata = {
  title: "Card Realms — Mundo dos Colecionadores",
  description:
    "ARPG 2D de folclore com dungeons roguelite, cartas-habilidade, suportes, armas, loot e progressão online.",
  applicationName: "Card Realms",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Card Realms",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#18100f",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
