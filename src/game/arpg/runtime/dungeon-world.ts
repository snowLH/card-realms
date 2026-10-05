import { DUNGEON_TILE_SIZE, buildDungeonPixelLayout, type DungeonPixelLayout } from "../dungeon/layout";
import { ARPG_ROOM_TEMPLATE_BY_ID } from "../dungeon/templates";
import { createSeededRandom } from "../dungeon/rng";
import { buildRoomTileData, createSafeRoomSpawnPoints, ROOM_OBSTACLE_TILE, ROOM_RUNE_TILE, ROOM_WALL_TILE, ROOM_WATER_TILE, type RoomSpawnPoint } from "../dungeon/room-tilemap";
import type { DungeonDirection, DungeonGraph } from "../dungeon/types";

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

export type DungeonAmbientDebugState = Readonly<{
  activeRoomId: string | null;
  rooms: ReadonlyArray<Readonly<{
    roomId: string;
    tweens: Readonly<{ active: number; paused: number }>;
    fx: Readonly<{ active: number; paused: number }>;
  }>>;
}>;

const MATA_PALETTE: DungeonPalette = {
  floor: "#304735", floorDetail: "#38523d", wall: "#1d241f", wallDetail: "#4f5a4c", wallHighlight: "#69745f",
  corridor: 0x304735, collision: 0x1d241f, door: 0x7d4d31,
  water: "#234047",
};
const MARES_PALETTE: DungeonPalette = {
  floor: "#244957", floorDetail: "#2e6370", wall: "#142a33", wallDetail: "#3f7480", wallHighlight: "#6ca4aa",
  corridor: 0x244957, collision: 0x142a33, door: 0x396f80,
  water: "#1a5e78",
};
const RUNIC_PALETTE: DungeonPalette = {
  floor: "#34495b", floorDetail: "#52697c", wall: "#1c2835", wallDetail: "#536b7d", wallHighlight: "#a8c9da",
  corridor: 0x34495b, collision: 0x1c2835, door: 0x6a8797,
  water: "#416b82",
};

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

  build() {
    this.ensureTileTexture();
    this.drawCorridors();
    this.drawRooms();
    this.createDoors();
    this.scene.physics.world.setBounds(0, 0, this.layout.width, this.layout.height);
    return this;
  }

  private ensureTileTexture() {
    const key = this.tileTextureKey;
    if (this.scene.textures.exists(key)) return;
    const texture = this.scene.textures.createCanvas(key, DUNGEON_TILE_SIZE * 6, DUNGEON_TILE_SIZE);
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
    context.fillRect(3, 3, 12, 3);
    context.fillRect(18, 10, 9, 3);
    context.fillRect(8, 23, 5, 3);

    fillTile(1, palette.wall);
    context.fillStyle = palette.wallDetail;
    context.fillRect(tileX(1) + 3, 3, DUNGEON_TILE_SIZE - 6, DUNGEON_TILE_SIZE - 6);
    context.fillStyle = palette.wallHighlight;
    context.fillRect(tileX(1) + 5, 5, DUNGEON_TILE_SIZE - 10, 4);
    context.fillRect(tileX(1) + 7, 19, 8, 3);

    fillTile(2, palette.floor);
    context.fillStyle = palette.wallHighlight;
    context.fillRect(tileX(2) + 4, 5, 8, 4);
    context.fillRect(tileX(2) + 17, 13, 10, 5);
    context.fillStyle = palette.floorDetail;
    context.fillRect(tileX(2) + 8, 21, 15, 4);

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
    texture.refresh();
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

  private drawRooms() {
    const textureKey = this.tileTextureKey;
    for (const room of Object.values(this.graph.rooms)) {
      const tileData = buildRoomTileData(room.templateId, room.connections, this.graph.seed);
      const map = this.scene.make.tilemap({
        data: tileData.data,
        tileWidth: DUNGEON_TILE_SIZE,
        tileHeight: DUNGEON_TILE_SIZE,
      });
      const tileset = map.addTilesetImage(textureKey, textureKey, DUNGEON_TILE_SIZE, DUNGEON_TILE_SIZE, 0, 0);
      if (!tileset) throw new Error(`Tileset procedural ausente para ${room.id}.`);
      const layout = this.layout.rooms[room.id];
      const layer = map.createLayer(0, tileset, layout.left, layout.top);
      if (!layer) throw new Error(`Não foi possível criar o tilemap da sala ${room.id}.`);
      layer.setDepth(1);
      layer.setCollision([ROOM_WALL_TILE, ROOM_OBSTACLE_TILE]);
      this.wallLayers.push(layer);
      this.drawAmbientDetails(room, tileData.data, layout);
    }
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
    random.shuffle(water).slice(0, this.graph.regionId === "arquipelago-das-mares" ? 6 : 4)
      .forEach((point, index) => this.drawWaterShimmer(room.id, point.x, point.y, index * 170 + random.int(0, 420), waterShimmerColor));

    if (this.graph.regionId === "montanhas-runicas") {
      obstacles.forEach((point) => this.drawMountainCrystal(room.id, point.x, point.y));
      random.shuffle(runes).slice(0, 5).forEach((point, index) => this.drawRuneSpark(room.id, point.x, point.y, index * 190 + random.int(0, 500)));
    }
  }

  private drawForestTree(x: number, y: number) {
    this.scene.add.ellipse(x, y + 10, 31, 12, 0x111a14, 0.4).setDepth(2);
    this.scene.add.rectangle(x, y + 5, 8, 22, 0x60412b).setDepth(3);
    this.scene.add.circle(x - 8, y - 5, 13, 0x24452e).setDepth(4);
    this.scene.add.circle(x + 7, y - 7, 14, 0x315b37).setDepth(4);
    this.scene.add.circle(x, y - 13, 12, 0x467546).setDepth(4);
    this.scene.add.rectangle(x - 8, y - 13, 5, 3, 0x789251, 0.85).setDepth(5);
    this.scene.add.ellipse(x + 2, y + 13, 20, 5, 0x5c7c42, 0.8).setDepth(5);
  }

  private drawForestTorch(roomId: string, x: number, y: number) {
    this.scene.add.rectangle(x, y + 10, 7, 24, 0x65442e).setDepth(4);
    const glow = this.scene.add.circle(x, y - 4, 13, 0xffb447, 0.12).setDepth(3);
    const flame = this.scene.add.triangle(x, y - 5, 0, -12, -6, 6, 6, 6, 0xffc453, 0.9).setDepth(5);
    const innerFlame = this.scene.add.triangle(x, y - 3, 0, -7, -3, 4, 3, 4, 0xff733a, 0.95).setDepth(6);
    const tween = this.scene.tweens.add({
      targets: flame,
      scaleX: { from: 0.78, to: 1.08 },
      scaleY: { from: 0.92, to: 1.12 },
      alpha: { from: 0.76, to: 1 },
      duration: 430,
      yoyo: true,
      repeat: -1,
    });
    this.registerAmbientFx(roomId, [glow, flame, innerFlame], tween);
  }

  private drawFirefly(roomId: string, x: number, y: number, delay: number) {
    const firefly = this.scene.add.circle(x, y, 2.5, 0xd2e89a, 0.82).setDepth(7);
    const tween = this.scene.tweens.add({
      targets: firefly,
      x: x + 9,
      y: y - 14,
      alpha: { from: 0.2, to: 0.85 },
      scale: { from: 0.7, to: 1.4 },
      duration: 1500,
      delay,
      yoyo: true,
      repeat: -1,
    });
    this.registerAmbientFx(roomId, [firefly], tween);
  }

  private drawForestLeaf(roomId: string, x: number, y: number, delay: number) {
    const leaf = this.scene.add.ellipse(x, y, 5, 2.5, 0xb8d27b, 0.78).setDepth(7);
    const tween = this.scene.tweens.add({
      targets: leaf,
      x: x + 18,
      y: y + 11,
      angle: { from: -18, to: 42 },
      alpha: { from: 0.22, to: 0.82 },
      duration: 2_300,
      delay,
      yoyo: true,
      repeat: -1,
    });
    this.registerAmbientFx(roomId, [leaf], tween);
  }

  private drawWaterShimmer(roomId: string, x: number, y: number, delay: number, color: number) {
    const shimmer = this.scene.add.ellipse(x, y, 17, 3, color, 0.45).setDepth(2);
    const tween = this.scene.tweens.add({
      targets: shimmer,
      x: x + 11,
      alpha: { from: 0.08, to: 0.5 },
      scaleX: { from: 0.55, to: 1.2 },
      duration: 1150,
      delay,
      yoyo: true,
      repeat: -1,
    });
    this.registerAmbientFx(roomId, [shimmer], tween);
  }

  private drawMountainCrystal(roomId: string, x: number, y: number) {
    const shadow = this.scene.add.ellipse(x, y + 8, 27, 9, 0x172633, 0.42).setDepth(2);
    const crystal = this.scene.add.polygon(
      x,
      y - 2,
      [0, -17, 10, -1, 6, 13, -7, 13, -10, -1],
      0x5db8c8,
      0.82,
    ).setStrokeStyle(2, 0xb9eef4, 0.9).setDepth(4);
    const highlight = this.scene.add.polygon(x - 1, y - 6, [0, -8, 4, 1, -1, 7], 0xdafaff, 0.9).setDepth(5);
    const glow = this.scene.add.ellipse(x, y - 7, 25, 35, 0x87d6e7, 0.12).setDepth(3);
    const tween = this.scene.tweens.add({
      targets: crystal,
      alpha: { from: 0.62, to: 1 },
      scaleY: { from: 0.94, to: 1.08 },
      duration: 1250,
      yoyo: true,
      repeat: -1,
    });
    this.registerAmbientFx(roomId, [shadow, crystal, highlight, glow], tween);
  }

  private drawRuneSpark(roomId: string, x: number, y: number, delay: number) {
    const spark = this.scene.add.polygon(x, y, [0, -5, 4, 0, 0, 5, -4, 0], 0xb5edff, 0.82).setDepth(4);
    const tween = this.scene.tweens.add({
      targets: spark,
      angle: 90,
      alpha: { from: 0.18, to: 0.82 },
      scale: { from: 0.6, to: 1.4 },
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
    const width = Math.max(1280, room.width + 224);
    const height = Math.max(720, room.height + 224);
    const maxX = Math.max(0, this.layout.width - width);
    const maxY = Math.max(0, this.layout.height - height);
    const x = Math.max(0, Math.min(maxX, room.centerX - width / 2));
    const y = Math.max(0, Math.min(maxY, room.centerY - height / 2));
    camera.setBounds(x, y, width, height);
    camera.pan(room.centerX, room.centerY, 260, "Sine.easeInOut");
  }

  getWorldSize() {
    return { width: this.layout.width, height: this.layout.height };
  }
}
