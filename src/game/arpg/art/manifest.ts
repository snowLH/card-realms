/** Authored appearance only. Simulation/hitboxes never depend on these frames. */
export const ART_ATLASES = {
  fx: { key:'folklard-authored-fx', path:'/art/authored/fx-atlas.webp', frameSize:128 },
  props: { key:'folklard-authored-props', path:'/art/authored/props-atlas.webp', frameSize:64 },
  ui: { key:'folklard-authored-ui', path:'/art/authored/ui-atlas.webp', frameSize:64 },
  world: { key:'folklard-authored-world', path:'/art/authored/world-atlas.webp', frameSize:64 },
} as const;

export const FX_ART = {
  circleWarning:0, circleDanger:1, coneWarning:2, coneDanger:3, lineWarning:4, lineDanger:5, rectangleWarning:6, rectangleDanger:7,
  forestCircleWarning:8, forestCircleDanger:9, forestConeWarning:10, forestConeDanger:11, forestLineWarning:12, forestLineDanger:13, forestRectangleWarning:14, forestRectangleDanger:15,
  waterCircleWarning:16, waterCircleDanger:17, waterConeWarning:18, waterConeDanger:19, waterLineWarning:20, waterLineDanger:21, waterRectangleWarning:22, waterRectangleDanger:23,
  ringWarning:24, crossWarning:25, wardAppear:26, wardIdle:27, wardPulse:28, wardDisappear:29, crosshairDefault:30, crosshairLocked:31,
  corruptionSmoke:32, corruptionFragment:33, corruptionVein:34, corruptionAura:35, corruptionBurst:36, corruptionDissolve:37, memoryKnight:38, memoryCrown:39,
  purificationRing:40, purificationRays:41, purificationFragments:42, purificationBurst:43, purificationMemory:44, purificationFlash:45, rootZone:46, waterZone:47,
  spark:48, ember:49, leaf:50, waterDrop:51, snow:52, memoryFragment:53, dust:54, lightningFragment:55,
  swordImpact:56, arrowImpact:57, magicImpact:58, waterImpact:59, lightningImpact:60, iceImpact:61, corruptedImpact:62, magicStar:63,
} as const;
export const PROP_ART = {
  crate:0,vase:1,shrub:2,relic:3,fragment:4,coins:5,breastplate:6,mantle:7,
  merchant:8,archivist:9,forge:10,mapTable:11,legendShrine:12,refuge:13,naturalist:14,training:15,
  tree:16,stump:17,ruin:18,lantern:19,coral:20,seaweed:21,shipwreck:22,tideSpring:23,
  pine:24,crystal:25,rock:26,brazier:27,campfire:28,spring:29,chestClosed:30,chestOpen:31,
  table:32,bed:33,rug:34,plant:35,shelf:36,armor:37,throne:38,roundTable:39,
  roots:40,cracks:41,moss:42,puddle:43,tideMark:44,rune:45,snow:46,rubble:47,
  shadowSmall:48,shadowMedium:49,shadowLarge:50,shadowBoss:51,shadowFlying:52,sign:53,bench:54,banner:55,
  portalDormant:56,portalActivating:57,portalOpen:58,portalClosing:59,missing:60,forestAltar:61,waterAltar:62,runicAltar:63,
} as const;
export const WORLD_ART = {
  forestDoorOpen:24,forestDoorClosing:25,forestDoorClosed:26,forestDoorOpening:27,forestDoorSealed:28,
  marineDoorOpen:32,marineDoorClosing:33,marineDoorClosed:34,marineDoorOpening:35,marineDoorSealed:36,
  runicDoorOpen:40,runicDoorClosing:41,runicDoorClosed:42,runicDoorOpening:43,runicDoorSealed:44,
  arrow:48,magic:49,lightning:50,wave:51,blade:52,fire:53,ice:54,enemyProjectile:55,
  laserCore:56,laserGlow:57,aimLine:58,lightningBeam:59,magicBeam:60,frostZone:61,lightningZone:62,smokeOverlay:63,
} as const;
export const UI_ART_NAMES = [
  'sound','pause','map','fullscreen','exit','coin','shard','life','defense','attack','dash','skill','interact','portal','boss','settings',
  'backpack','equipment','bow','staff','back','check','lock','star','hero','party','connection','book','roots','water','lightning','snow',
  'panel-dark','panel-parchment','button-normal','button-hover','button-pressed','slot-empty','slot-active','tooltip-frame',
  'toast-frame','dialogue-frame','hp-bar-frame','hp-bar-fill','hp-bar-damaged','boss-hp-frame','boss-hp-fill','boss-hp-phase-divider',
  'minimap-room','minimap-room-cleared','minimap-room-current','minimap-room-elite','minimap-room-treasure','minimap-room-shop','minimap-room-event','minimap-room-boss',
  'minimap-corridor-horizontal','minimap-corridor-vertical','minimap-player','minimap-room-rest','checkpoint','cursor-default','target-marker-locked','hotbar-frame',
] as const;
export type UiArtName = typeof UI_ART_NAMES[number];
export const UI_ART = Object.fromEntries(UI_ART_NAMES.map((id,frame)=>[id,{path:`/art/authored/ui/${id}.webp`,frame}])) as Record<UiArtName,{path:string;frame:number}>;
export const DUNGEON_ART = {
  'mata-encantada':{key:'card-realms-dungeon-tiles-mata-encantada',path:'/art/authored/mata-tiles.webp',doorFrame:24},
  'arquipelago-das-mares':{key:'card-realms-dungeon-tiles-arquipelago-das-mares',path:'/art/authored/mares-tiles.webp',doorFrame:32},
  'montanhas-runicas':{key:'card-realms-dungeon-tiles-montanhas-runicas',path:'/art/authored/runic-tiles.webp',doorFrame:40},
} as const;
export const PROP_IMAGE_ART = Object.fromEntries(Object.entries(PROP_ART).map(([id,frame])=>[id,{path:`/art/authored/props/${frame}.webp`,frame}])) as Record<keyof typeof PROP_ART,{path:string;frame:number}>;
export const WORLD_IMAGE_ART = Array.from({length:64},(_,frame)=>({path:`/art/authored/world/${frame}.webp`,frame}));

export const LEGACY_IMAGE_ART = {
  'arpg-enemy':{pack:'props',frame:PROP_ART.missing,width:36,height:36},
  'arpg-projectile':{pack:'world',frame:WORLD_ART.magic,width:13,height:13},
  'arpg-pixel-pulse':{pack:'fx',frame:FX_ART.purificationRing,width:64,height:64},
  'arpg-breakable-crate':{pack:'props',frame:PROP_ART.crate,width:40,height:40},
  'arpg-breakable-vase':{pack:'props',frame:PROP_ART.vase,width:40,height:40},
  'arpg-breakable-shrub':{pack:'props',frame:PROP_ART.shrub,width:40,height:40},
  'arpg-breakable-relic':{pack:'props',frame:PROP_ART.relic,width:40,height:40},
  'arpg-run-fragment':{pack:'props',frame:PROP_ART.fragment,width:24,height:24},
  'arpg-loot-breastplate':{pack:'props',frame:PROP_ART.breastplate,width:32,height:32},
  'arpg-loot-mantle':{pack:'props',frame:PROP_ART.mantle,width:32,height:32},
  'arpg-ground-shadow':{pack:'props',frame:PROP_ART.shadowMedium,width:32,height:12},
  'arpg-weapon-projectile-arrow':{pack:'world',frame:WORLD_ART.arrow,width:18,height:7},
  'arpg-weapon-projectile-focus':{pack:'world',frame:WORLD_ART.magic,width:13,height:13},
} as const;

export const REFUGE_ART = {
"armchair":"/art/authored/refuge/armchair.webp",
"lamp":"/art/authored/refuge/lamp.webp",
"plant":"/art/authored/refuge/plant.webp",
"books":"/art/authored/refuge/books.webp",
"chest":"/art/authored/refuge/chest.webp",
"map-stand":"/art/authored/refuge/map-stand.webp"
} as const;

export const RUNTIME_IMAGE_ART = Object.fromEntries(Object.keys(LEGACY_IMAGE_ART).map(id=>[id,{path:`/art/authored/runtime/${id}.webp`}])) as Record<keyof typeof LEGACY_IMAGE_ART,{path:string}>;
export const CSS_ART_VARIABLES: Readonly<Record<string,string>> = Object.fromEntries([
  ...Object.entries(UI_ART).map(([name,art])=>[name,art.path]),
  ...Object.entries(PROP_IMAGE_ART).map(([name,art])=>[`prop-${name}`,art.path]),
  ...Object.entries(WORLD_ART).map(([name,frame])=>[`world-${name}`,WORLD_IMAGE_ART[frame].path]),
]);

export const FOLKLARD_ART_MANIFEST = {
  atlases:ART_ATLASES,fx:FX_ART,props:PROP_ART,world:WORLD_ART,ui:UI_ART,dungeons:DUNGEON_ART,refuge:REFUGE_ART,runtime:RUNTIME_IMAGE_ART,propImages:PROP_IMAGE_ART,worldImages:WORLD_IMAGE_ART,
  missing:{key:'folklard-missing-texture',path:'/art/authored/missing-texture.webp'},
  missingTiles:{key:'folklard-missing-tiles',path:'/art/authored/missing-tiles.webp'},
  missingActor:{key:'folklard-missing-actor',path:'/art/authored/missing-actor.webp'},
} as const;
