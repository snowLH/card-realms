import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import "./globals.css";
import "./game-ui.css";
import "./medieval-theme.css";
import "./mobile-pixel-overhaul.css";
import "./arpg.css";
import "./folklard-art-pass.css";
import "./arpg-raid.css";
import "./dungeon-mobile-fixes.css";

export const metadata: Metadata = {
  title: "Folklard — Crônicas de Aurória",
  description:
    "ARPG 2D de folclore com avatar próprio, dois poderes e expedições em masmorras.",
  applicationName: "Folklard",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Folklard",
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
  themeColor: "#071616",
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
