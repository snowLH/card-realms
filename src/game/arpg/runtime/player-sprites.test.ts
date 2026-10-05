import { describe, expect, it } from "vitest";
import type { AvatarConfig } from "@/game/save/local-progress";
import { createCartographerAvatarSpritesheet } from "./player-sprites";

describe("Cartographer avatar spritesheet", () => {
  it("builds the animated 4×11 sheet from the selected avatar config", () => {
    const avatar: AvatarConfig = {
      skin: "rose",
      hair: "mohawk",
      outfit: "scholar",
      armor: "guardian",
      accent: "crimson",
    };
    const url = createCartographerAvatarSpritesheet(avatar);
    const svg = decodeURIComponent(url.slice(url.indexOf(",") + 1));

    expect(url).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(svg).toContain('width="756" height="2079"');
    expect(svg.match(/<ellipse cx="94" cy="158"/g)).toHaveLength(44);
    expect(svg).toContain("#edb6a2");
    expect(svg).toContain("#292027");
    expect(svg).toContain("#ec6671");
  });
});
