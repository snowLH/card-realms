import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sources(path) : /\.(?:ts|tsx|css)$/.test(path) && !/\.test\./.test(path) ? [path] : [];
  });
}

const prohibited = [
  /\b(?:add|make)\.(?:graphics|rectangle|circle|ellipse|polygon|triangle)\s*\(/g,
  /\b(?:Phaser\.)?GameObjects\.(?:Graphics|Rectangle|Ellipse|Arc|Polygon|Triangle)\b/g,
  /\b(?:fillRect|fillCircle|fillEllipse|fillTriangle|fillPoints|strokeRect|strokeCircle|strokeEllipse|strokeRoundedRect|fillRoundedRect|lineBetween|strokePoints|putImageData|createCanvas|generateTexture)\s*\(/g,
  /<\s*(?:svg|rect|circle|ellipse|polygon|path|line)(?=[\s/>])/g,
  /(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(/g,
  /from\s+["']lucide-react["']/g,
  /\b(?:bg-(?!transparent\b)[\w[\]()/%.#-]+|rounded-[\w-]+|shadow-(?:sm|md|lg|xl|2xl)|ring-(?:\d|ring|offset))/g,
  /(?<![-\w])background(?:-color)?\s*:\s*(?:#[\da-fA-F]+|rgba?\(|hsla?\()/g,
  /\b(?:background|backgroundColor)\s*:\s*["'](?:#[\da-fA-F]+|rgba?\((?!0,\s*0,\s*0,\s*0\))|hsla?\()/g,
  /[▲▼◀▶►◄●○◯◆◇■□△▽]/g,
  /\b(?:arc|ellipse|beginPath|moveTo|lineTo|stroke|fillPath|strokePath)\s*\(/g,
];

describe("visible art must be authored", () => {
  it("rejects drawing surfaces, geometric art, SVG shapes, gradients and vector icons in production source", () => {
    const violations: string[] = [];
    for (const file of [...sources(join(process.cwd(), "src")), join(process.cwd(), "public/offline.html")]) {
      const path = relative(process.cwd(), file).replaceAll("\\", "/");
      let source = readFileSync(file, "utf8");
      // Text rulers belong exclusively to development. Their colored debug
      // backplates must remain behind these explicit production guards.
      if (path === "src/game/arpg/runtime/dungeon-scene.ts") {
        for (const method of ["createVisualReferenceOverlay", "createDungeonDebugOverlay"]) {
          expect(source).toMatch(new RegExp(`private ${method}\\(\\) \\{\\s*if\\(process\\.env\\.NODE_ENV === "production"\\)return;`));
        }
        source=source.replace('backgroundColor: "#172019e8"', 'DEV_RULER_BACKPLATE');
        source=source.replace('backgroundColor: "#11180ddd"', 'DEV_DEBUG_BACKPLATE');
      }
      // The sole technical exemption is the off-display-list mathematical arc
      // mask. Its white mask surface is never rendered as an appearance.
      if (path === "src/game/arpg/art/invisible-hazard-mask.ts") {
        expect(source).toContain("geometry.setVisible(false)");
        expect(source).toContain("geometry.createGeometryMask()");
        expect(source).not.toContain("scene.add");
        expect(source.match(/scene\.make\.graphics/g)).toHaveLength(1);
        expect(source).toContain("scene.make.graphics({x:0,y:0},false)");
        source = source.replace("scene.make.graphics({x:0,y:0},false)", "INVISIBLE_MASK_SURFACE");
        source = source.replace("geometry.slice(x,y,radius,angle-arc/2,angle+arc/2,false).fillPath()", "INVISIBLE_ARC_MASK");
      }
      if (file.endsWith(".css") || file.endsWith(".html")) {
        for (const match of source.matchAll(/(?<![-\w])(border(?:-(?:top|right|bottom|left|color))?|outline(?:-color)?|box-shadow|text-shadow|border-radius)\s*:\s*([^;{}]+)/g)) {
          const [,property,value]=match;
          const invisible=/(?:^|\s)(?:none|0(?:px)?|transparent)(?:\s|$)/.test(value.trim());
          if (!invisible) violations.push(`${path}: visible CSS ${property}: ${value.trim()}`);
        }
      }
      for (const pattern of prohibited) {
        for (const match of source.matchAll(pattern)) {
          const line = source.slice(0, match.index).split("\n").length;
          violations.push(`${path}:${line}: ${match[0]}`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });
});
