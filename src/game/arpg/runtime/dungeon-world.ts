import { DUNGEON_TILE_SIZE, buildDungeonPixelLayout, type DungeonPixelLayout } from "../dungeon/layout";
import { authoredImage } from "../art/runtime-art";
import { DUNGEON_ART, FX_ART, PROP_ART, FOLKLARD_ART_MANIFEST } from "../art/manifest";
import { ARPG_ROOM_TEMPLATE_BY_ID } from "../dungeon/templates";
import { createSeededRandom } from "../dungeon/rng";
import { buildRoomTileData, createSafeRoomSpawnPoints, ROOM_FLOOR_TILE, ROOM_OBSTACLE_TILE, ROOM_RUNE_TILE, ROOM_WALL_TILE, ROOM_WATER_TILE, type RoomSpawnPoint } from "../dungeon/room-tilemap";
import type { DungeonDirection, DungeonGraph } from "../dungeon/types";
import { ARPG_ASSET_MANIFEST } from "../assets";
import { bossForRegion } from "../bosses/registry";
import { createBossRoomPresentation, type BossRoomPresentation } from "../bosses/boss-room-presentation";


type DoorEntry = {
  visual: import("phaser").GameObjects.Image;
  collider: import("phaser").GameObjects.Zone;
  baseFrame:number; sealed:boolean;
  body: import("phaser").Physics.Arcade.StaticBody;
  openX: number;
  openY: number;
  closedX: number;
  closedY: number;
  locked: boolean;
  state: "open" | "closing" | "closed" | "opening";
};


type AmbientVisual = { visible: boolean };

type AmbientFxEntry = {
  visuals: AmbientVisual[];
  tween: import("phaser").Tweens.Tween;
};

type RoomAmbientState = {
  fx: AmbientFxEntry[];
};



/** Positions authored sprites; every collision surface is separate and invisible. */


export type DungeonAmbientDebugState = Readonly<{
  activeRoomId: string | null;
  rooms: ReadonlyArray<Readonly<{
    roomId: string;
    tweens: Readonly<{ active: number; paused: number }>;
    fx: Readonly<{ active: number; paused: number }>;
  }>>;
}>;

const FLOOR_VARIANT_TILES = [6, 7] as const;
const FLOOR_VARIANT_CHANCE = 0.32;

export class DungeonWorldRuntime {
  readonly layout: DungeonPixelLayout;
  private readonly wallLayers: import("phaser").Tilemaps.TilemapLayer[] = [];
  private readonly corridorWalls: import("phaser").GameObjects.Zone[] = [];
  private readonly doors = new Map<string, DoorEntry>();
  private readonly ambientByRoom = new Map<string, RoomAmbientState>();
  private readonly bossRoomArt = new Map<string, BossRoomPresentation>();
  private activeAmbientRoomId: string | null = null;

  constructor(
    private readonly scene: import("phaser").Scene,
    private readonly graph: DungeonGraph,
    private readonly onDoorsLockedChange?: (locked: boolean) => void,
  ) {
    this.layout = buildDungeonPixelLayout(graph);
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

  restoreBossRoomArt(roomId: string) { this.bossRoomArt.get(roomId)?.restore(); }

  private ensureTileTexture() {
  if(this.scene.textures.exists(this.tileTextureKey))return;
  console.error('Missing authored biome tiles: '+this.tileTextureKey);
  const placeholder=FOLKLARD_ART_MANIFEST.missingTiles;
  if(!this.scene.textures.exists(placeholder.key))throw new Error('Authored tile placeholder failed to load.');
  this.scene.textures.addSpriteSheet(this.tileTextureKey,this.scene.textures.get(placeholder.key).getSourceImage() as HTMLImageElement,{frameWidth:32,frameHeight:32,endFrame:7});
}

  private createFloorVariantData(tiles: number[][], roomId: string) {
    const random = createSeededRandom(`${this.graph.seed}:${roomId}:floor-variants-v1`);
    return tiles.map((row) => row.map((tile) => {
      if (tile !== ROOM_FLOOR_TILE || random.next() >= FLOOR_VARIANT_CHANCE) return tile;
      return FLOOR_VARIANT_TILES[random.int(0, FLOOR_VARIANT_TILES.length - 1)];
    }));
  }

  private drawWorldAtmosphere() {
    const camera = this.scene.cameras.main;
    // TileSprite allocates an internal canvas even in WebGL. Keep that canvas
    // viewport-sized, including during cinematic zooms, rather than map-sized.
    const background = this.scene.add.tileSprite(
      camera.width / 2, camera.height / 2, camera.width, camera.height, this.tileTextureKey, 1,
    ).setScrollFactor(0).setTint(0x43504b).setDepth(-2);
    const syncBackground = () => {
      if (background.width !== camera.width || background.height !== camera.height) {
        background.setSize(camera.width, camera.height);
      }
      const zoom = camera.zoom;
      background.setPosition(camera.width / 2, camera.height / 2)
        .setScale(1 / zoom).setTileScale(zoom)
        .setTilePosition(
          camera.scrollX + (camera.width - camera.width / zoom) / 2,
          camera.scrollY + (camera.height - camera.height / zoom) / 2,
        );
    };
    const dispose = () => {
      this.scene.events.off("prerender", syncBackground);
      this.scene.events.off("shutdown", dispose);
      this.scene.events.off("destroy", dispose);
    };
    syncBackground();
    this.scene.events.on("prerender", syncBackground);
    this.scene.events.once("shutdown", dispose);
    this.scene.events.once("destroy", dispose);
  }

  private addStaticWall(x:number,y:number,width:number,height:number) {
  this.scene.add.tileSprite(x,y,width,height,this.tileTextureKey,1).setDepth(2);
  const wall=this.scene.add.zone(x,y,width,height);
  this.scene.physics.add.existing(wall,true);
  this.corridorWalls.push(wall);
  return wall;
}

  private drawCorridors() {
  for(const corridor of this.layout.corridors){
    this.scene.add.tileSprite(corridor.x+corridor.width/2,corridor.y+corridor.height/2,corridor.width,corridor.height,this.tileTextureKey,0).setDepth(0);
    this.drawCorridorSurface(corridor);
    const thickness=24;
    if(corridor.width>corridor.height){
      this.addStaticWall(corridor.x+corridor.width/2,corridor.y-thickness/2,corridor.width,thickness);
      this.addStaticWall(corridor.x+corridor.width/2,corridor.y+corridor.height+thickness/2,corridor.width,thickness);
    }else{
      this.addStaticWall(corridor.x-thickness/2,corridor.y+corridor.height/2,thickness,corridor.height);
      this.addStaticWall(corridor.x+corridor.width+thickness/2,corridor.y+corridor.height/2,thickness,corridor.height);
    }
  }
}

  private drawCorridorSurface(corridor:DungeonPixelLayout['corridors'][number]) {
  const random=createSeededRandom(this.graph.seed+':'+corridor.fromRoomId+':corridor-art');
  const horizontal=corridor.width>corridor.height;
  for(let offset=64;offset<Math.max(corridor.width,corridor.height)-32;offset+=160){
    const x=corridor.x+(horizontal?offset:corridor.width/2);
    const y=corridor.y+(horizontal?corridor.height/2:offset);
    authoredImage(this.scene,x,y,'props',this.graph.regionId==='mata-encantada'?PROP_ART.roots:this.graph.regionId==='arquipelago-das-mares'?PROP_ART.tideMark:PROP_ART.snow,36,36).setDepth(0.1).setAlpha(random.int(30,50)/100);
  }
}

  private drawRooms() {
    const textureKey = this.tileTextureKey;
    for (const room of Object.values(this.graph.rooms)) {
      const bossArt = room.type === "boss" && room.size === "boss"
        ? createBossRoomPresentation(this.scene, bossForRegion(this.graph.regionId).id, {
          x: this.layout.rooms[room.id].left, y: this.layout.rooms[room.id].top,
        }) : null;
      if (bossArt) {
        this.bossRoomArt.set(room.id, bossArt);
        if (room.state === "cleared") bossArt.restore();
      }
      const tileData = buildRoomTileData(room.templateId, room.connections, this.graph.seed);
      const map = this.scene.make.tilemap({
        data: this.createFloorVariantData(tileData.data, room.id),
        tileWidth: DUNGEON_TILE_SIZE,
        tileHeight: DUNGEON_TILE_SIZE,
      });
      const tileset = map.addTilesetImage(textureKey, textureKey, DUNGEON_TILE_SIZE, DUNGEON_TILE_SIZE, 0, 0);
      if (!tileset) throw new Error(`Tileset procedural ausente para ${room.id}.`);
      const layout = this.layout.rooms[room.id];
      if (this.hasArenaArtwork && !bossArt) {
        this.scene.add.image(
          layout.centerX,
          layout.centerY,
          ARPG_ASSET_MANIFEST.runtimeTextureKeys.dungeonBackground,
        ).setDisplaySize(layout.width, layout.height).setDepth(0.8);
      }
      const layer = map.createLayer(0, tileset, layout.left, layout.top);
      if (!layer) throw new Error(`Não foi possível criar o tilemap da sala ${room.id}.`);
      layer.setDepth(1);
      if(!bossArt&&this.hasArenaArtwork)layer.setAlpha(0.18);
      layer.setCollision([ROOM_WALL_TILE, ROOM_OBSTACLE_TILE]);
      if (bossArt) {
        // Invisible seeded collision grid; all visible environment comes from
        // the authored image, including the unobstructed southern entrance.
        layer.setAlpha(0);
      }
      this.wallLayers.push(layer);
      if(!bossArt&&this.hasArenaArtwork){
        // Retain the authored room tableau over a lightly textured floor. Solid
        // walls remain opaque and aligned with the invisible collision grid.
        const wallMap=this.scene.make.tilemap({data:tileData.data.map(row=>row.map(tile=>tile===ROOM_WALL_TILE||tile===ROOM_OBSTACLE_TILE?tile:-1)),tileWidth:DUNGEON_TILE_SIZE,tileHeight:DUNGEON_TILE_SIZE});
        const wallTiles=wallMap.addTilesetImage(textureKey,textureKey,DUNGEON_TILE_SIZE,DUNGEON_TILE_SIZE,0,0);
        if(wallTiles)wallMap.createLayer(0,wallTiles,layout.left,layout.top)?.setDepth(2);
      }
      if (!bossArt) {

        this.drawBiomeSetDressing(room, tileData.data, layout);
        this.drawBiomeFloorMarks(room, tileData.data, layout);
        this.drawMataStartRoomDressing(room, tileData.data, layout);
      }
      if (!bossArt) this.drawAmbientDetails(room, tileData.data, layout);
    }
  }

  private drawArenaDoorways(layout:DungeonPixelLayout['rooms'][string]) {
  for(const [direction,center]of Object.entries(layout.doorCenters)){
    if(!center)continue;
    const vertical=direction==='north'||direction==='south';
    const dx=direction==='west'?1:direction==='east'?-1:0;
    const dy=direction==='north'?1:direction==='south'?-1:0;
    this.scene.add.tileSprite(center.x+dx*32,center.y+dy*32,vertical?96:96,vertical?96:96,this.tileTextureKey,0).setDepth(1.1);
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

  private drawForestEdgeCluster(x:number,y:number,variant:number,depthBias:number) {
  authoredImage(this.scene,x,y+10,'props',PROP_ART.shadowMedium,46,14).setDepth(1.16).setAlpha(0.55);
  authoredImage(this.scene,x,y,'props',[PROP_ART.tree,PROP_ART.stump,PROP_ART.ruin][variant%3],54,64).setOrigin(0.5,0.7).setDepth(2.4+depthBias);
}

  private drawMaresEdgeCluster(x:number,y:number,variant:number,depthBias:number) {
  authoredImage(this.scene,x,y,'props',[PROP_ART.coral,PROP_ART.seaweed,PROP_ART.shipwreck][variant%3],54,64).setOrigin(0.5,0.7).setDepth(3.1+depthBias);
}

  private drawRunicEdgeCluster(x:number,y:number,variant:number,depthBias:number) {
  authoredImage(this.scene,x,y,'props',[PROP_ART.pine,PROP_ART.crystal,PROP_ART.rock][variant%3],54,64).setOrigin(0.5,0.7).setDepth(3.1+depthBias);
}



  private drawBiomeFloorMarks(room:DungeonGraph['rooms'][string],tiles:number[][],layout:DungeonPixelLayout['rooms'][string]) {
  const random=createSeededRandom(this.graph.seed+':'+room.id+':authored-decals');
  tiles.forEach((row,y)=>row.forEach((tile,x)=>{
    if(tile!==ROOM_FLOOR_TILE||random.next()>0.03)return;
    const frame=this.graph.regionId==='mata-encantada'?PROP_ART.moss:this.graph.regionId==='arquipelago-das-mares'?PROP_ART.puddle:PROP_ART.snow;
    authoredImage(this.scene,layout.left+(x+0.5)*32,layout.top+(y+0.5)*32,'props',frame,30,30).setDepth(1.02).setAlpha(0.4);
  }));
}





  private drawAmbientDetails(room:DungeonGraph['rooms'][string],tiles:number[][],layout:DungeonPixelLayout['rooms'][string]) {
  const random=createSeededRandom(this.graph.seed+':'+room.id+':authored-ambient');
  const points=createSafeRoomSpawnPoints({width:tiles[0]?.length??0,height:tiles.length,data:tiles},4);
  for(const [index,point]of points.entries()){
    const frame=this.graph.regionId==='mata-encantada'?FX_ART.leaf:this.graph.regionId==='arquipelago-das-mares'?FX_ART.waterDrop:FX_ART.snow;
    const visual=authoredImage(this.scene,layout.left+point.x,layout.top+point.y,'fx',frame,9,9).setDepth(7);
    const tween=this.scene.tweens.add({targets:visual,y:visual.y-15,alpha:{from:0.18,to:0.7},duration:random.int(1000,1600),delay:index*230,yoyo:true,repeat:-1});
    this.registerAmbientFx(room.id,[visual],tween);
  }
}

  private drawMataStartRoomDressing(room:DungeonGraph['rooms'][string],tiles:number[][],layout:DungeonPixelLayout['rooms'][string]) {
  if(this.graph.regionId!=='mata-encantada'||room.type!=='start')return;
  for(const dx of [-1,1]){
    const x=layout.centerX+dx*(layout.width/2-112),y=layout.top+112;
    authoredImage(this.scene,x,y,'props',PROP_ART.ruin,54,70).setDepth(3);
    const lantern=authoredImage(this.scene,x+dx*35,y+30,'props',PROP_ART.lantern,40,50).setDepth(4);
    const tween=this.scene.tweens.add({targets:lantern,alpha:{from:0.78,to:1},duration:900,yoyo:true,repeat:-1});
    this.registerAmbientFx(room.id,[lantern],tween);
  }
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
  const baseFrame=DUNGEON_ART[this.graph.regionId as keyof typeof DUNGEON_ART]?.doorFrame??24;
  for(const room of Object.values(this.graph.rooms)){
    const layout=this.layout.rooms[room.id];
    for(const direction of Object.keys(room.connections) as DungeonDirection[]){
      const point=layout.doorCenters[direction];if(!point)continue;
      const horizontal=direction==='north'||direction==='south';
      const offset=direction==='north'?{x:0,y:-20}:direction==='south'?{x:0,y:20}:direction==='east'?{x:20,y:0}:{x:-20,y:0};
      const visual=authoredImage(this.scene,point.x+offset.x,point.y+offset.y,'world',baseFrame,96,80).setDepth(6).setRotation(horizontal?0:Math.PI/2);
      const collider=this.scene.add.zone(point.x,point.y,horizontal?96:24,horizontal?24:96);
      this.scene.physics.add.existing(collider,true);
      const body=collider.body as import('phaser').Physics.Arcade.StaticBody;body.enable=false;
      this.doors.set(this.doorKey(room.id,direction),{visual,collider,body,baseFrame,sealed:false,openX:point.x+offset.x,openY:point.y+offset.y,closedX:point.x,closedY:point.y,locked:false,state:'open'});
    }
  }
}

  attachPlayer(player: import("phaser").Physics.Arcade.Sprite) {
    for (const layer of this.wallLayers) this.scene.physics.add.collider(player, layer);
    for (const wall of this.corridorWalls) this.scene.physics.add.collider(player, wall);
    for (const door of this.doors.values()) this.scene.physics.add.collider(player, door.collider);
  }

  attachEnemies(enemies: import("phaser").Physics.Arcade.Group) {
    for (const layer of this.wallLayers) this.scene.physics.add.collider(enemies, layer);
    for (const wall of this.corridorWalls) this.scene.physics.add.collider(enemies, wall);
    for (const door of this.doors.values()) this.scene.physics.add.collider(enemies, door.collider);
  }

  private setDoorEntryLocked(entry:DoorEntry,locked:boolean){
  if(entry.locked===locked)return false;
  entry.locked=locked;this.scene.tweens.killTweensOf(entry.visual);
  entry.body.enable=locked;
  entry.state=locked?'closing':'opening';
  entry.visual.setFrame(entry.baseFrame+(locked?1:3)).setVisible(true).setAlpha(1);
  this.scene.tweens.add({targets:entry.visual,x:locked?entry.closedX:entry.openX,y:locked?entry.closedY:entry.openY,duration:180,ease:'Quad.easeInOut',onComplete:()=>{
    entry.state=locked?'closed':'open';
    entry.visual.setFrame(entry.baseFrame+(locked?(entry.sealed?4:2):0));
  }});
  if(locked)this.emitDoorDust(entry.closedX,entry.closedY);
  return true;
}

  setDoorsLocked(roomId: string, locked: boolean) {
    const room = this.graph.rooms[roomId];
    if (!room) return;
    let changed = false;
    for (const direction of Object.keys(room.connections) as DungeonDirection[]) {
      const entry = this.doors.get(this.doorKey(roomId, direction));
      if (entry) { entry.sealed = false; if (this.setDoorEntryLocked(entry, locked)) changed = true; }
    }
    if (changed) this.onDoorsLockedChange?.(locked);
  }

  /** Lock just one graph connection. Used by the final-boss seal so players
   * can freely backtrack through the dungeon while the final door stays shut. */
  setConnectionLocked(roomId: string, targetRoomId: string, locked: boolean) {
    const room = this.graph.rooms[roomId];
    const target = this.graph.rooms[targetRoomId];
    if (!room || !target) return false;
    let changed = false;
    for (const [direction, connectedId] of Object.entries(room.connections) as [DungeonDirection, string][]) {
      if (connectedId !== targetRoomId) continue;
      const entry = this.doors.get(this.doorKey(roomId, direction));
      if (entry) { entry.sealed = room.type === "boss" || targetRoomId === this.graph.bossRoomId; if (this.setDoorEntryLocked(entry, locked)) changed = true; }
    }
    for (const [direction, connectedId] of Object.entries(target.connections) as [DungeonDirection, string][]) {
      if (connectedId !== roomId) continue;
      const entry = this.doors.get(this.doorKey(targetRoomId, direction));
      if (entry) { entry.sealed = room.type === "boss" || targetRoomId === this.graph.bossRoomId; if (this.setDoorEntryLocked(entry, locked)) changed = true; }
    }
    return changed;
  }

  private emitDoorDust(x:number,y:number){
  for(const offset of [-16,0,16]){
    const dust=authoredImage(this.scene,x+offset,y,'fx',FX_ART.dust,12,8).setDepth(7).setAlpha(0.8);
    this.scene.tweens.add({targets:dust,x:x+offset+Math.sign(offset)*8,y:y+10,alpha:0,duration:260,onComplete:()=>dust.destroy()});
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
