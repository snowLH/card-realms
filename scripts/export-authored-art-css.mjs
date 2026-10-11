import {readFile,writeFile} from 'node:fs/promises';
import ts from 'typescript';
const source=ts.transpileModule(await readFile('src/game/arpg/art/manifest.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {CSS_ART_VARIABLES}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const variables=Object.entries(CSS_ART_VARIABLES);
const path='src/app/authored-art.css';
const css=await readFile(path,'utf8');
await writeFile(path,css.replace(/:root \{[\s\S]+?\n\}/,':root {\n'+variables.map(([id,path])=>`  --art-${id}:url("${path}");`).join('\n')+'\n}'));
console.log(`Exported ${variables.length} authored image variables.`);
