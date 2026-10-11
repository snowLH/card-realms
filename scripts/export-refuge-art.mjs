import { readFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';

// Existing authored furniture is rasterized at export time, never by the game.
await mkdir('public/art/authored/refuge', {recursive:true});
for (const name of ['armchair','lamp','plant','books','chest','map-stand']) {
  const source = await readFile(`scripts/art-sources/refuge/${name}.svg`);
  await sharp(source).resize(32,32,{kernel:'nearest'}).webp({lossless:true})
    .toFile(`public/art/authored/refuge/${name}.webp`);
}
