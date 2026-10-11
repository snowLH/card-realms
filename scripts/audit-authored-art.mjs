import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, resolve, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import sharp from 'sharp';

const root=process.cwd();
const baseline=process.argv[2]??'018df58456a4df21a9cf935f21d8589180e2cacc';
const output=resolve(process.argv[3]??'docs/qa/full-authored-art/audit.json');
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(join(dir,entry.name)):[join(dir,entry.name)]);
const sourceFile=path=>/\.(?:ts|tsx|js|mjs|css|py|html)$/.test(path);
// Raw textual occurrences, including comments and offline recipes. The strict
// test determines production visibility; these counts never imply rendering.
const geometry=/\b(?:Phaser\.Graphics|(?:add|make)\.(?:graphics|rectangle|circle|ellipse|polygon|triangle)|(?:GameObjects\.)?(?:Graphics|Rectangle|Ellipse))\b|\b(?:fillRect|fillCircle|fillEllipse|fillTriangle|fillPoints|strokeRect|strokeCircle|strokeEllipse|lineBetween|createCanvas|putImageData|generateTexture|arc|beginPath|moveTo|lineTo|stroke|fillPath|strokePath)\s*\(|<\s*(?:svg|rect|circle|ellipse|polygon|path|line)(?=[\s/>])|(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(/g;
const summarize=rows=>({occurrences:rows.reduce((sum,row)=>sum+row.count,0),matchingFiles:rows.filter(row=>row.count).length,scannedFiles:rows.length,rows:rows.filter(row=>row.count)});
const count=(path,source)=>({path,count:[...source.matchAll(geometry)].length});
const publicShell=path=>/^public\/(?:offline\.html|sw\.js)$/.test(path);
const baselinePaths=execFileSync('git',['ls-tree','-r','--name-only',baseline],{encoding:'utf8'}).trim().split('\n').filter(path=>sourceFile(path)&&(/^(?:src|scripts)\//.test(path)||publicShell(path)));
const baselineBlobs=execFileSync('git',['cat-file','--batch'],{input:baselinePaths.map(path=>`${baseline}:${path}`).join('\n')+'\n',maxBuffer:16*1024*1024});
let offset=0;
const before=baselinePaths.map(path=>{
  const headerEnd=baselineBlobs.indexOf(10,offset);
  const header=baselineBlobs.subarray(offset,headerEnd).toString('utf8');
  const bytes=Number(header.split(' ').at(-1));
  if(!Number.isFinite(bytes))throw new Error(`Missing baseline blob: ${path}`);
  offset=headerEnd+1;
  const source=baselineBlobs.subarray(offset,offset+bytes).toString('utf8');offset+=bytes+1;
  return count(path,source);
});
const currentFiles=['src','scripts'].flatMap(dir=>walk(join(root,dir))).filter(sourceFile).concat(['public/offline.html','public/sw.js'].map(path=>join(root,path)));
const after=currentFiles.map(path=>count(relative(root,path).replaceAll('\\','/'),readFileSync(path,'utf8')));
const production=row=>(row.path.startsWith('src/')&&!/\.test\./.test(row.path))||publicShell(row.path);
const images=walk(join(root,'public/art/authored')).filter(path=>/\.(?:png|webp)$/.test(path));
const assets=await Promise.all(images.map(async path=>{const meta=await sharp(path).metadata();return {path:relative(root,path).replaceAll('\\','/'),bytes:statSync(path).size,width:meta.width,height:meta.height,rgbaBytes:meta.width*meta.height*4};}));
const atlases=assets.filter(asset=>asset.path.endsWith('-atlas.webp'));
const phaserAtlases=atlases.filter(asset=>!asset.path.endsWith('/ui-atlas.webp'));
const phaserPanels=['panel-dark','panel-parchment','dialogue-frame','tooltip-frame','hp-bar-frame','boss-hp-frame','hp-bar-fill','boss-hp-fill','boss-hp-phase-divider'];
const sharedImages=assets.filter(asset=>asset.path.includes('/runtime/')||/\/missing-(?:texture|actor|tiles)\.webp$/.test(asset.path)||phaserPanels.some(name=>asset.path.endsWith(`/ui/${name}.webp`)));
const sourcePngs=walk(join(root,'scripts/art-sources')).filter(path=>path.endsWith('.png')).map(path=>({path:relative(root,path).replaceAll('\\','/'),bytes:statSync(path).size}));
const staticFiles=walk(join(root,'.next/static')).filter(path=>/\.(?:js|css)$/.test(path));
const chunks=staticFiles.map(path=>{const bytes=readFileSync(path);return {path:relative(root,path).replaceAll('\\','/'),bytes:bytes.length,gzipBytes:gzipSync(bytes).length};});
const bundle={buildId:readFileSync(join(root,'.next/BUILD_ID'),'utf8').trim(),scope:'all production static JS/CSS chunks; not initial route transfer',files:chunks.length,rawBytes:chunks.reduce((s,c)=>s+c.bytes,0),gzipBytes:chunks.reduce((s,c)=>s+c.gzipBytes,0),byExtension:Object.fromEntries(['js','css'].map(ext=>[ext,{files:chunks.filter(c=>extname(c.path)==='.'+ext).length,rawBytes:chunks.filter(c=>extname(c.path)==='.'+ext).reduce((s,c)=>s+c.bytes,0),gzipBytes:chunks.filter(c=>extname(c.path)==='.'+ext).reduce((s,c)=>s+c.gzipBytes,0)}]))};
const result={baseline,geometry:{scope:'src and scripts source files plus public offline HTML/service worker, excluding dependencies/build outputs',before:summarize(before),after:summarize(after),productionBefore:summarize(before.filter(production)),productionAfter:summarize(after.filter(production)),removedProductionOccurrences:summarize(before.filter(production)).occurrences-summarize(after.filter(production)).occurrences},assets:{images:assets.length,bytes:assets.reduce((s,a)=>s+a.bytes,0),atlases,phaserAtlasRgbaBytes:phaserAtlases.reduce((s,a)=>s+a.rgbaBytes,0),phaserSharedRgbaBytes:phaserAtlases.concat(sharedImages).reduce((s,a)=>s+a.rgbaBytes,0)+256*32*4,gpuNote:'RGBA8 estimates, without mipmaps/driver overhead; not measured GPU memory. Shared includes three atlases, nine UI panels, 13 compatibility images, three placeholders and one active biome. Existing actors/backgrounds, CSS slices and weapon pack are excluded.',sourcePngs,sourcePngBytes:sourcePngs.reduce((s,a)=>s+a.bytes,0),rows:assets},bundle};
mkdirSync(resolve(output,'..'),{recursive:true});
writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,geometry:Object.fromEntries(Object.entries(result.geometry).map(([k,v])=>[k,typeof v==='object'?{...v,rows:undefined}:v])),assets:{...result.assets,rows:undefined}},null,2));
