import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("direct installation without app stores", () => {
  it("keeps the PWA installable as a standalone home-screen app", () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "public/manifest.webmanifest"), "utf8")) as {
      id?: string;
      scope?: string;
      start_url?: string;
      display?: string;
      display_override?: string[];
      prefer_related_applications?: boolean;
      icons?: Array<{ sizes?: string; purpose?: string }>;
    };

    expect(manifest.id).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.display_override).toContain("standalone");
    expect(manifest.prefer_related_applications).toBe(false);
    expect(manifest.icons?.some((icon) => icon.sizes === "192x192")).toBe(true);
    expect(manifest.icons?.some((icon) => icon.sizes === "512x512")).toBe(true);
    expect(manifest.icons?.some((icon) => icon.purpose === "maskable")).toBe(true);
  });

  it("keeps the install page explicitly store-free for the current distribution", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/instalar/page.tsx"), "utf8");
    expect(page).toContain("Sem App Store, Play Store ou Microsoft Store por enquanto.");
    expect(page).toContain("BAIXAR APK ANDROID");
    expect(page).toContain("BAIXAR PARA WINDOWS");
    expect(page).toContain("BAIXAR PARA LINUX");
    expect(page).toContain("ABRIR E INSTALAR NO IPHONE");
    expect(page).toContain("Adicionar à Tela de Início");
  });
});
