import { DUNGEON_TILE_SIZE, buildDungeonPixelLayout, type DungeonPixelLayout } from "../dungeon/layout";
import { ARPG_ROOM_TEMPLATE_BY_ID } from "../dungeon/templates";
import { createSeededRandom } from "../dungeon/rng";
import { buildRoomTileData, createSafeRoomSpawnPoints, ROOM_FLOOR_TILE, ROOM_OBSTACLE_TILE, ROOM_RUNE_TILE, ROOM_WALL_TILE, ROOM_WATER_TILE, type RoomSpawnPoint } from "../dungeon/room-tilemap";
import type { DungeonDirection, DungeonGraph } from "../dungeon/types";
import { ARPG_ASSET_MANIFEST } from "../assets";

export const DUNGEON_BIOME_PROPS_TEXTURE_KEY = "dungeon-biome-props-pixel-v1";
export const DUNGEON_BIOME_PROPS_ASSET_PATH = "/art/dungeon-biome-props-pixel-v1.webp";
export const DUNGEON_BIOME_PROPS_FRAME_SIZE = 362;

const DUNGEON_BIOME_PROP_DISPLAY_SIZE = 46;
const DUNGEON_BIOME_PROP_FRAME = {
  mataTree: 0,
  mataStump: 1,
  mataRuin: 2,
  mataTorch: 3,
  maresCoral: 4,
  maresSeaweed: 5,
  maresShipwreck: 6,
  maresSpring: 7,
  mountainPine: 8,
  mountainCrystal: 9,
  mountainRock: 10,
  mountainBrazier: 11,
} as const;

type DoorEntry = {
  visual: import("phaser").GameObjects.Rectangle;
  body: import("phaser").Physics.Arcade.StaticBody;
  openX: number;
  openY: number;
  closedX: number;
  closedY: number;
  locked: boolean;
  state: "open" | "closing" | "closed" | "opening";
};

type DungeonPalette = {
  floor: string;
  floorDetail: string;
  wall: string;
  wallDetail: string;
  wallHighlight: string;
  corridor: number;
  collision: number;
  door: number;
  water: string;
};

type AmbientVisual = { visible: boolean };

type AmbientFxEntry = {
  visuals: AmbientVisual[];
  tween: import("phaser").Tweens.Tween;
};

type RoomAmbientState = {
  fx: AmbientFxEntry[];
};

type PixelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  alpha?: number;
};

/** Draws crisp, integer-aligned pixel clusters as static Phaser graphics. */
function drawPixelLayer(
  scene: import("phaser").Scene,
  x: number,
  y: number,
  depth: number,
  pixels: readonly PixelRect[],
) {
  const layer = scene.add.graphics().setDepth(depth);
  for (const pixel of pixels) {
    layer.fillStyle(pixel.color, pixel.alpha ?? 1);
    layer.fillRect(
      Math.round(x + pixel.x),
      Math.round(y + pixel.y),
      Math.max(1, Math.round(pixel.width)),
      Math.max(1, Math.round(pixel.height)),
    );
  }
  return layer;
}

export type DungeonAmbientDebugState = Readonly<{
  activeRoomId: string | null;
  rooms: ReadonlyArray<Readonly<{
    roomId: string;
    tweens: Readonly<{ active: number; paused: number }>;
    fx: Readonly<{ active: number; paused: number }>;
  }>>;
}>;

const MATA_PALETTE: DungeonPalette = {
  floor: "#b89350", floorDetail: "#c9ab65", wall: "#273b29", wallDetail: "#697753", wallHighlight: "#afbd71",
  corridor: 0xb89350, collision: 0x273b29, door: 0x95623b,
  water: "#2b4d50",
};
const MARES_PALETTE: DungeonPalette = {
  floor: "#31545e", floorDetail: "#3f7380", wall: "#172f36", wallDetail: "#538391", wallHighlight: "#8bc0be",
  corridor: 0x31545e, collision: 0x172f36, door: 0x4a8290,
  water: "#226d82",
};
const RUNIC_PALETTE: DungeonPalette = {
  floor: "#40586c", floorDetail: "#60778a", wall: "#1d2c3b", wallDetail: "#648194", wallHighlight: "#b7d8e2",
  corridor: 0x40586c, collision: 0x1d2c3b, door: 0x7898a8,
  water: "#4a7892",
};

const FLOOR_VARIANT_TILES = [6, 7] as const;
const FLOOR_VARIANT_CHANCE = 0.32;

export class DungeonWorldRuntime {
  readonly layout: DungeonPixelLayout;
  private readonly wallLayers: import("phaser").Tilemaps.TilemapLayer[] = [];
  private readonly corridorWalls: import("phaser").GameObjects.Rectangle[] = [];
  private readonly doors = new Map<string, DoorEntry>();
  private readonly ambientByRoom = new Map<string, RoomAmbientState>();
  private activeAmbientRoomId: string | null = null;

  constructor(
    private readonly scene: import("phaser").Scene,
    private readonly graph: DungeonGraph,
    private readonly onDoorsLockedChange?: (locked: boolean) => void,
  ) {
    this.layout = buildDungeonPixelLayout(graph);
  }

  private get palette() {
    if (this.graph.regionId === "arquipelago-das-mares") return MARES_PALETTE;
    if (this.graph.regionId === "montanhas-runicas") return RUNIC_PALETTE;
    return MATA_PALETTE;
  }

  private get tileTextureKey() {
    return `card-realms-dungeon-tiles-${this.graph.regionId}`;
  }

  private get hasArenaArtwork() {
    return this.scene.textures.exists(ARPG_ASSET_MANIFEST.runtimeTextureKeys.dungeonBackground);
  }

  build() {
    this.ensureTileTexture();
    this.drawWorldAtmosphere();
    this.drawCorridors();
    this.drawRooms();
    this.createDoors();
    this.scene.physics.world.setBounds(0, 0, this.layout.width, this.layout.height);
    return this;
  }

  private ensureTileTexture() {
    const key = this.tileTextureKey;
    if (this.scene.textures.exists(key)) return;
    const texture = this.scene.textures.createCanvas(key, DUNGEON_TILE_SIZE * 8, DUNGEON_TILE_SIZE);
    if (!texture) throw new Error("Não foi possível criar o tileset procedural da dungeon.");
    const context = texture.getContext();
    const palette = this.palette;
    context.imageSmoothingEnabled = false;
    const tileX = (tile: number) => tile * DUNGEON_TILE_SIZE;
    const fillTile = (tile: number, color: string) => {
      context.fillStyle = color;
      context.fillRect(tileX(tile), 0, DUNGEON_TILE_SIZE, DUNGEON_TILE_SIZE);
    };
    fillTile(0, palette.floor);
    context.fillStyle = palette.floorDetail;
    context.fillRect(3, 3, 26, 3);
    context.fillRect(3, 3, 3, 26);
    context.fillRect(7, 8, 8, 2);
    context.fillRect(20, 17, 7, 2);
    context.fillRect(11, 25, 10, 2);
    context.fillStyle = palette.wall;
    context.fillRect(0, 30, DUNGEON_TILE_SIZE, 2);
    context.fillRect(30, 0, 2, DUNGEON_TILE_SIZE);
    context.fillStyle = palette.wallHighlight;
    context.fillRect(4, 6, 19, 2);
    context.fillRect(6, 10, 2, 10);

    fillTile(1, palette.wall);
    if (this.graph.regionId === "mata-encantada") {
      // The Mata border reads as old, moss-bound roots instead of a repeated
      // gray brick. These marks stay inside the existing wall tile texture.
      context.fillStyle = palette.floorDetail;
      context.fillRect(tileX(1) + 2, 2, DUNGEON_TILE_SIZE - 4, DUNGEON_TILE_SIZE - 4);
      context.fillStyle = palette.wall;
      context.fillRect(tileX(1) + 5, 5, DUNGEON_TILE_SIZE - 10, DUNGEON_TILE_SIZE - 9);
      context.fillStyle = palette.wallDetail;
      context.fillRect(tileX(1) + 4, 7, 3, 14);
      context.fillRect(tileX(1) + 13, 4, 3, 9);
      context.fillRect(tileX(1) + 22, 14, 4, 12);
      context.fillStyle = palette.wallHighlight;
      context.fillRect(tileX(1) + 7, 6, 8, 2);
      context.fillRect(tileX(1) + 17, 20, 8, 2);
      context.fillStyle = palette.floorDetail;
      context.fillRect(tileX(1) + 9, 26, 5, 2);
    } else {
      context.fillStyle = palette.wallDetail;
      context.fillRect(tileX(1) + 3, 3, DUNGEON_TILE_SIZE - 6, DUNGEON_TILE_SIZE - 6);
      context.fillStyle = palette.wallHighlight;
      context.fillRect(tileX(1) + 5, 5, DUNGEON_TILE_SIZE - 10, 4);
      context.fillRect(tileX(1) + 7, 19, 8, 3);
    }

    fillTile(2, palette.floor);
    context.fillStyle = palette.wallHighlight;
    context.fillRect(tileX(2) + 5, 5, 9, 3);
    context.fillRect(tileX(2) + 17, 14, 9, 4);
    context.fillStyle = palette.floorDetail;
    context.fillRect(tileX(2) + 8, 20, 15, 3);
    context.fillStyle = palette.wall;
    context.fillRect(tileX(2), 30, DUNGEON_TILE_SIZE, 2);
    context.fillRect(tileX(2) + 30, 0, 2, DUNGEON_TILE_SIZE);

    fillTile(3, palette.water);
    context.fillStyle = palette.wallHighlight;
    context.fillRect(tileX(3) + 3, 7, 12, 2);
    context.fillRect(tileX(3) + 17, 18, 11, 2);
    context.fillStyle = palette.floorDetail;
    context.fillRect(tileX(3) + 8, 13, 6, 2);
    context.fillRect(tileX(3) + 22, 26, 5, 2);

    fillTile(4, palette.wall);
    context.fillStyle = palette.wallDetail;
    context.fillRect(tileX(4) + 4, 6, 24, 20);
    context.fillStyle = palette.wallHighlight;
    context.fillRect(tileX(4) + 7, 5, 14, 4);
    context.fillRect(tileX(4) + 10, 16, 11, 4);
    context.fillStyle = palette.collision ? `#${palette.collision.toString(16).padStart(6, "0")}` : palette.wall;
    context.fillRect(tileX(4) + 3, 25, 26, 4);

    fillTile(5, palette.floor);
    context.fillStyle = palette.floorDetail;
    context.fillRect(tileX(5) + 14, 4, 4, 4);
    context.fillRect(tileX(5) + 8, 10, 4, 4);
    context.fillRect(tileX(5) + 20, 10, 4, 4);
    context.fillRect(tileX(5) + 8, 18, 4, 4);
    context.fillRect(tileX(5) + 20, 18, 4, 4);
    context.fillRect(tileX(5) + 14, 24, 4, 4);
    context.fillStyle = palette.wallHighlight;
    context.fillRect(tileX(5) + 14, 8, 4, 2);
    context.fillRect(tileX(5) + 12, 12, 8, 2);
    context.fillRect(tileX(5) + 10, 14, 12, 4);
    context.fillRect(tileX(5) + 12, 18, 8, 2);
    context.fillRect(tileX(5) + 14, 22, 4, 2);

    this.drawBiomeFloorVariant(context, tileX(6), 0);
    this.drawBiomeFloorVariant(context, tileX(7), 1);
    texture.refresh();
  }

  private drawBiomeFloorVariant(context: CanvasRenderingContext2D, x: number, variant: number) {
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

    tile(this.palette.floor);
    pixel(this.palette.wall, 0, 30, DUNGEON_TILE_SIZE, 2, 0.68);
    pixel(this.palette.wall, 30, 0, 2, DUNGEON_TILE_SIZE, 0.68);
    pixel(this.palette.floorDetail, 3, 3, 26, 3, 0.72);
    pixel(this.palette.floorDetail, 3, 3, 3, 26, 0.72);
    if (this.graph.regionId === "mata-encantada") {
      const root = this.palette.floorDetail;
      const moss = this.palette.wallHighlight;
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
      return;
    }

    if (this.graph.regionId === "arquipelago-das-mares") {
      const tide = this.palette.floorDetail;
      const foam = this.palette.wallHighlight;
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
      return;
    }

    const slate = this.palette.floorDetail;
    const ice = this.palette.wallHighlight;
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
  }

  private createFloorVariantData(tiles: number[][], roomId: string) {
    const random = createSeededRandom(`${this.graph.seed}:${roomId}:floor-variants-v1`);
    return tiles.map((row) => row.map((tile) => {
      if (tile !== ROOM_FLOOR_TILE || random.next() >= FLOOR_VARIANT_CHANCE) return tile;
      return FLOOR_VARIANT_TILES[random.int(0, FLOOR_VARIANT_TILES.length - 1)];
    }));
  }

  private drawWorldAtmosphere() {
    const colors = this.graph.regionId === "arquipelago-das-mares"
      ? { ground: 0x0e1a20, patch: 0x24424a, haze: 0x456c76 }
      : this.graph.regionId === "montanhas-runicas"
        ? { ground: 0x111a24, patch: 0x28384a, haze: 0x56728a }
        : { ground: 0x111a13, patch: 0x283b2a, haze: 0x557346 };
    const graphics = this.scene.add.graphics().setDepth(-2);
    graphics.fillStyle(colors.ground, 1).fillRect(0, 0, this.layout.width, this.layout.height);

    // The space between routes used to read as pure black. A sparse, seeded
    // canopy/stone texture gives it depth while leaving rooms and corridors
    // fully readable above it. All marks are baked into one static Graphics object.
    const random = createSeededRandom(`${this.graph.seed}:${this.graph.regionId}:world-atmosphere-v1`);
    for (let y = 24; y < this.layout.height; y += 88) {
      for (let x = 24; x < this.layout.width; x += 88) {
        if (random.next() > 0.16) continue;
        const width = random.int(16, 44);
        const height = random.int(3, 11);
        const patchX = x + random.int(-18, 24);
        const patchY = y + random.int(-16, 20);
        graphics.fillStyle(colors.patch, random.int(10, 18) / 100)
          .fillRect(patchX, patchY, width, height);
        graphics.fillStyle(colors.haze, random.int(7, 13) / 100)
          .fillRect(patchX + random.int(2, 12), patchY - 3, random.int(3, 8), 2);
      }
    }

    for (let index = 0; index < 14; index += 1) {
      const x = random.int(0, this.layout.width);
      const y = random.int(0, this.layout.height);
      graphics.fillStyle(colors.haze, 0.025)
        .fillEllipse(x, y, random.int(72, 180), random.int(44, 112));
    }
  }

  private addStaticWall(x: number, y: number, width: number, height: number) {
    const wall = this.scene.add.rectangle(x, y, width, height, this.palette.collision, 1).setDepth(2);
    this.scene.physics.add.existing(wall, true);
    this.corridorWalls.push(wall);
    return wall;
  }

  private drawCorridors() {
    for (const corridor of this.layout.corridors) {
      this.scene.add.rectangle(
        corridor.x + corridor.width / 2,
        corridor.y + corridor.height / 2,
        corridor.width,
        corridor.height,
        this.palette.corridor,
        1,
      ).setDepth(0);
      this.drawCorridorSurface(corridor);

      if (corridor.width > corridor.height) {
        const wallThickness = 24;
        this.addStaticWall(corridor.x + corridor.width / 2, corridor.y - wallThickness / 2, corridor.width, wallThickness);
        this.addStaticWall(corridor.x + corridor.width / 2, corridor.y + corridor.height + wallThickness / 2, corridor.width, wallThickness);
      } else {
        const wallThickness = 24;
        this.addStaticWall(corridor.x - wallThickness / 2, corridor.y + corridor.height / 2, wallThickness, corridor.height);
        this.addStaticWall(corridor.x + corridor.width + wallThickness / 2, corridor.y + corridor.height / 2, wallThickness, corridor.height);
      }
    }
  }

  private drawCorridorSurface(corridor: DungeonPixelLayout["corridors"][number]) {
    const details = this.scene.add.graphics().setDepth(0.2);
    const random = createSeededRandom(`${this.graph.seed}:${corridor.fromRoomId}:${corridor.toRoomId}:path-detail-v1`);
    const length = Math.max(corridor.width, corridor.height);
    const horizontal = corridor.width > corridor.height;
    const accent = Number.parseInt(this.palette.floorDetail.slice(1), 16);
    const edgeAccent = Number.parseInt(this.palette.wallHighlight.slice(1), 16);

    details.fillStyle(accent, 0.18);
    if (horizontal) {
      details.fillRect(corridor.x, corridor.y + 7, corridor.width, 3);
      details.fillRect(corridor.x, corridor.y + corridor.height - 10, corridor.width, 3);
    } else {
      details.fillRect(corridor.x + 7, corridor.y, 3, corridor.height);
      details.fillRect(corridor.x + corridor.width - 10, corridor.y, 3, corridor.height);
    }

    // Broken, shallow stone/root flecks follow the route without changing its
    // floor, width, collision, or doorway geometry.
    for (let offset = 48; offset < length - 32; offset += 88) {
      const across = random.int(-27, 27);
      const fleck = random.int(7, 15);
      details.fillStyle(accent, random.int(16, 27) / 100);
      if (horizontal) {
        details.fillRect(corridor.x + offset, corridor.y + corridor.height / 2 + across, fleck, 3);
      } else {
        details.fillRect(corridor.x + corridor.width / 2 + across, corridor.y + offset, 3, fleck);
      }
      if (random.next() > 0.45) {
        details.fillStyle(edgeAccent, 0.16);
        if (horizontal) {
          details.fillRect(corridor.x + offset + 3, corridor.y + corridor.height / 2 + across - 3, 3, 2);
        } else {
          details.fillRect(corridor.x + corridor.width / 2 + across + 3, corridor.y + offset + 2, 2, 3);
        }
      }
    }
  }

  private drawRooms() {
    const textureKey = this.tileTextureKey;
    for (const room of Object.values(this.graph.rooms)) {
      const tileData = buildRoomTileData(room.templateId, room.connections, this.graph.seed);
      const map = this.scene.make.tilemap({
        data: this.createFloorVariantData(tileData.data, room.id),
        tileWidth: DUNGEON_TILE_SIZE,
        tileHeight: DUNGEON_TILE_SIZE,
      });
      const tileset = map.addTilesetImage(textureKey, textureKey, DUNGEON_TILE_SIZE, DUNGEON_TILE_SIZE, 0, 0);
      if (!tileset) throw new Error(`Tileset procedural ausente para ${room.id}.`);
      const layout = this.layout.rooms[room.id];
      if (this.hasArenaArtwork) {
        this.scene.add.image(
          layout.centerX,
          layout.centerY,
          ARPG_ASSET_MANIFEST.runtimeTextureKeys.dungeonBackground,
        ).setDisplaySize(layout.width, layout.height).setDepth(0.8);
      }
      const layer = map.createLayer(0, tileset, layout.left, layout.top);
      if (!layer) throw new Error(`Não foi possível criar o tilemap da sala ${room.id}.`);
      layer.setDepth(1);
      layer.setCollision([ROOM_WALL_TILE, ROOM_OBSTACLE_TILE]);
      if (this.hasArenaArtwork) {
        // Keep the seeded collision grid intact. Only its visible floor is
        // replaced by the authored arena; solid tiles still mark real walls.
        layer.forEachTile((tile) => {
          if (tile.index !== ROOM_WALL_TILE && tile.index !== ROOM_OBSTACLE_TILE) {
            tile.alpha = tile.index === ROOM_WATER_TILE ? 0.55 : tile.index === ROOM_RUNE_TILE ? 0.3 : 0;
          }
        });
        this.drawArenaDoorways(layout);
      }
      this.wallLayers.push(layer);
      if (!this.hasArenaArtwork) {
        this.drawRoomRootRim(room, layout);
        this.drawBiomeSetDressing(room, tileData.data, layout);
        this.drawBiomeFloorMarks(room, tileData.data, layout);
        this.drawMataStartRoomDressing(room, tileData.data, layout);
      }
      this.drawAmbientDetails(room, tileData.data, layout);
    }
  }

  private drawArenaDoorways(layout: DungeonPixelLayout["rooms"][string]) {
    const passage = this.scene.add.graphics().setDepth(1.1);
    const floor = this.palette.corridor;
    const trim = Number.parseInt(this.palette.wallHighlight.slice(1), 16);
    for (const [direction, center] of Object.entries(layout.doorCenters)) {
      if (!center) continue;
      const vertical = direction === "north" || direction === "south";
      const inwardX = direction === "west" ? 1 : direction === "east" ? -1 : 0;
      const inwardY = direction === "north" ? 1 : direction === "south" ? -1 : 0;
      // The image has decorative scenery at its edges. Carve a clear path
      // over it precisely where the procedural graph has a traversable door.
      for (let step = 0; step < 4; step += 1) {
        const length = DUNGEON_TILE_SIZE;
        const width = 96 - step * 8;
        const x = center.x + inwardX * (step * length + length / 2);
        const y = center.y + inwardY * (step * length + length / 2);
        passage.fillStyle(floor, 1 - step * 0.12);
        passage.fillRect(
          Math.round(x - (vertical ? width : length) / 2),
          Math.round(y - (vertical ? length : width) / 2),
          vertical ? width : length,
          vertical ? length : width,
        );
      }
      passage.fillStyle(trim, 0.8);
      if (vertical) {
        passage.fillRect(center.x - 46, center.y - 4, 92, 8);
        passage.fillRect(center.x - 34, center.y + inwardY * 16 - 2, 68, 4);
      } else {
        passage.fillRect(center.x - 4, center.y - 46, 8, 92);
        passage.fillRect(center.x + inwardX * 16 - 2, center.y - 34, 4, 68);
      }
    }
  }

  private drawBiomeSetDressing(
    room: DungeonGraph["rooms"][string],
    tiles: number[][],
    layout: DungeonPixelLayout["rooms"][string],
  ) {
    const height = tiles.length;
    const width = tiles[0]?.length ?? 0;
    if (width < 8 || height < 8) return;

    const center = { x: layout.centerX, y: layout.centerY };
    const chestAnchor = { x: layout.centerX, y: layout.centerY + 80 };
    const doorAnchors = Object.values(layout.doorCenters).filter((point): point is { x: number; y: number } => Boolean(point));
    const obstacleAnchors: RoomSpawnPoint[] = [];
    tiles.forEach((row, tileY) => row.forEach((tile, tileX) => {
      if (tile === ROOM_OBSTACLE_TILE) {
        obstacleAnchors.push({
          x: layout.left + (tileX + 0.5) * DUNGEON_TILE_SIZE,
          y: layout.top + (tileY + 0.5) * DUNGEON_TILE_SIZE,
        });
      }
    }));

    // Use the same deterministic spawn planner as combat and keep props clear
    // of every wave's possible enemy points, the player start, doors, and chest.
    const baseTileData = { width, height, data: tiles };
    const enemyAnchors = room.waves.flatMap((wave) => createSafeRoomSpawnPoints(baseTileData, wave.length).map((point) => ({
      x: layout.left + point.x,
      y: layout.top + point.y,
    })));
    const candidates: RoomSpawnPoint[] = [];
    for (let tileY = 1; tileY < height - 1; tileY += 1) {
      for (let tileX = 1; tileX < width - 1; tileX += 1) {
        const edgeDistance = Math.min(tileX, tileY, width - 1 - tileX, height - 1 - tileY);
        if (edgeDistance !== 1) continue;
        const tile = tiles[tileY][tileX];
        if (tile === ROOM_WALL_TILE || tile === ROOM_OBSTACLE_TILE || tile === ROOM_WATER_TILE || tile === ROOM_RUNE_TILE) continue;
        const point = {
          x: layout.left + (tileX + 0.5) * DUNGEON_TILE_SIZE,
          y: layout.top + (tileY + 0.5) * DUNGEON_TILE_SIZE,
        };
        // The pixel-art clusters have a wider silhouette than the old vector
        // props. Keep their complete footprint outside the play lanes.
        if (Math.hypot(point.x - center.x, point.y - center.y) < 144) continue;
        if (Math.hypot(point.x - chestAnchor.x, point.y - chestAnchor.y) < 126) continue;
        if (doorAnchors.some((door) => Math.hypot(point.x - door.x, point.y - door.y) < 120)) continue;
        if (enemyAnchors.some((spawn) => Math.hypot(point.x - spawn.x, point.y - spawn.y) < 96)) continue;
        if (obstacleAnchors.some((obstacle) => Math.hypot(point.x - obstacle.x, point.y - obstacle.y) < 78)) continue;
        candidates.push(point);
      }
    }

    const roomTemplate = ARPG_ROOM_TEMPLATE_BY_ID.get(room.templateId);
    const count = roomTemplate?.size === "large" ? 6 : roomTemplate?.size === "small" ? 4 : 5;
    const picks = createSeededRandom(`${this.graph.seed}:${room.id}:edge-set-dressing-v1`)
      .shuffle(candidates)
      .slice(0, count);
    picks.forEach((point, index) => {
      const depthBias = point.y / Math.max(1, this.layout.height) * 0.14;
      if (this.graph.regionId === "mata-encantada") {
        this.drawForestEdgeCluster(point.x, point.y, index, depthBias);
      } else if (this.graph.regionId === "arquipelago-das-mares") {
        this.drawMaresEdgeCluster(point.x, point.y, index, depthBias);
      } else {
        this.drawRunicEdgeCluster(point.x, point.y, index, depthBias);
      }
    });
  }

  private drawForestEdgeCluster(x: number, y: number, variant: number, depthBias: number) {
    const forestFrames = [
      DUNGEON_BIOME_PROP_FRAME.mataTree,
      DUNGEON_BIOME_PROP_FRAME.mataStump,
      DUNGEON_BIOME_PROP_FRAME.mataRuin,
    ] as const;
    const prop = this.drawBiomeProp(x, y, forestFrames[variant % forestFrames.length], 2.4 + depthBias);
    if (prop) {
      drawPixelLayer(this.scene, x, y, 1.16, [
        { x: -20, y: 13, width: 40, height: 7, color: 0x17241a, alpha: 0.5 },
        { x: -14, y: 10, width: 28, height: 4, color: 0x17241a, alpha: 0.42 },
      ]);
      return;
    }

    const greens = variant % 2
      ? { leaf: 0x4c7443, highlight: 0x91a956, shadow: 0x17241a }
      : { leaf: 0x416c42, highlight: 0x9aaa5e, shadow: 0x17241a };
    drawPixelLayer(this.scene, x, y, 1.16, [
      { x: -20, y: 13, width: 40, height: 7, color: greens.shadow, alpha: 0.5 },
      { x: -14, y: 10, width: 28, height: 4, color: greens.shadow, alpha: 0.42 },
    ]);
    drawPixelLayer(this.scene, x, y, 2.4 + depthBias, [
      { x: -4, y: 1, width: 8, height: 20, color: 0x4b3c28 },
      { x: -9, y: 13, width: 18, height: 4, color: 0x725b36 },
      { x: -2, y: 3, width: 4, height: 17, color: 0x8a6840 },
      { x: -13, y: 16, width: 6, height: 3, color: 0x765638 },
      { x: 7, y: 16, width: 6, height: 3, color: 0x765638 },
    ]);
    // Broad stepped canopy gives the Mata start room a recognizable forest
    // frame while the center, doors, chest and spawn lanes remain open.
    drawPixelLayer(this.scene, x, y, 4 + depthBias, [
      { x: -17, y: -24, width: 34, height: 8, color: greens.shadow },
      { x: -23, y: -17, width: 46, height: 16, color: greens.shadow },
      { x: -18, y: -3, width: 36, height: 10, color: greens.shadow },
      { x: -14, y: -27, width: 28, height: 8, color: greens.leaf },
      { x: -20, y: -18, width: 40, height: 15, color: greens.leaf },
      { x: -14, y: -5, width: 28, height: 8, color: greens.leaf },
      { x: -10, y: -30, width: 18, height: 5, color: greens.highlight },
      { x: -16, y: -20, width: 8, height: 5, color: greens.highlight },
      { x: 3, y: -16, width: 8, height: 4, color: greens.highlight },
      { x: -8, y: -7, width: 6, height: 3, color: 0x9cae5b, alpha: 0.8 },
      { x: 10, y: -10, width: 4, height: 3, color: 0x9cae5b, alpha: 0.74 },
    ]);
  }

  private drawMaresEdgeCluster(x: number, y: number, variant: number, depthBias: number) {
    const maresFrames = [
      DUNGEON_BIOME_PROP_FRAME.maresCoral,
      DUNGEON_BIOME_PROP_FRAME.maresSeaweed,
      DUNGEON_BIOME_PROP_FRAME.maresShipwreck,
    ] as const;
    const prop = this.drawBiomeProp(x, y, maresFrames[variant % maresFrames.length], 3.1 + depthBias);
    if (prop) {
      drawPixelLayer(this.scene, x, y, 1.16, [
        { x: -22, y: 9, width: 44, height: 7, color: 0x10262c, alpha: 0.5 },
        { x: -15, y: 6, width: 30, height: 4, color: 0x10262c, alpha: 0.42 },
      ]);
      return;
    }

    const stone = variant % 2 ? 0x315d68 : 0x376a72;
    drawPixelLayer(this.scene, x, y, 1.16, [
      { x: -22, y: 9, width: 44, height: 7, color: 0x10262c, alpha: 0.5 },
      { x: -15, y: 6, width: 30, height: 4, color: 0x10262c, alpha: 0.42 },
    ]);
    drawPixelLayer(this.scene, x, y, 3.1 + depthBias, [
      { x: -20, y: 1, width: 15, height: 9, color: 0x244952 },
      { x: -16, y: -3, width: 11, height: 5, color: stone },
      { x: -5, y: -1, width: 12, height: 11, color: stone },
      { x: -1, y: -6, width: 11, height: 7, color: 0x437b80 },
      { x: 8, y: 2, width: 13, height: 8, color: 0x2a5963 },
      { x: 12, y: -2, width: 9, height: 5, color: 0x4a8790 },
      { x: -14, y: -4, width: 5, height: 2, color: 0x78b3b5 },
      { x: 1, y: -8, width: 7, height: 2, color: 0x9cebf1, alpha: 0.78 },
      { x: 13, y: -4, width: 5, height: 2, color: 0x9cebf1, alpha: 0.72 },
      { x: -20, y: 8, width: 8, height: 2, color: 0x6da5a1, alpha: 0.72 },
    ]);
  }

  private drawRunicEdgeCluster(x: number, y: number, variant: number, depthBias: number) {
    const runicFrames = [
      DUNGEON_BIOME_PROP_FRAME.mountainPine,
      DUNGEON_BIOME_PROP_FRAME.mountainCrystal,
      DUNGEON_BIOME_PROP_FRAME.mountainRock,
      DUNGEON_BIOME_PROP_FRAME.mountainBrazier,
    ] as const;
    const prop = this.drawBiomeProp(x, y, runicFrames[variant % runicFrames.length], 3.4 + depthBias);
    if (prop) {
      drawPixelLayer(this.scene, x, y, 1.16, [
        { x: -19, y: 11, width: 38, height: 6, color: 0x172633, alpha: 0.55 },
        { x: -12, y: 8, width: 24, height: 4, color: 0x172633, alpha: 0.42 },
      ]);
      return;
    }

    const crystalColor = variant % 2 ? 0x4b91a3 : 0x568eaa;
    drawPixelLayer(this.scene, x, y, 1.16, [
      { x: -19, y: 11, width: 38, height: 6, color: 0x172633, alpha: 0.55 },
      { x: -12, y: 8, width: 24, height: 4, color: 0x172633, alpha: 0.42 },
    ]);
    drawPixelLayer(this.scene, x, y, 3.4 + depthBias, [
      { x: -19, y: 2, width: 11, height: 10, color: 0x344b5d },
      { x: -16, y: -3, width: 5, height: 6, color: 0x4b697e },
      { x: -12, y: -17, width: 8, height: 21, color: crystalColor },
      { x: -16, y: -9, width: 8, height: 18, color: crystalColor },
      { x: -10, y: -21, width: 4, height: 6, color: 0xa9dce5 },
      { x: -5, y: -14, width: 9, height: 24, color: 0x386f87 },
      { x: -2, y: -20, width: 5, height: 8, color: 0x749eae },
      { x: 4, y: -9, width: 11, height: 19, color: 0x416f86 },
      { x: 7, y: -15, width: 5, height: 8, color: 0x749eae },
      { x: -10, y: -14, width: 2, height: 9, color: 0xd3f4f3 },
      { x: -1, y: -12, width: 2, height: 8, color: 0xb9eef4 },
      { x: 8, y: -8, width: 2, height: 6, color: 0xc9f3f5 },
    ]);
  }

  private drawRoomRootRim(room: DungeonGraph["rooms"][string], layout: DungeonPixelLayout["rooms"][string]) {
    if (this.graph.regionId !== "mata-encantada") return;
    const roots = this.scene.add.graphics().setDepth(1.12);
    const rootColor = Number.parseInt(this.palette.floorDetail.slice(1), 16);
    const mossColor = Number.parseInt(this.palette.wallHighlight.slice(1), 16);
    const inset = DUNGEON_TILE_SIZE + 5;
    const span = 27;
    const corners = [
      { x: layout.left + inset, y: layout.top + inset, sx: 1, sy: 1 },
      { x: layout.left + layout.width - inset, y: layout.top + inset, sx: -1, sy: 1 },
      { x: layout.left + inset, y: layout.top + layout.height - inset, sx: 1, sy: -1 },
      { x: layout.left + layout.width - inset, y: layout.top + layout.height - inset, sx: -1, sy: -1 },
    ];
    for (const corner of corners) {
      const horizontalX = corner.sx > 0 ? corner.x : corner.x - span;
      const verticalY = corner.sy > 0 ? corner.y : corner.y - span;
      roots.fillStyle(rootColor, 0.29)
        .fillRect(horizontalX, corner.y, span, 3)
        .fillRect(corner.x, verticalY, 3, span);
      roots.fillStyle(mossColor, 0.18)
        .fillRect(corner.x + corner.sx * 9, corner.y + corner.sy * 8, 4, 2)
        .fillRect(corner.x + corner.sx * 16, corner.y + corner.sy * 15, 3, 2);
    }
  }

  private drawBiomeFloorMarks(
    room: DungeonGraph["rooms"][string],
    tiles: number[][],
    layout: DungeonPixelLayout["rooms"][string],
  ) {
    const height = tiles.length;
    const width = tiles[0]?.length ?? 0;
    if (width < 8 || height < 8) return;

    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const candidates: RoomSpawnPoint[] = [];
    for (let tileY = 1; tileY < height - 1; tileY += 1) {
      for (let tileX = 1; tileX < width - 1; tileX += 1) {
        const edgeDistance = Math.min(tileX, tileY, width - 1 - tileX, height - 1 - tileY);
        if (edgeDistance < 2 || edgeDistance > 3) continue;
        if (
          tiles[tileY][tileX] === ROOM_WALL_TILE
          || tiles[tileY][tileX] === ROOM_OBSTACLE_TILE
          || tiles[tileY][tileX] === ROOM_WATER_TILE
          || tiles[tileY][tileX] === ROOM_RUNE_TILE
        ) continue;
        if (Math.hypot(tileX - centerX, tileY - centerY) < 3.5) continue;

        const nearDoor = (
          (room.connections.north && tileY <= 3 && Math.abs(tileX - centerX) <= 2)
          || (room.connections.south && tileY >= height - 4 && Math.abs(tileX - centerX) <= 2)
          || (room.connections.west && tileX <= 3 && Math.abs(tileY - centerY) <= 2)
          || (room.connections.east && tileX >= width - 4 && Math.abs(tileY - centerY) <= 2)
        );
        if (nearDoor) continue;
        candidates.push({
          x: layout.left + (tileX + 0.5) * DUNGEON_TILE_SIZE,
          y: layout.top + (tileY + 0.5) * DUNGEON_TILE_SIZE,
        });
      }
    }

    const markCount = room.size === "large" ? 4 : room.size === "small" ? 2 : 3;
    const marks = createSeededRandom(`${this.graph.seed}:${room.id}:biome-floor-marks-v1`)
      .shuffle(candidates)
      .slice(0, markCount);
    marks.forEach((point, index) => this.drawBiomeFloorMark(point.x, point.y, index));
  }

  private drawBiomeFloorMark(x: number, y: number, variant: number) {
    const pixels: PixelRect[] = [];
    const addPixel = (px: number, py: number, width: number, height: number, color: number, alpha = 0.72) => {
      pixels.push({
        x: Math.round(px - width / 2),
        y: Math.round(py - height / 2),
        width,
        height,
        color,
        alpha,
      });
    };

    if (this.graph.regionId === "mata-encantada") {
      const root = variant % 2 ? 0x3d5339 : 0x40563a;
      addPixel(-4, 2, 10, 3, root);
      addPixel(-1, -2, 3, 7, root);
      addPixel(4, -4, 5, 2, 0x4a6140, 0.58);
      drawPixelLayer(this.scene, x, y, 1.25, pixels);
      return;
    }

    if (this.graph.regionId === "arquipelago-das-mares") {
      const tide = variant % 2 ? 0x32616b : 0x356570;
      addPixel(-5, -2, 8, 2, tide, 0.62);
      addPixel(-1, 1, 11, 2, tide, 0.66);
      addPixel(4, -4, 4, 2, 0x5b8a91, 0.45);
      drawPixelLayer(this.scene, x, y, 1.25, pixels);
      return;
    }

    const slate = variant % 2 ? 0x465d70 : 0x485f72;
    addPixel(-2, -5, 4, 3, slate, 0.68);
    addPixel(-5, -2, 10, 4, slate, 0.68);
    addPixel(-2, 2, 4, 3, slate, 0.68);
    addPixel(-1, -1, 2, 2, 0x71889a, 0.5);
    drawPixelLayer(this.scene, x, y, 1.25, pixels);
  }

  private drawBiomeProp(
    x: number,
    y: number,
    frame: number,
    depth: number,
    displaySize = DUNGEON_BIOME_PROP_DISPLAY_SIZE,
  ) {
    if (!this.scene.textures.exists(DUNGEON_BIOME_PROPS_TEXTURE_KEY)) return null;
    return this.scene.add.image(
      Math.round(x),
      Math.round(y),
      DUNGEON_BIOME_PROPS_TEXTURE_KEY,
      frame,
    ).setOrigin(0.5).setDisplaySize(displaySize, displaySize).setDepth(depth);
  }

  private drawAmbientDetails(
    room: DungeonGraph["rooms"][string],
    tiles: number[][],
    layout: DungeonPixelLayout["rooms"][string],
  ) {
    this.ensureAmbientRoom(room.id);
    const random = createSeededRandom(`${this.graph.seed}:${room.id}:ambient-v1`);
    const obstacles: Array<{ x: number; y: number }> = [];
    const water: Array<{ x: number; y: number }> = [];
    const runes: Array<{ x: number; y: number }> = [];
    const walkable: Array<{ x: number; y: number }> = [];

    tiles.forEach((row, tileY) => row.forEach((tile, tileX) => {
      const point = {
        x: layout.left + (tileX + 0.5) * DUNGEON_TILE_SIZE,
        y: layout.top + (tileY + 0.5) * DUNGEON_TILE_SIZE,
      };
      if (tile === ROOM_OBSTACLE_TILE) obstacles.push(point);
      else if (tile === ROOM_WATER_TILE) water.push(point);
      else if (tile === ROOM_RUNE_TILE) runes.push(point);
      else if (tile !== ROOM_WALL_TILE) walkable.push(point);
    }));

    if (this.graph.regionId === "mata-encantada") {
      obstacles.forEach((point) => this.drawForestTree(point.x, point.y));
      const pattern = ARPG_ROOM_TEMPLATE_BY_ID.get(room.templateId)?.pattern;
      if (["ruins", "shrine", "altar", "ancestral-arena", "camp"].includes(pattern ?? "")) {
        this.drawForestTorch(room.id, layout.left + DUNGEON_TILE_SIZE * 1.5, layout.top + DUNGEON_TILE_SIZE * 1.5);
        this.drawForestTorch(room.id, layout.left + layout.width - DUNGEON_TILE_SIZE * 1.5, layout.top + DUNGEON_TILE_SIZE * 1.5);
      } else {
        random.shuffle(walkable).slice(0, 2).forEach((point, index) => this.drawFirefly(room.id, point.x, point.y, index * 620));
      }
      random.shuffle(walkable).slice(0, 3).forEach((point, index) => this.drawForestLeaf(room.id, point.x, point.y, index * 740 + random.int(0, 360)));
    }

    const waterShimmerColor = this.graph.regionId === "mata-encantada"
      ? 0xa5d7ae
      : this.graph.regionId === "arquipelago-das-mares" ? 0x9cebf1 : 0xc6e9ff;
    const waterDetails = random.shuffle(water)
      .slice(0, this.graph.regionId === "arquipelago-das-mares" ? 6 : 4);
    waterDetails.forEach((point, index) => {
      this.drawWaterShimmer(room.id, point.x, point.y, index * 170 + random.int(0, 420), waterShimmerColor);
      if (this.graph.regionId === "arquipelago-das-mares" && index === 0) {
        const spring = this.drawBiomeProp(point.x, point.y, DUNGEON_BIOME_PROP_FRAME.maresSpring, 2.7);
        if (spring) {
          const tween = this.scene.tweens.add({
            targets: spring,
            alpha: { from: 0.9, to: 1 },
            duration: 1_550,
            yoyo: true,
            repeat: -1,
          });
          this.registerAmbientFx(room.id, [spring], tween);
        }
      }
    });

    if (this.graph.regionId === "montanhas-runicas") {
      obstacles.forEach((point) => this.drawMountainCrystal(room.id, point.x, point.y));
      random.shuffle(runes).slice(0, 5).forEach((point, index) => this.drawRuneSpark(room.id, point.x, point.y, index * 190 + random.int(0, 500)));
    }
  }

  private drawMataStartRoomDressing(
    room: DungeonGraph["rooms"][string],
    tiles: number[][],
    layout: DungeonPixelLayout["rooms"][string],
  ) {
    if (this.graph.regionId !== "mata-encantada" || room.id !== this.graph.startRoomId) return;
    const height = tiles.length;
    const width = tiles[0]?.length ?? 0;
    if (width < 9 || height < 9) return;

    const center = { x: layout.centerX, y: layout.centerY };
    const chestAnchor = { x: layout.centerX, y: layout.centerY + 80 };
    const doorAnchors = Object.values(layout.doorCenters).filter((point): point is { x: number; y: number } => Boolean(point));
    const obstacleAnchors: RoomSpawnPoint[] = [];
    tiles.forEach((row, tileY) => row.forEach((tile, tileX) => {
      if (tile === ROOM_OBSTACLE_TILE) {
        obstacleAnchors.push({
          x: layout.left + (tileX + 0.5) * DUNGEON_TILE_SIZE,
          y: layout.top + (tileY + 0.5) * DUNGEON_TILE_SIZE,
        });
      }
    }));
    const baseTileData = { width, height, data: tiles };
    const enemyAnchors = room.waves.flatMap((wave) => createSafeRoomSpawnPoints(baseTileData, wave.length).map((point) => ({
      x: layout.left + point.x,
      y: layout.top + point.y,
    })));
    const corners = [
      { tileX: 3, tileY: 3, flipX: false, flipY: false, torch: true },
      { tileX: width - 4, tileY: 3, flipX: true, flipY: false, torch: true },
      { tileX: 3, tileY: height - 4, flipX: false, flipY: true, torch: false },
      { tileX: width - 4, tileY: height - 4, flipX: true, flipY: true, torch: false },
    ];

    // The opening clearing is intentionally kept free through its center and
    // doors; small ruin remnants and warm torchlight frame only its diagonals.
    corners.forEach((corner, variant) => {
      const tile = tiles[corner.tileY]?.[corner.tileX];
      if (
        tile === undefined
        || tile === ROOM_WALL_TILE
        || tile === ROOM_OBSTACLE_TILE
        || tile === ROOM_WATER_TILE
        || tile === ROOM_RUNE_TILE
      ) return;

      const point = {
        x: layout.left + (corner.tileX + 0.5) * DUNGEON_TILE_SIZE,
        y: layout.top + (corner.tileY + 0.5) * DUNGEON_TILE_SIZE,
      };
      if (Math.hypot(point.x - center.x, point.y - center.y) < 176) return;
      if (Math.hypot(point.x - chestAnchor.x, point.y - chestAnchor.y) < 126) return;
      if (doorAnchors.some((door) => Math.hypot(point.x - door.x, point.y - door.y) < 120)) return;
      if (enemyAnchors.some((spawn) => Math.hypot(point.x - spawn.x, point.y - spawn.y) < 128)) return;
      if (obstacleAnchors.some((obstacle) => Math.hypot(point.x - obstacle.x, point.y - obstacle.y) < 78)) return;

      this.drawMataStartRuinCluster(point.x, point.y, variant, corner.flipX, corner.flipY);
      if (corner.torch) this.drawForestTorch(room.id, point.x, point.y - 16);
    });
  }

  private drawMataStartRuinCluster(x: number, y: number, variant: number, flipX: boolean, flipY: boolean) {
    const prop = this.drawBiomeProp(x, y, DUNGEON_BIOME_PROP_FRAME.mataRuin, 2.8);
    if (prop) {
      prop.setFlipX(flipX).setFlipY(flipY);
      return;
    }

    const stone = variant % 2 ? 0x566151 : 0x4f5a4c;
    const shade = variant % 2 ? 0x333d33 : 0x29352b;
    const moss = variant % 2 ? 0x809253 : 0x71834b;
    const orient = (pixels: readonly PixelRect[]) => pixels.map((pixel) => ({
      ...pixel,
      x: flipX ? -pixel.x - pixel.width : pixel.x,
      y: flipY ? -pixel.y - pixel.height : pixel.y,
    }));

    drawPixelLayer(this.scene, x, y, 1.14, [
      { x: -20, y: 12, width: 40, height: 5, color: 0x17241a, alpha: 0.42 },
      { x: -14, y: 9, width: 28, height: 3, color: 0x17241a, alpha: 0.36 },
    ]);
    drawPixelLayer(this.scene, x, y, 1.2, orient([
      { x: -25, y: 9, width: 17, height: 3, color: 0x342a1e },
      { x: -19, y: 6, width: 11, height: 3, color: 0x60412b },
      { x: -15, y: 11, width: 3, height: 5, color: 0x60412b },
      { x: 8, y: 10, width: 17, height: 3, color: 0x342a1e },
      { x: 12, y: 7, width: 9, height: 3, color: 0x725b36 },
      { x: 17, y: 10, width: 3, height: 5, color: 0x60412b },
    ]));
    drawPixelLayer(this.scene, x, y, 2.15, orient([
      { x: -18, y: -20, width: 15, height: 34, color: shade },
      { x: 3, y: -15, width: 16, height: 29, color: shade },
      { x: -21, y: -17, width: 19, height: 7, color: shade },
      { x: 1, y: -12, width: 21, height: 7, color: shade },
      { x: -23, y: 8, width: 24, height: 7, color: shade },
      { x: 0, y: 9, width: 24, height: 6, color: shade },
    ]));
    drawPixelLayer(this.scene, x, y, 2.25, orient([
      { x: -16, y: -17, width: 10, height: 28, color: stone },
      { x: 5, y: -12, width: 11, height: 23, color: stone },
      { x: -19, y: -15, width: 13, height: 3, color: 0x69745f },
      { x: 4, y: -10, width: 11, height: 3, color: 0x69745f },
      { x: -20, y: 9, width: 18, height: 4, color: 0x4f5a4c },
      { x: 3, y: 10, width: 18, height: 3, color: 0x4f5a4c },
      { x: -4, y: -6, width: 5, height: 2, color: 0x303b31 },
      { x: 10, y: 1, width: 3, height: 2, color: 0x303b31 },
    ]));
    drawPixelLayer(this.scene, x, y, 2.8, orient([
      { x: -18, y: -13, width: 5, height: 2, color: moss, alpha: 0.88 },
      { x: -8, y: -8, width: 4, height: 2, color: 0x91a956, alpha: 0.82 },
      { x: 7, y: -7, width: 6, height: 2, color: moss, alpha: 0.88 },
      { x: -24, y: 4, width: 8, height: 4, color: 0x24452e },
      { x: -20, y: 0, width: 7, height: 4, color: 0x3d7042 },
      { x: -16, y: 4, width: 8, height: 3, color: 0x789251 },
      { x: 14, y: 3, width: 9, height: 4, color: 0x24452e },
      { x: 18, y: 0, width: 7, height: 3, color: 0x3d7042 },
      { x: 11, y: 5, width: 8, height: 3, color: 0x789251 },
    ]));
  }

  private drawForestTree(x: number, y: number) {
    drawPixelLayer(this.scene, x, y, 2, [
      { x: -18, y: 9, width: 36, height: 7, color: 0x111a14, alpha: 0.64 },
      { x: -12, y: 6, width: 24, height: 4, color: 0x111a14, alpha: 0.52 },
    ]);
    if (this.drawBiomeProp(x, y, DUNGEON_BIOME_PROP_FRAME.mataTree, 4)) return;

    drawPixelLayer(this.scene, x, y, 3, [
      { x: -4, y: -2, width: 8, height: 26, color: 0x60412b },
      { x: -2, y: 0, width: 3, height: 20, color: 0x84613a },
      { x: -11, y: 16, width: 7, height: 3, color: 0x60412b },
      { x: 4, y: 16, width: 7, height: 3, color: 0x60412b },
    ]);
    drawPixelLayer(this.scene, x, y, 4, [
      { x: -14, y: -24, width: 28, height: 8, color: 0x1c3826 },
      { x: -20, y: -18, width: 40, height: 15, color: 0x24452e },
      { x: -16, y: -5, width: 32, height: 9, color: 0x24452e },
      { x: -12, y: -27, width: 24, height: 8, color: 0x315b37 },
      { x: -16, y: -18, width: 32, height: 14, color: 0x3d7042 },
      { x: -10, y: -5, width: 20, height: 8, color: 0x3d7042 },
      { x: -8, y: -30, width: 14, height: 5, color: 0x4c8050 },
      { x: -12, y: -19, width: 8, height: 5, color: 0x8eab58 },
      { x: 4, y: -16, width: 8, height: 4, color: 0x8eab58 },
      { x: -5, y: -7, width: 5, height: 3, color: 0xa4b761 },
    ]);
  }

  private drawForestTorch(roomId: string, x: number, y: number) {
    const glow = drawPixelLayer(this.scene, x, y, 3, [
      { x: -9, y: -6, width: 18, height: 9, color: 0xff9e3b, alpha: 0.1 },
      { x: -6, y: -10, width: 12, height: 16, color: 0xffb447, alpha: 0.13 },
    ]);
    const post = this.drawBiomeProp(x, y, DUNGEON_BIOME_PROP_FRAME.mataTorch, 4) ?? drawPixelLayer(this.scene, x, y, 4, [
      { x: -3, y: 2, width: 6, height: 22, color: 0x65442e },
      { x: -2, y: 4, width: 2, height: 18, color: 0x95643b },
      { x: -6, y: 1, width: 12, height: 3, color: 0x8a633e },
    ]);
    const flame = drawPixelLayer(this.scene, x, y, 5, [
      { x: -2, y: -12, width: 4, height: 4, color: 0xffe18a },
      { x: -5, y: -8, width: 10, height: 5, color: 0xffc453 },
      { x: -3, y: -5, width: 6, height: 5, color: 0xff733a },
    ]);
    const innerFlame = drawPixelLayer(this.scene, x, y, 6, [
      { x: -1, y: -8, width: 2, height: 3, color: 0xfff1ac },
      { x: -2, y: -5, width: 4, height: 3, color: 0xff8841 },
    ]);
    const tween = this.scene.tweens.add({
      targets: flame,
      alpha: { from: 0.76, to: 1 },
      duration: 430,
      yoyo: true,
      repeat: -1,
    });
    this.registerAmbientFx(roomId, [glow, post, flame, innerFlame], tween);
  }

  private drawFirefly(roomId: string, x: number, y: number, delay: number) {
    const firefly = drawPixelLayer(this.scene, x, y, 7, [
      { x: -2, y: -2, width: 4, height: 4, color: 0x809b50, alpha: 0.62 },
      { x: -1, y: -1, width: 2, height: 2, color: 0xe3f5a8, alpha: 0.92 },
    ]);
    const tween = this.scene.tweens.add({
      targets: firefly,
      alpha: { from: 0.2, to: 0.85 },
      duration: 1500,
      delay,
      yoyo: true,
      repeat: -1,
    });
    this.registerAmbientFx(roomId, [firefly], tween);
  }

  private drawForestLeaf(roomId: string, x: number, y: number, delay: number) {
    const leaf = drawPixelLayer(this.scene, x, y, 7, [
      { x: -4, y: 0, width: 5, height: 2, color: 0x789251, alpha: 0.8 },
      { x: 0, y: -2, width: 5, height: 3, color: 0xb8d27b, alpha: 0.9 },
      { x: 3, y: -3, width: 2, height: 2, color: 0xd9e6a0, alpha: 0.74 },
    ]);
    const tween = this.scene.tweens.add({
      targets: leaf,
      alpha: { from: 0.22, to: 0.82 },
      duration: 2_300,
      delay,
      yoyo: true,
      repeat: -1,
    });
    this.registerAmbientFx(roomId, [leaf], tween);
  }

  private drawWaterShimmer(roomId: string, x: number, y: number, delay: number, color: number) {
    const shimmer = drawPixelLayer(this.scene, x, y, 2, [
      { x: -8, y: 0, width: 16, height: 2, color, alpha: 0.54 },
      { x: -4, y: -2, width: 7, height: 2, color: 0xe1ffff, alpha: 0.5 },
      { x: 4, y: 2, width: 5, height: 2, color, alpha: 0.4 },
    ]);
    const tween = this.scene.tweens.add({
      targets: shimmer,
      alpha: { from: 0.08, to: 0.5 },
      duration: 1150,
      delay,
      yoyo: true,
      repeat: -1,
    });
    this.registerAmbientFx(roomId, [shimmer], tween);
  }

  private drawMountainCrystal(roomId: string, x: number, y: number) {
    const shadow = drawPixelLayer(this.scene, x, y, 2, [
      { x: -18, y: 10, width: 36, height: 7, color: 0x172633, alpha: 0.56 },
      { x: -12, y: 7, width: 24, height: 4, color: 0x172633, alpha: 0.42 },
    ]);
    const crystal = this.drawBiomeProp(x, y, DUNGEON_BIOME_PROP_FRAME.mountainCrystal, 4) ?? drawPixelLayer(this.scene, x, y, 4, [
      { x: -17, y: 4, width: 10, height: 9, color: 0x31516a },
      { x: -13, y: -1, width: 8, height: 7, color: 0x386d84 },
      { x: -11, y: -10, width: 6, height: 11, color: 0x5db8c8 },
      { x: -8, y: -19, width: 5, height: 11, color: 0x5db8c8 },
      { x: -5, y: -25, width: 4, height: 8, color: 0x8de0e8 },
      { x: -5, y: -11, width: 8, height: 19, color: 0x4e9db2 },
      { x: -2, y: -18, width: 5, height: 8, color: 0x73cfdb },
      { x: 3, y: -3, width: 10, height: 16, color: 0x3e829c },
      { x: 6, y: -12, width: 5, height: 10, color: 0x65b6c7 },
      { x: -8, y: -17, width: 2, height: 8, color: 0xdafaff },
      { x: -1, y: -11, width: 2, height: 7, color: 0xb9eef4 },
      { x: 7, y: -7, width: 2, height: 6, color: 0xc8f4f5 },
    ]);
    const tween = this.scene.tweens.add({
      targets: crystal,
      alpha: { from: 0.62, to: 1 },
      duration: 1250,
      yoyo: true,
      repeat: -1,
    });
    this.registerAmbientFx(roomId, [shadow, crystal], tween);
  }

  private drawRuneSpark(roomId: string, x: number, y: number, delay: number) {
    const spark = drawPixelLayer(this.scene, x, y, 4, [
      { x: -1, y: -5, width: 2, height: 11, color: 0x77bad0, alpha: 0.76 },
      { x: -5, y: -1, width: 11, height: 2, color: 0x77bad0, alpha: 0.76 },
      { x: -2, y: -2, width: 4, height: 4, color: 0xb5edff, alpha: 0.96 },
    ]);
    const tween = this.scene.tweens.add({
      targets: spark,
      alpha: { from: 0.18, to: 0.82 },
      duration: 1150,
      delay,
      yoyo: true,
      repeat: -1,
    });
    this.registerAmbientFx(roomId, [spark], tween);
  }

  private ensureAmbientRoom(roomId: string) {
    let room = this.ambientByRoom.get(roomId);
    if (!room) {
      room = { fx: [] };
      this.ambientByRoom.set(roomId, room);
    }
    return room;
  }

  private registerAmbientFx(roomId: string, visuals: AmbientVisual[], tween: import("phaser").Tweens.Tween) {
    const fx = { visuals, tween };
    this.ensureAmbientRoom(roomId).fx.push(fx);
    this.setAmbientFxActive(fx, this.activeAmbientRoomId === roomId);
  }

  private setAmbientFxActive(fx: AmbientFxEntry, active: boolean) {
    fx.visuals.forEach((visual) => { visual.visible = active; });
    if (active) fx.tween.resume();
    else fx.tween.pause();
  }

  private activateAmbientRoom(roomId: string) {
    if (!this.layout.rooms[roomId]) return;
    this.activeAmbientRoomId = roomId;
    this.ambientByRoom.forEach((room, id) => {
      room.fx.forEach((fx) => this.setAmbientFxActive(fx, id === roomId));
    });
  }

  getAmbientDebugState(): DungeonAmbientDebugState {
    const rooms = Object.values(this.graph.rooms).map(({ id: roomId }) => {
      const fx = this.ambientByRoom.get(roomId)?.fx ?? [];
      const pausedTweens = fx.filter((entry) => entry.tween.isPaused()).length;
      const pausedFx = fx.filter((entry) => entry.visuals.every((visual) => !visual.visible)).length;
      return {
        roomId,
        tweens: { active: fx.length - pausedTweens, paused: pausedTweens },
        fx: { active: fx.length - pausedFx, paused: pausedFx },
      };
    });
    return { activeRoomId: this.activeAmbientRoomId, rooms };
  }

  private doorKey(roomId: string, direction: DungeonDirection) {
    return `${roomId}:${direction}`;
  }

  private createDoors() {
    for (const room of Object.values(this.graph.rooms)) {
      const layout = this.layout.rooms[room.id];
      for (const direction of Object.keys(room.connections) as DungeonDirection[]) {
        const point = layout.doorCenters[direction];
        if (!point) continue;
        const horizontal = direction === "north" || direction === "south";
        const offset = direction === "north" ? { x: 0, y: -20 }
          : direction === "south" ? { x: 0, y: 20 }
            : direction === "east" ? { x: 20, y: 0 }
              : { x: -20, y: 0 };
        const visual = this.scene.add.rectangle(
          point.x + offset.x,
          point.y + offset.y,
          horizontal ? 96 : 24,
          horizontal ? 24 : 96,
          this.palette.door,
          0,
        ).setDepth(6).setVisible(false);
        this.scene.physics.add.existing(visual, true);
        const body = (visual as typeof visual & { body: import("phaser").Physics.Arcade.StaticBody }).body;
        body.enable = false;
        this.doors.set(this.doorKey(room.id, direction), {
          visual, body,
          openX: point.x + offset.x,
          openY: point.y + offset.y,
          closedX: point.x,
          closedY: point.y,
          locked: false,
          state: "open",
        });
      }
    }
  }

  attachPlayer(player: import("phaser").Physics.Arcade.Sprite) {
    for (const layer of this.wallLayers) this.scene.physics.add.collider(player, layer);
    for (const wall of this.corridorWalls) this.scene.physics.add.collider(player, wall);
    for (const door of this.doors.values()) this.scene.physics.add.collider(player, door.visual);
  }

  attachEnemies(enemies: import("phaser").Physics.Arcade.Group) {
    for (const layer of this.wallLayers) this.scene.physics.add.collider(enemies, layer);
    for (const wall of this.corridorWalls) this.scene.physics.add.collider(enemies, wall);
    for (const door of this.doors.values()) this.scene.physics.add.collider(enemies, door.visual);
  }

  setDoorsLocked(roomId: string, locked: boolean) {
    const room = this.graph.rooms[roomId];
    if (!room) return;
    let changed = false;
    for (const direction of Object.keys(room.connections) as DungeonDirection[]) {
      const entry = this.doors.get(this.doorKey(roomId, direction));
      if (!entry || entry.locked === locked) continue;
      changed = true;
      entry.locked = locked;
      this.scene.tweens.killTweensOf(entry.visual);
      if (locked) {
        entry.state = "closing";
        entry.visual.setPosition(entry.openX, entry.openY).setAlpha(0.2).setVisible(true).setFillStyle(this.palette.door, 1);
        entry.body.enable = true;
        entry.body.updateFromGameObject();
        this.scene.tweens.add({
          targets: entry.visual,
          x: entry.closedX,
          y: entry.closedY,
          alpha: 1,
          duration: 180,
          ease: "Quad.easeIn",
          onUpdate: () => entry.body.updateFromGameObject(),
          onComplete: () => {
            entry.state = "closed";
            entry.body.updateFromGameObject();
          },
        });
        this.emitDoorDust(entry.closedX, entry.closedY);
      } else {
        entry.state = "opening";
        entry.body.enable = false;
        this.scene.tweens.add({
          targets: entry.visual,
          x: entry.openX,
          y: entry.openY,
          alpha: 0,
          duration: 170,
          ease: "Quad.easeOut",
          onComplete: () => {
            entry.state = "open";
            entry.visual.setVisible(false).setPosition(entry.openX, entry.openY);
            entry.body.updateFromGameObject();
          },
        });
      }
    }
    if (changed) this.onDoorsLockedChange?.(locked);
  }

  private emitDoorDust(x: number, y: number) {
    const dustColor = Number.parseInt(this.palette.wallHighlight.slice(1), 16);
    for (const offset of [-16, 0, 16]) {
      const dust = this.scene.add.rectangle(x + offset, y, 5, 4, dustColor, 0.8).setDepth(7);
      this.scene.tweens.add({
        targets: dust,
        x: x + offset + (offset === 0 ? 0 : Math.sign(offset) * 8),
        y: y + 10,
        alpha: 0,
        duration: 260,
        onComplete: () => dust.destroy(),
      });
    }
  }

  getRoomCenter(roomId: string) {
    const room = this.layout.rooms[roomId];
    if (!room) throw new Error(`Layout da sala ${roomId} não encontrado.`);
    return { x: room.centerX, y: room.centerY };
  }

  getDoorDebugStates(roomId: string) {
    const room = this.graph.rooms[roomId];
    if (!room) return [];
    return (Object.keys(room.connections) as DungeonDirection[]).map((direction) => {
      const entry = this.doors.get(this.doorKey(roomId, direction));
      return {
        direction,
        targetRoomId: room.connections[direction],
        locked: entry?.locked ?? false,
        state: entry?.state ?? "open",
        colliderEnabled: entry?.body.enable ?? false,
        x: entry ? Math.round(entry.visual.x) : null,
        y: entry ? Math.round(entry.visual.y) : null,
        openX: entry ? Math.round(entry.openX) : null,
        openY: entry ? Math.round(entry.openY) : null,
      };
    });
  }

  findRoomAt(x: number, y: number, inset = 0) {
    for (const room of Object.values(this.graph.rooms)) {
      const layout = this.layout.rooms[room.id];
      if (
        x >= layout.left + inset
        && x <= layout.left + layout.width - inset
        && y >= layout.top + inset
        && y <= layout.top + layout.height - inset
      ) return room;
    }
    return null;
  }

  getEnemySpawnPoints(roomId: string, count: number): RoomSpawnPoint[] {
    const room = this.graph.rooms[roomId];
    const layout = this.layout.rooms[roomId];
    if (!room || !layout) return [];
    const tileData = buildRoomTileData(room.templateId, room.connections, this.graph.seed);
    return createSafeRoomSpawnPoints(tileData, count).map((point) => ({
      x: layout.left + point.x,
      y: layout.top + point.y,
    }));
  }

  focusCamera(roomId: string) {
    const room = this.layout.rooms[roomId];
    if (!room) return;
    this.activateAmbientRoom(roomId);
    const camera = this.scene.cameras.main;
    // The scene keeps following the Legend; focus changes only the active room's
    // ambience. Full-map bounds let the camera travel continuously through doors.
    camera.setBounds(0, 0, this.layout.width, this.layout.height);
  }

  getWorldSize() {
    return { width: this.layout.width, height: this.layout.height };
  }
}
