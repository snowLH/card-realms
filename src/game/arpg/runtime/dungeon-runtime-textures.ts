const TEXTURES = ["arpg-enemy","arpg-projectile","arpg-pixel-pulse","arpg-breakable-crate","arpg-breakable-vase","arpg-breakable-shrub","arpg-breakable-relic","arpg-run-fragment","arpg-loot-sword","arpg-loot-bow","arpg-loot-staff","arpg-loot-breastplate","arpg-loot-mantle","arpg-ground-shadow"] as const;

export function createDungeonRuntimeTextures(scene: import("phaser").Scene) {
      if (TEXTURES.every((key) => scene.textures.exists(key))) return;
      const graphics = scene.add.graphics();

      // Original 36px forest guardian: layered silhouette, antler crown, mask and rune.
      graphics.fillStyle(0x15291f, 1);
      graphics.fillRect(10, 29, 7, 6);
      graphics.fillRect(22, 29, 7, 6);
      graphics.fillRect(8, 13, 23, 19);
      graphics.fillStyle(0x31563a, 1);
      graphics.fillRect(6, 14, 26, 14);
      graphics.fillRect(11, 9, 17, 21);
      graphics.fillStyle(0x57874b, 1);
      graphics.fillRect(8, 14, 6, 9);
      graphics.fillRect(24, 14, 6, 9);
      graphics.fillRect(12, 9, 15, 6);
      graphics.fillStyle(0x253e2c, 1);
      graphics.fillRect(4, 7, 6, 9);
      graphics.fillRect(26, 7, 6, 9);
      graphics.fillRect(8, 3, 5, 10);
      graphics.fillRect(23, 3, 5, 10);
      graphics.fillRect(11, 0, 3, 6);
      graphics.fillRect(22, 0, 3, 6);
      graphics.fillStyle(0x8dbb64, 1);
      graphics.fillRect(10, 6, 4, 5);
      graphics.fillRect(22, 6, 4, 5);
      graphics.fillRect(14, 12, 9, 3);
      graphics.fillStyle(0x172b25, 1);
      graphics.fillRect(10, 16, 17, 10);
      graphics.fillStyle(0xf7d47c, 1);
      graphics.fillRect(12, 18, 5, 3);
      graphics.fillRect(21, 18, 5, 3);
      graphics.fillStyle(0xfff1bc, 1);
      graphics.fillRect(13, 18, 2, 2);
      graphics.fillRect(22, 18, 2, 2);
      graphics.fillStyle(0x6fbd9b, 1);
      graphics.fillRect(17, 23, 4, 2);
      graphics.fillRect(18, 25, 2, 3);
      graphics.fillStyle(0xb8d978, 1);
      graphics.fillRect(16, 10, 5, 2);
      graphics.fillRect(5, 20, 3, 4);
      graphics.fillRect(29, 20, 3, 4);
      graphics.fillStyle(0x22372a, 1);
      graphics.fillRect(10, 31, 7, 4);
      graphics.fillRect(22, 31, 7, 4);
      graphics.generateTexture("arpg-enemy", 36, 36);
      graphics.clear();

      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(3, 3, 7, 7);
      graphics.generateTexture("arpg-projectile", 13, 13);

      graphics.clear();
      graphics.fillStyle(0xffffff, 1);
      for (let y = 0; y < 64; y += 4) {
        for (let x = 0; x < 64; x += 4) {
          const distance = Math.hypot(x + 2 - 32, y + 2 - 32);
          if (distance >= 25 && distance <= 31) graphics.fillRect(x, y, 4, 4);
        }
      }
      graphics.generateTexture("arpg-pixel-pulse", 64, 64);

      graphics.clear();
      // Hand-drawn reinforced supply chest with rim lighting and brass hardware.
      graphics.fillStyle(0x251e24, 1);
      graphics.fillRect(3, 10, 34, 27);
      graphics.fillStyle(0x593a2b, 1);
      graphics.fillRect(5, 7, 30, 26);
      graphics.fillStyle(0x98603b, 1);
      graphics.fillRect(7, 10, 26, 21);
      graphics.fillStyle(0xc48b50, 1);
      graphics.fillRect(8, 10, 24, 4);
      graphics.fillRect(8, 17, 24, 2);
      graphics.fillStyle(0xe7b66c, 1);
      graphics.fillRect(9, 11, 21, 2);
      graphics.fillStyle(0x3a2b2b, 1);
      graphics.fillRect(6, 15, 4, 16);
      graphics.fillRect(30, 15, 4, 16);
      graphics.fillRect(7, 25, 26, 4);
      graphics.fillStyle(0x67515a, 1);
      graphics.fillRect(4, 13, 4, 4);
      graphics.fillRect(32, 13, 4, 4);
      graphics.fillRect(4, 29, 4, 4);
      graphics.fillRect(32, 29, 4, 4);
      graphics.fillStyle(0xf0cf82, 1);
      graphics.fillRect(18, 16, 6, 12);
      graphics.fillStyle(0x463331, 1);
      graphics.fillRect(20, 20, 2, 4);
      graphics.fillStyle(0xffe0a0, 1);
      graphics.fillRect(18, 17, 6, 2);
      graphics.fillRect(10, 20, 2, 3);
      graphics.fillRect(27, 20, 2, 3);
      graphics.generateTexture("arpg-breakable-crate", 40, 40);

      graphics.clear();
      graphics.fillStyle(0x38232c, 1);
      graphics.fillRect(11, 14, 18, 19);
      graphics.fillRect(14, 7, 12, 9);
      graphics.fillRect(16, 4, 8, 5);
      graphics.fillStyle(0x995a50, 1);
      graphics.fillRect(13, 15, 14, 15);
      graphics.fillRect(15, 8, 10, 9);
      graphics.fillStyle(0xc98668, 1);
      graphics.fillRect(15, 12, 4, 13);
      graphics.fillRect(16, 6, 8, 3);
      graphics.fillRect(13, 17, 14, 3);
      graphics.fillStyle(0xe2b98a, 1);
      graphics.fillRect(16, 11, 3, 4);
      graphics.fillRect(17, 18, 2, 6);
      graphics.fillStyle(0x6e3e40, 1);
      graphics.fillRect(12, 24, 16, 4);
      graphics.fillRect(17, 30, 7, 3);
      graphics.fillStyle(0xefd7a6, 1);
      graphics.fillRect(19, 14, 3, 3);
      graphics.fillRect(25, 21, 2, 4);
      graphics.generateTexture("arpg-breakable-vase", 40, 40);

      graphics.clear();
      graphics.fillStyle(0x513a25, 1);
      graphics.fillRect(18, 27, 5, 10);
      graphics.fillStyle(0x3e713c, 1);
      graphics.fillEllipse(12, 18, 19, 19);
      graphics.fillStyle(0x548b45, 1);
      graphics.fillEllipse(24, 14, 19, 18);
      graphics.fillStyle(0x6ba24d, 1);
      graphics.fillEllipse(19, 9, 17, 15);
      graphics.fillStyle(0x9cb85d, 1);
      graphics.fillRect(12, 14, 4, 3);
      graphics.fillRect(23, 11, 4, 3);
      graphics.generateTexture("arpg-breakable-shrub", 40, 40);

      graphics.clear();
      graphics.fillStyle(0x514652, 1);
      graphics.fillRect(8, 27, 24, 8);
      graphics.fillStyle(0x918398, 1);
      graphics.fillRect(12, 20, 16, 8);
      graphics.fillStyle(0x89c6cb, 1);
      graphics.fillPoints([
        { x: 20, y: 3 }, { x: 29, y: 15 }, { x: 20, y: 25 }, { x: 11, y: 15 },
      ], true);
      graphics.fillStyle(0xc7ecdb, 0.92);
      graphics.fillTriangle(20, 5, 20, 22, 27, 15);
      graphics.lineStyle(2, 0x31525a, 1);
      graphics.strokeRect(8, 27, 24, 8);
      graphics.generateTexture("arpg-breakable-relic", 40, 40);

      graphics.clear();
      graphics.fillStyle(0x3f9690, 1);
      graphics.fillPoints([
        { x: 12, y: 1 }, { x: 22, y: 10 }, { x: 12, y: 23 }, { x: 2, y: 10 },
      ], true);
      graphics.fillStyle(0xc7f1bf, 0.96);
      graphics.fillTriangle(12, 2, 12, 18, 20, 10);
      graphics.lineStyle(2, 0x285f5f, 1);
      graphics.strokePoints([
        { x: 12, y: 1 }, { x: 22, y: 10 }, { x: 12, y: 23 }, { x: 2, y: 10 }, { x: 12, y: 1 },
      ]);
      graphics.generateTexture("arpg-run-fragment", 24, 24);

      const generateLootTexture = (key: string, draw: () => void) => {
        graphics.clear();
        draw();
        graphics.generateTexture(key, 32, 32);
      };
      generateLootTexture("arpg-loot-sword", () => {
        graphics.fillStyle(0x332c31, 1);
        graphics.fillRect(20, 1, 8, 7);
        graphics.fillRect(16, 7, 8, 7);
        graphics.fillRect(12, 13, 8, 7);
        graphics.fillRect(8, 19, 8, 7);
        graphics.fillRect(4, 24, 8, 6);
        graphics.fillStyle(0xdce8dc, 1);
        graphics.fillRect(22, 3, 4, 4);
        graphics.fillRect(18, 9, 4, 4);
        graphics.fillRect(14, 15, 4, 4);
        graphics.fillRect(10, 21, 4, 4);
        graphics.fillStyle(0x67482d, 1);
        graphics.fillRect(2, 25, 13, 4);
        graphics.fillRect(5, 22, 4, 10);
        graphics.fillStyle(0xe2ba68, 1);
        graphics.fillRect(5, 23, 3, 3);
      });
      generateLootTexture("arpg-loot-bow", () => {
        graphics.fillStyle(0x342c2e, 1);
        graphics.fillRect(22, 1, 6, 5);
        graphics.fillRect(26, 5, 5, 9);
        graphics.fillRect(27, 13, 5, 8);
        graphics.fillRect(23, 20, 6, 7);
        graphics.fillRect(18, 25, 7, 6);
        graphics.fillStyle(0x9f6739, 1);
        graphics.fillRect(23, 3, 3, 3);
        graphics.fillRect(27, 7, 3, 6);
        graphics.fillRect(28, 15, 3, 5);
        graphics.fillRect(24, 22, 3, 4);
        graphics.fillRect(20, 27, 4, 3);
        graphics.lineStyle(1, 0xd9d2bd, 1);
        graphics.lineBetween(20, 2, 20, 30);
        graphics.fillStyle(0xe6c878, 1);
        graphics.fillRect(17, 14, 6, 3);
      });
      generateLootTexture("arpg-loot-staff", () => {
        graphics.fillStyle(0x342d35, 1);
        graphics.fillRect(7, 18, 7, 7);
        graphics.fillRect(12, 13, 7, 7);
        graphics.fillRect(17, 8, 7, 7);
        graphics.fillRect(22, 3, 7, 7);
        graphics.fillStyle(0x96704a, 1);
        graphics.fillRect(9, 20, 3, 4);
        graphics.fillRect(14, 15, 3, 4);
        graphics.fillRect(19, 10, 3, 4);
        graphics.fillRect(24, 5, 3, 4);
        graphics.fillStyle(0x382c43, 1);
        graphics.fillRect(18, 1, 12, 11);
        graphics.fillStyle(0xbba1df, 1);
        graphics.fillPoints([{ x: 24, y: 1 }, { x: 29, y: 6 }, { x: 24, y: 11 }, { x: 19, y: 6 }], true);
        graphics.fillStyle(0xf4e4ff, 1);
        graphics.fillRect(23, 3, 3, 3);
      });
      generateLootTexture("arpg-loot-breastplate", () => {
        graphics.fillStyle(0x332e32, 1);
        graphics.fillRect(5, 3, 8, 5);
        graphics.fillRect(19, 3, 8, 5);
        graphics.fillRect(4, 7, 24, 6);
        graphics.fillRect(6, 12, 20, 12);
        graphics.fillRect(9, 23, 14, 6);
        graphics.fillStyle(0x8b735c, 1);
        graphics.fillRect(7, 8, 18, 4);
        graphics.fillRect(9, 13, 14, 8);
        graphics.fillRect(11, 22, 10, 5);
        graphics.fillStyle(0xe2c98d, 1);
        graphics.fillRect(14, 9, 4, 12);
        graphics.fillRect(10, 14, 3, 3);
        graphics.fillRect(19, 14, 3, 3);
      });
      generateLootTexture("arpg-loot-mantle", () => {
        graphics.fillStyle(0x342d3a, 1);
        graphics.fillRect(10, 3, 12, 6);
        graphics.fillRect(7, 8, 18, 5);
        graphics.fillRect(6, 12, 20, 8);
        graphics.fillRect(4, 19, 24, 8);
        graphics.fillRect(8, 26, 16, 4);
        graphics.fillStyle(0x725584, 1);
        graphics.fillRect(12, 5, 8, 3);
        graphics.fillRect(9, 10, 14, 4);
        graphics.fillRect(8, 15, 16, 4);
        graphics.fillRect(7, 21, 18, 4);
        graphics.fillStyle(0xd9bded, 1);
        graphics.fillRect(14, 10, 4, 13);
        graphics.fillRect(13, 24, 6, 3);
      });

      graphics.clear();
      graphics.fillStyle(0x08120d, 1);
      graphics.fillRect(8, 0, 16, 2);
      graphics.fillRect(4, 2, 24, 3);
      graphics.fillRect(1, 5, 30, 3);
      graphics.fillRect(4, 8, 24, 2);
      graphics.fillRect(9, 10, 14, 1);
      graphics.generateTexture("arpg-ground-shadow", 32, 12);
      graphics.destroy();
    }

