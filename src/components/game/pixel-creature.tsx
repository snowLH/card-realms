"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { SpriteDefinition } from "@/game/types";
import { FOLKLARD_ART_MANIFEST } from "@/game/arpg/art/manifest";
import { cn } from "@/lib/utils";

const PIXEL_ACTOR_SIZE = 64;
const ACTOR_PADDING = 4;
const ATLAS_IMAGES = new Map<string, Promise<HTMLImageElement>>();

function loadAtlasImage(sheet: string) {
  const cached = ATLAS_IMAGES.get(sheet);
  if (cached) return cached;

  const request = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Não foi possível carregar o atlas: ${sheet}`));
    image.src = sheet;
  }).catch((error: unknown) => {
    ATLAS_IMAGES.delete(sheet);
    throw error;
  });

  ATLAS_IMAGES.set(sheet, request);
  return request;
}

function drawPixelCreature(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  sprite: SpriteDefinition,
) {
  const context = canvas.getContext("2d", { alpha: true, willReadFrequently: true });
  if (!context) return false;

  const columns = Math.max(1, sprite.columns);
  const rows = Math.max(1, sprite.rows);
  const frameWidth = image.naturalWidth / columns;
  const frameHeight = image.naturalHeight / rows;
  if (!frameWidth || !frameHeight) return false;

  const sourceFrame = document.createElement("canvas");
  sourceFrame.width = Math.ceil(frameWidth);
  sourceFrame.height = Math.ceil(frameHeight);
  const sourceContext = sourceFrame.getContext("2d", { alpha: true, willReadFrequently: true });
  if (!sourceContext) return false;
  sourceContext.imageSmoothingEnabled = false;
  sourceContext.drawImage(
    image,
    sprite.column * frameWidth,
    sprite.row * frameHeight,
    frameWidth,
    frameHeight,
    0,
    0,
    sourceFrame.width,
    sourceFrame.height,
  );

  // Fit the opaque creature itself, not the atlas cell's transparent padding.
  // This makes the silhouette read bigger while keeping its original proportions.
  const sourcePixels = sourceContext.getImageData(0, 0, sourceFrame.width, sourceFrame.height);
  const sourceAlpha = sourcePixels.data;
  let minX = sourceFrame.width;
  let minY = sourceFrame.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < sourceFrame.height; y += 1) {
    for (let x = 0; x < sourceFrame.width; x += 1) {
      if (sourceAlpha[(y * sourceFrame.width + x) * 4 + 3] < 96) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  context.clearRect(0, 0, PIXEL_ACTOR_SIZE, PIXEL_ACTOR_SIZE);
  context.imageSmoothingEnabled = false;
  if (maxX < minX || maxY < minY) {
    context.drawImage(
      sourceFrame,
      0,
      0,
      sourceFrame.width,
      sourceFrame.height,
      ACTOR_PADDING,
      ACTOR_PADDING,
      PIXEL_ACTOR_SIZE - ACTOR_PADDING * 2,
      PIXEL_ACTOR_SIZE - ACTOR_PADDING * 2,
    );
  } else {
    const padX = Math.max(1, Math.round(sourceFrame.width * 0.012));
    const padY = Math.max(1, Math.round(sourceFrame.height * 0.012));
    const left = Math.max(0, minX - padX);
    const top = Math.max(0, minY - padY);
    const right = Math.min(sourceFrame.width, maxX + padX + 1);
    const bottom = Math.min(sourceFrame.height, maxY + padY + 1);
    const cropWidth = right - left;
    const cropHeight = bottom - top;
    const innerSize = PIXEL_ACTOR_SIZE - ACTOR_PADDING * 2;
    const fitScale = Math.min(innerSize / cropWidth, innerSize / cropHeight);
    const outputWidth = Math.max(1, Math.round(cropWidth * fitScale));
    const outputHeight = Math.max(1, Math.round(cropHeight * fitScale));
    const outputX = Math.floor((PIXEL_ACTOR_SIZE - outputWidth) / 2);
    const outputY = Math.floor((PIXEL_ACTOR_SIZE - outputHeight) / 2);
    context.drawImage(sourceFrame, left, top, cropWidth, cropHeight, outputX, outputY, outputWidth, outputHeight);
  }

  return true;
}

export function PixelCreature({
  sprite,
  className,
  mirrored = false,
  evolved = false,
  label,
}: {
  sprite: SpriteDefinition;
  className?: string;
  mirrored?: boolean;
  evolved?: boolean;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pixelizedSpriteKey, setPixelizedSpriteKey] = useState<string | null>(null);
  const { sheet, columns, rows, column, row } = sprite;
  const spriteKey = `${sheet}:${columns}:${rows}:${column}:${row}`;
  const [failedSheet, setFailedSheet] = useState<string | null>(null);
  const failed = failedSheet === sheet;
  const pixelReady = pixelizedSpriteKey === spriteKey;
  const x = columns === 1 ? 0 : (column / (columns - 1)) * 100;
  const y = rows === 1 ? 0 : (row / (rows - 1)) * 100;
  const style = {
    backgroundImage: pixelReady ? "none" : `url("${failed ? FOLKLARD_ART_MANIFEST.missing.path : sheet}")`,
    backgroundPosition: failed ? "center" : `${x}% ${y}%`,
    backgroundSize: failed ? "contain" : `${columns * 100}% ${rows * 100}%`,
    "--sprite-scale-x": mirrored ? -1 : 1,
  } as CSSProperties;

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return () => { cancelled = true; };
    const context = canvas.getContext("2d");
    context?.clearRect(0, 0, PIXEL_ACTOR_SIZE, PIXEL_ACTOR_SIZE);

    loadAtlasImage(sheet).then((image) => {
      if (cancelled || !canvasRef.current) return;
      if (drawPixelCreature(canvasRef.current, image, { sheet, columns, rows, column, row })) {
        setPixelizedSpriteKey(spriteKey);
      }
    }).catch((error: unknown) => {
      console.error(error);
      if (!cancelled) setFailedSheet(sheet);
    });

    return () => { cancelled = true; };
  }, [sheet, columns, rows, column, row, spriteKey]);

  return (
    <div
      role="img"
      aria-label={label ?? "Criatura"}
      className={cn("pixel-creature", pixelReady && "pixel-creature--ready", evolved && "pixel-creature--evolved", className)}
      style={style}
    >
      <canvas ref={canvasRef} className="pixel-creature__canvas" width={PIXEL_ACTOR_SIZE} height={PIXEL_ACTOR_SIZE} aria-hidden="true" />
    </div>
  );
}
