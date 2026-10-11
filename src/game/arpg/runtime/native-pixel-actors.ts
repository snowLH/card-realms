import {getGeneratedLegendSpriteSheet} from './legend-sprite-sheets';
import {FOLKLARD_ART_MANIFEST} from '../art/manifest';
import type { Scene } from "phaser";


/** Folklard's small, hand-built runtime actor set. */
export const NATIVE_PIXEL_ACTORS = [
  "blacksmith",
  "merchant",
  "archivist",
  "bestiaryKeeper",
  "curupira",
  "amarok",
  "iara",
  "sprout",
  "boto",
  "raiju",
  "mapinguari",
  "kappa",
  "kelpie",
  "ahuizotl",
  "ratatoskr",
  "carbunclo",
  "alicanto",
  "yeti",
  "king-arthur",
] as const;

export type NativePixelActorId = (typeof NATIVE_PIXEL_ACTORS)[number];

export const NATIVE_PIXEL_ACTOR_ANIMATION_ROWS = {
  idle: 0,
  walk: 1,
  attack: 2,
  shoot: 3,
  damage: 4,
  defeat: 5,
} as const;

export type NativePixelActorAnimation = keyof typeof NATIVE_PIXEL_ACTOR_ANIMATION_ROWS;

export const NATIVE_PIXEL_ACTOR_FRAME_COLUMNS = 4;
export const NATIVE_PIXEL_ACTOR_FRAMES_PER_CYCLE = 4;

/** Every actor uses the same named 4-frame cycles in its six-row sheet. */
export const NATIVE_PIXEL_ACTOR_ANIMATION_MAP = Object.fromEntries(
  NATIVE_PIXEL_ACTORS.map((actor) => [actor, NATIVE_PIXEL_ACTOR_ANIMATION_ROWS]),
) as Readonly<Record<NativePixelActorId, typeof NATIVE_PIXEL_ACTOR_ANIMATION_ROWS>>;

export type NativePixelWalkPose = Readonly<{
  stride: -2 | 0 | 2;
  leftLift: 0 | 1 | 2;
  rightLift: 0 | 1 | 2;
  bodyBob: -1 | 0;
}>;

const NATIVE_PIXEL_WALK_CYCLE: readonly NativePixelWalkPose[] = [
  { stride: -2, leftLift: 0, rightLift: 2, bodyBob: 0 },
  { stride: 0, leftLift: 1, rightLift: 1, bodyBob: -1 },
  { stride: 2, leftLift: 2, rightLift: 0, bodyBob: 0 },
  { stride: 0, leftLift: 1, rightLift: 1, bodyBob: -1 },
];

/** A readable four-frame stride with alternating foot lift at the native 32px grid. */
export function getNativePixelWalkPose(frame: number): NativePixelWalkPose {
  const wrappedFrame = ((Math.trunc(frame) % NATIVE_PIXEL_WALK_CYCLE.length) + NATIVE_PIXEL_WALK_CYCLE.length)
    % NATIVE_PIXEL_WALK_CYCLE.length;
  return NATIVE_PIXEL_WALK_CYCLE[wrappedFrame];
}


/** Missing art is always an authored image, never a substitute drawing. */
export function createNativePixelActorDataUrl(actorId:NativePixelActorId,_frameWidth=256,_frameHeight=256):string {
  void _frameWidth;void _frameHeight;
  return getGeneratedLegendSpriteSheet(actorId)??FOLKLARD_ART_MANIFEST.missingActor.path;
}
export function createNativePixelActorSheet(scene:Scene,actorId:NativePixelActorId,textureKey:string,_frameWidth:number,_frameHeight:number):string {
  void _frameWidth;void _frameHeight;
  if(scene.textures.exists(textureKey))return textureKey;
  console.error('Missing authored actor image: '+actorId);
  const placeholder=scene.textures.get(FOLKLARD_ART_MANIFEST.missingActor.key).getSourceImage();
  scene.textures.addSpriteSheet(textureKey,placeholder as HTMLImageElement,{frameWidth:256,frameHeight:256,endFrame:23});
  return textureKey;
}
