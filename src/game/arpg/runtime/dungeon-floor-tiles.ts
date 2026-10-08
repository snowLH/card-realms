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
      // Layered leaf clusters, mushrooms and root inlays; variant-dependent.
      if (variant === 0) {
        pixel("#263f31", 19, 15, 7, 3, .75);
        pixel("#4f8a51", 20, 14, 5, 2, .85);
        pixel("#d7b879", 23, 11, 2, 3);
        pixel("#c86e55", 21, 10, 6, 2);
        pixel("#f6dba4", 23, 10, 2, 1);
      } else {
        pixel("#354f35", 20, 18, 8, 2, .8);
        pixel("#739f54", 22, 16, 4, 3, .8);
        pixel("#a6c970", 24, 15, 2, 2, .9);
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
      // Seafoam waves and embedded shell fragments distinguish tide rooms.
      if (variant === 0) {
        pixel("#256e7c", 5, 19, 16, 2, .6);
        pixel("#83d3d2", 8, 18, 8, 1, .9);
        pixel("#e4d6a8", 19, 8, 5, 3, .85);
        pixel("#f6e7bd", 21, 7, 2, 2);
      } else {
        pixel("#367f87", 8, 21, 15, 2, .6);
        pixel("#b4e6db", 10, 20, 7, 1, .9);
        pixel("#f1d5a1", 20, 9, 3, 3);
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
    // Faceted ice shards, angular slate and luminous rune glyphs.
    if (variant === 0) {
      pixel("#476d81", 19, 8, 7, 9, .7);
      pixel("#a9e9f2", 21, 6, 3, 9, .85);
      pixel("#ecffff", 22, 7, 1, 5);
      pixel("#668d9b", 20, 16, 6, 2);
    } else {
      pixel("#7291a5", 6, 17, 4, 9, .75);
      pixel("#c8f4f3", 7, 15, 2, 8, .9);
      pixel("#dceff0", 17, 18, 7, 2, .65);
      pixel("#7bd2dd", 19, 16, 2, 6, .8);
    }
    // Frost cracks and a cold crystal highlight for the rune mountains.
    pixel("#a9e2ee", 23, 22, 2, 7, 0.6);
    pixel("#d7f3f1", 21, 24, 6, 2, 0.75);
    pixel("#60788e", 4, 22, 8, 2, 0.65);
  }

