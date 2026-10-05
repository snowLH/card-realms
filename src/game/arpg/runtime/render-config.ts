/** Shared logical canvas and pixel-sampling defaults for every ARPG Phaser scene. */
export const ARPG_LOGICAL_VIEWPORT = {
  width: 1280,
  height: 720,
} as const;

export const ARPG_PIXEL_RENDER_SETTINGS = {
  pixelArt: true,
  antialias: false,
  roundPixels: true,
} as const;
