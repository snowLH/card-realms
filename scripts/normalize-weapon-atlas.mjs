import sharp from 'sharp';
const source='public/art/vendor/opengameart/bennyboi-hack/weaponpack.png';
const destination='public/art/vendor/opengameart/bennyboi-hack/weaponpack-alpha.png';
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
// Only the connected exterior matte is removed. Enclosed gray weapon pixels,
// foreground RGB, the 16px frame grid and the verified original remain intact.
const seen=new Uint8Array(info.width*info.height),queue=[];
function visit(x,y){
  if(x<0||y<0||x>=info.width||y>=info.height)return;
  const pixel=y*info.width+x,index=pixel*4;
  if(seen[pixel]||data[index]!==170||data[index+1]!==170||data[index+2]!==170)return;
  seen[pixel]=1;queue.push(pixel);data[index+3]=0;
}
for(let x=0;x<info.width;x++){visit(x,0);visit(x,info.height-1);}
for(let y=0;y<info.height;y++){visit(0,y);visit(info.width-1,y);}
// Grid separators disconnect many frame backgrounds from the sheet perimeter.
// Seed the exterior of every 16x16 frame, preserving enclosed gray details.
for(let row=0;row<7;row++)for(let column=0;column<10;column++){
  const left=column*17,top=row*17;
  for(let offset=0;offset<16;offset++){
    visit(left+offset,top);visit(left+offset,top+15);
    visit(left,top+offset);visit(left+15,top+offset);
  }
}
for(let index=0;index<queue.length;index++){
  const pixel=queue[index],x=pixel%info.width,y=Math.floor(pixel/info.width);
  visit(x-1,y);visit(x+1,y);visit(x,y-1);visit(x,y+1);
}
// The two reviewed bow cells use the same matte inside the closed bowstring.
// Those holes are negative space; unlike sword blades, neither bow has gray metal.
for (const frame of [12, 32]) {
  const left = frame % 10 * 17, top = Math.floor(frame / 10) * 17;
  for (let y = top; y < top + 16; y++) for (let x = left; x < left + 16; x++) visit(x, y);
}
await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toFile(destination);
console.log(`Removed ${queue.length} exterior matte pixels; preserved authored foreground.`);
