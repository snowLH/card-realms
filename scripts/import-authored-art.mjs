import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ts from 'typescript';

// Export only: no drawing commands. The source pixels are authored ImageGen art.
// Run with four source PNG paths, in fx/props/ui/world order.
const sources = process.argv.length > 2 ? process.argv.slice(2) : ['fx','props','ui','world'].map(pack=>resolve('scripts/art-sources',`${pack}.png`));
if (sources.length !== 4) throw new Error('Expected fx, props, ui and world source images.');
const root = resolve('public/art/authored');
await mkdir(root, { recursive: true });
const rows = {
  fx: [0, 176, 332, 486, 660, 833, 991, 1102, 1254],
  props: [0, 157, 317, 483, 642, 804, 938, 1072, 1254],
  ui: [0, 163, 332, 498, 661, 806, 934, 1069, 1254],
  world: [0, 157, 314, 471, 628, 785, 942, 1099, 1254],
};
// Panels and bars are wider than icon cells in the authored source. These
// reviewed cut boundaries prevent a neighbour's pixels entering the frame.
const uiColumns = {
  4: [0,171,333,491,637,795,927,1055,1254],
  5: [0,204,391,574,699,823,1021,1198,1254],
  6: [0,165,327,482,638,792,943,1090,1254],
  7: [0,190,300,420,568,710,822,986,1254],
};
const uiNames = [
  'sound','pause','map','fullscreen','exit','coin','shard','life',
  'defense','attack','dash','skill','interact','portal','boss','settings',
  'backpack','equipment','bow','staff','back','check','lock','star',
  'hero','party','connection','book','roots','water','lightning','snow',
  'panel-dark','panel-parchment','button-normal','button-hover','button-pressed','slot-empty','slot-active','tooltip-frame',
  'toast-frame','dialogue-frame','hp-bar-frame','hp-bar-fill','hp-bar-damaged','boss-hp-frame','boss-hp-fill','boss-hp-phase-divider',
  'minimap-room','minimap-room-cleared','minimap-room-current','minimap-room-elite','minimap-room-treasure','minimap-room-shop','minimap-room-event','minimap-room-boss',
  'minimap-corridor-horizontal','minimap-corridor-vertical','minimap-player','minimap-room-rest','checkpoint','cursor-default','target-marker-locked','hotbar-frame',
];
await mkdir(resolve(root, 'ui'), { recursive: true });
const report = [];
for (const [index, pack] of ['fx','props','ui','world'].entries()) {
  const source = sharp(sources[index]);
  const meta = await source.metadata();
  const cellSize = pack === 'fx' ? 128 : 64;
  const frames = [];
  for (let frame = 0; frame < 64; frame++) {
    const row = Math.floor(frame / 8), col = frame % 8;
    const columns = pack === 'ui' ? uiColumns[row] : undefined;
    const left = columns ? Math.round(columns[col] * meta.width / 1254) : Math.round(col * meta.width / 8);
    const right = columns ? Math.round(columns[col + 1] * meta.width / 1254) : Math.round((col + 1) * meta.width / 8);
    const top = Math.round(rows[pack][row] * meta.height / 1254);
    const bottom = Math.round(rows[pack][row + 1] * meta.height / 1254);
    const crop = sharp(await source.clone().extract({left, top, width:right-left, height:bottom-top}).png().toBuffer());
    const opaqueTile = pack === 'world' && frame < 24;
    const sprite = opaqueTile ? crop : crop.trim({ threshold: 10 });
    const pixels = await sprite.clone().resize(cellSize, cellSize, {
      fit: opaqueTile ? 'fill' : 'contain', kernel: 'nearest',
      background: { r:0, g:0, b:0, alpha:0 },
    }).png().toBuffer();
    frames.push({ input:pixels, left:col*cellSize, top:row*cellSize });
    if (pack === 'ui') {
      const art = await sprite.clone().resize({width:frame < 32 ? 64 : 128,kernel:'nearest'}).webp({lossless:true}).toBuffer();
      await writeFile(resolve(root,'ui',`${uiNames[frame]}.webp`),art);
    }
    if (pack === 'props') {
      await mkdir(resolve(root,'props'),{recursive:true});
      await writeFile(resolve(root,'props',`${frame}.webp`),await sprite.clone().resize({width:64,kernel:'nearest'}).webp({lossless:true}).toBuffer());
    }
    if (pack === 'world') {
      await mkdir(resolve(root,'world'),{recursive:true});
      await writeFile(resolve(root,'world',`${frame}.webp`),await sprite.clone().resize({width:64,kernel:'nearest'}).webp({lossless:true}).toBuffer());
    }
    if (pack === 'props' && frame === 60) {
      await writeFile(resolve(root,'missing-texture.webp'),await sharp(pixels).webp({lossless:true}).toBuffer());
    }
  }
  const atlas = await sharp({ create: { width:cellSize*8,height:cellSize*8,channels:4,background:{r:0,g:0,b:0,alpha:0} } })
    .composite(frames).webp({lossless:true,effort:6}).toBuffer();
  await writeFile(resolve(root,`${pack}-atlas.webp`),atlas);
  report.push({pack,sourceWidth:meta.width,sourceHeight:meta.height,frames:64,cellSize,bytes:atlas.length});
  if (pack === 'world') {
    for (const [row, biome] of ['mata','mares','runic'].entries()) {
      const tiles = await sharp(atlas).extract({left:0,top:row*64,width:512,height:64})
        .resize(256,32,{kernel:'nearest'}).webp({lossless:true}).toBuffer();
      await writeFile(resolve(root,`${biome}-tiles.webp`),tiles);
    }
  }
}
await writeFile(resolve(root,'export-report.json'),JSON.stringify(report,null,2)+'\n');
// Compatibility image keys retain projectile sizes and collision bodies during migration.
const moduleText=ts.transpileModule(await (await import('node:fs/promises')).readFile('src/game/arpg/art/manifest.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {LEGACY_IMAGE_ART}=await import('data:text/javascript;base64,'+Buffer.from(moduleText).toString('base64'));
await mkdir(resolve(root,'runtime'),{recursive:true});
for(const [key,art]of Object.entries(LEGACY_IMAGE_ART)){
  const size=art.pack==='fx'?128:64;
  const pixels=await sharp(resolve(root,`${art.pack}-atlas.webp`)).extract({left:(art.frame%8)*size,top:Math.floor(art.frame/8)*size,width:size,height:size})
    .resize(art.width,art.height,{kernel:'nearest'}).webp({lossless:true}).toBuffer();
  await writeFile(resolve(root,'runtime',`${key}.webp`),pixels);
}
const placeholder=await sharp(resolve(root,'missing-texture.webp')).resize(256,256,{kernel:'nearest'}).png().toBuffer();
const actor=await sharp({create:{width:1024,height:1536,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
  .composite(Array.from({length:24},(_,i)=>({input:placeholder,left:(i%4)*256,top:Math.floor(i/4)*256}))).webp({lossless:true}).toBuffer();
await writeFile(resolve(root,'missing-actor.webp'),actor);
const missingTile=await sharp(resolve(root,'missing-texture.webp')).resize(32,32,{kernel:'nearest'}).png().toBuffer();
const missingTiles=await sharp({create:{width:256,height:32,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
  .composite(Array.from({length:8},(_,i)=>({input:missingTile,left:i*32,top:0}))).webp({lossless:true}).toBuffer();
await writeFile(resolve(root,'missing-tiles.webp'),missingTiles);
console.log(JSON.stringify(report,null,2));
