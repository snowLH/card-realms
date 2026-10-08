import { DUNGEON_TILE_SIZE } from "../dungeon/layout";

export type DungeonFloorPalette = {
  floor: string;
  wall: string;
  floorDetail: string;
  wallHighlight: string;
};

export function drawBiomeFloorVariant(context: CanvasRenderingContext2D, x: number, variant: number, palette: DungeonFloorPalette, regionId: string) {
    const tile = (color: string) => {
      context.fillStyle = color;
      context.fillRect(x, 0, DUNGEON_TILE_SIZE, DUNGEON_TILE_SIZE);
    };
    const pixel = (color: string, px: number, py: number, width: number, height: number, alpha = 1) => {
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(x + px, py, width, height);
      context.globalAlpha = 1;
    };

    tile(palette.floor);
    pixel(palette.wall, 0, 30, DUNGEON_TILE_SIZE, 2, 0.68);
    pixel(palette.wall, 30, 0, 2, DUNGEON_TILE_SIZE, 0.68);
    pixel(palette.floorDetail, 3, 3, 26, 3, 0.72);
    pixel(palette.floorDetail, 3, 3, 3, 26, 0.72);
    if (regionId === "mata-encantada") {
      const root = palette.floorDetail;
      const moss = palette.wallHighlight;
      if (variant === 0) {
        pixel(root, 3, 12, 10, 3);
        pixel(root, 9, 7, 3, 7);
        pixel(root, 11, 7, 7, 2);
        pixel(moss, 5, 17, 4, 2, 0.55);
      } else {
        pixel(root, 7, 5, 3, 3);
        pixel(root, 11, 8, 4, 3);
        pixel(root, 16, 12, 3, 3);
        pixel(moss, 10, 6, 2, 2, 0.55);
        pixel(moss, 15, 13, 2, 2, 0.55);
      }
      // Fallen petals and moss add an unmistakable forest identity.
      pixel("#b6c66e", 22, 24, 3, 2, 0.7);
      pixel("#d4a278", 24, 8, 2, 2, 0.7);
      pixel("#577b4b", 4, 24, 6, 3, 0.65);
      return;
    }

    if (regionId === "arquipelago-das-mares") {
      const tide = palette.floorDetail;
      const foam = palette.wallHighlight;
      if (variant === 0) {
        pixel(tide, 3, 9, 10, 3);
        pixel(tide, 10, 12, 12, 3);
        pixel(foam, 5, 7, 5, 2, 0.45);
        pixel(foam, 16, 15, 6, 2, 0.4);
      } else {
        pixel(tide, 7, 6, 4, 3);
        pixel(tide, 12, 9, 5, 3);
        pixel(tide, 17, 12, 4, 3);
        pixel(foam, 8, 5, 2, 2, 0.5);
        pixel(foam, 18, 14, 3, 2, 0.4);
      }
      // Sea-glass shards and tide foam break up otherwise flat sand.
      pixel("#85d6d0", 22, 23, 4, 2, 0.7);
      pixel("#e8dfb5", 3, 24, 5, 2, 0.65);
      pixel("#2b8e9c", 25, 5, 2, 4, 0.65);
      return;
    }

    const slate = palette.floorDetail;
    const ice = palette.wallHighlight;
    if (variant === 0) {
      pixel(slate, 6, 5, 4, 3);
      pixel(slate, 10, 8, 3, 5);
      pixel(slate, 13, 12, 4, 3);
      pixel(ice, 7, 6, 2, 2, 0.45);
    } else {
      pixel(slate, 13, 5, 3, 3);
      pixel(slate, 10, 8, 9, 3);
      pixel(slate, 13, 11, 3, 4);
      pixel(ice, 14, 8, 2, 2, 0.5);
    }
    // Frost cracks and a cold crystal highlight for the rune mountains.
    pixel("#a9e2ee", 23, 22, 2, 7, 0.6);
    pixel("#d7f3f1", 21, 24, 6, 2, 0.75);
    pixel("#60788e", 4, 22, 8, 2, 0.65);
  }

