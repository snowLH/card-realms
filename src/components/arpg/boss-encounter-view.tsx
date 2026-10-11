"use client";
import { useAuthoredImage } from "@/components/ui/use-authored-image";
import type { CSSProperties } from "react";
import type { BossEncounterSnapshot } from "@/game/arpg/bosses/boss-encounter-controller";
import { arthurArtFrame } from "@/game/arpg/bosses/king-arthur/art";
import { bossById } from "@/game/arpg/bosses/registry";
import { regionalBossArtFrame } from "@/game/arpg/bosses/regional-art";
import { PLAYABLE_LEGENDS } from "@/game/arpg/content/legends";
import type { ArpgRaidPlayerState } from "@/game/arpg/raid";
import { ARTHUR_WARD_RADIUS } from "@/game/arpg/bosses/king-arthur/playable-kit";
import { ArtSprite } from "@/components/ui/art-sprite";
import { PixelHealthBar } from "@/components/ui/pixel-health-bar";
import { FX_ART, WORLD_ART } from "@/game/arpg/art/manifest";
import { telegraphFrame } from "@/game/arpg/art/combat-effects";
import { arcClip } from "@/game/arpg/art/arc-clip";

function arenaStyle(x:number,y:number,w:number,h:number,width:number,height:number,angle=0):CSSProperties{
  return {position:"absolute",left:x/width*100+"%",top:y/height*100+"%",width:w/width*100+"%",height:h/height*100+"%",transform:"translate(-50%,-50%) rotate("+angle+"rad)"};
}
export function RoundTableWardView({players,width,height,nowMs}:{players:readonly ArpgRaidPlayerState[];width:number;height:number;nowMs:number}){
  const wards=players.flatMap(player=>player.arthurOaths?.ward?[player.arthurOaths.ward]:[]).filter((ward,index,all)=>nowMs<ward.expiresAtMs&&all.findIndex(other=>other.x===ward.x&&other.y===ward.y&&other.expiresAtMs===ward.expiresAtMs)===index);
  return <div className="forgotten-legend-effects" aria-hidden="true">{wards.map((ward,index)=>{
    const remaining=ward.expiresAtMs-nowMs;
    const frame=remaining>4550?FX_ART.wardAppear:remaining<450?FX_ART.wardDisappear:Math.floor(nowMs/300)%4===0?FX_ART.wardPulse:FX_ART.wardIdle;
    return <ArtSprite key={index} pack="fx" frame={frame} style={{...arenaStyle(ward.x,ward.y,ARTHUR_WARD_RADIUS*2,ARTHUR_WARD_RADIUS*2,width,height),opacity:0.65}}/>;
  })}</div>;
}
export function ForgottenLegendActor({encounter}:{encounter:BossEncounterSnapshot}){
  const art=encounter.bossId==="king-arthur"?arthurArtFrame(encounter):regionalBossArtFrame(encounter);
  const path=useAuthoredImage(art?.path??null,true);
  if(!art)return null;
  const definition=bossById(encounter.bossId);
  return <span className="forgotten-legend-actor" role="img" aria-label={definition.corruptedTitle} style={{display:"block",backgroundImage:"url("+path+")",backgroundSize:"400% 600%",backgroundPosition:art.frame%4/3*100+"% "+Math.floor(art.frame/4)/5*100+"%",imageRendering:"pixelated"}}/>;
}
export function BossEncounterView({encounter,width,height,players,onSkip}:{
  encounter:BossEncounterSnapshot;width:number;height:number;players:readonly ArpgRaidPlayerState[];onSkip:()=>void;
}){
  if(encounter.state==="CLEARED")return null;
  const definition=bossById(encounter.bossId);
  const intro=["ROOM_ENTERED","INTRO_LOCK","AWAKENING"].includes(encounter.state);
  const restored=["RESTORED","UNLOCK"].includes(encounter.state);
  const region=encounter.bossId==="ancestral-curupira"?"mata-encantada":encounter.bossId==="deep-iara"?"arquipelago-das-mares":"montanhas-runicas";
  const purificationElapsed=encounter.serverTimeMs-encounter.stateAtMs;
  const title=restored?"LENDA RESTAURADA • "+definition.title:encounter.state==="PURIFICATION"?"Não viemos destruir as histórias esquecidas. Viemos fazê-las lembrar.":encounter.state==="DEFEATED"?"RECORDAÇÃO":intro?definition.corruptedTitle:definition.title.split(" — ")[0];
  return <>
    <div className="forgotten-legend-effects" aria-hidden="true">
      {encounter.hazards.map(hazard=>{
        const circle=hazard.shape==="circle"||hazard.shape==="arc",impact=encounter.serverTimeMs>=hazard.impactAtMs;
        return <ArtSprite key={hazard.id} className="authored-telegraph" pack="fx" frame={telegraphFrame(region,circle?"circle":"rectangle",impact)}
          style={{...arenaStyle(hazard.x,hazard.y,circle?hazard.radius*2:hazard.width,circle?hazard.radius*2:hazard.height,width,height,circle?0:hazard.angle),clipPath:hazard.shape==="arc"?arcClip(hazard.angle,hazard.arc):undefined,opacity:impact?0.9:0.65}}/>;
      })}
      {encounter.state==="PURIFICATION"?<>
        <ArtSprite className="authored-purification" pack="fx" frame={FX_ART.purificationRing} style={{...arenaStyle(encounter.x,encounter.y,280,280,width,height),opacity:0.8}}/>
        <ArtSprite className="authored-purification" pack="fx" frame={purificationElapsed>4500?FX_ART.purificationBurst:FX_ART.purificationRays} style={{...arenaStyle(encounter.x,encounter.y,220,220,width,height),opacity:purificationElapsed<1000?0.35:0.7}}/>
      </>:null}
      {encounter.state==="PURIFICATION"?players.map(player=>{
        const legend=PLAYABLE_LEGENDS.find(legend=>legend.signatureAbilityIds.every(id=>player.loadout.abilityIds.includes(id)));
        const particle=legend?.id==="curupira"?FX_ART.leaf:legend?.id==="iara"?FX_ART.waterDrop:legend?.id==="raiju"?FX_ART.lightningFragment:legend?.id==="yeti"?FX_ART.snow:FX_ART.memoryFragment;
        const dx=encounter.x-player.x,dy=encounter.y-player.y;
        return <span key={player.id}><ArtSprite pack="world" frame={WORLD_ART.magicBeam} style={{...arenaStyle((player.x+encounter.x)/2,(player.y+encounter.y)/2,Math.hypot(dx,dy),18,width,height,Math.atan2(dy,dx)),opacity:0.8}}/><ArtSprite pack="fx" frame={particle} style={arenaStyle(player.x,player.y,32,32,width,height)}/></span>;
      }):null}
    </div>
    <div className={"forgotten-legend-title"+(intro?" forgotten-legend-title--intro":"")} role="status">
      {title}
      {encounter.state==="COMBAT"?<><small>{definition.phases[encounter.phase-1].title} · {Math.ceil(encounter.hp)}/{encounter.maxHp} HP</small><PixelHealthBar hp={encounter.hp} maxHp={encounter.maxHp} boss thresholds={definition.phases.slice(1).map(phase=>phase.hpThreshold*100)}/></>:null}
      {encounter.state==="RESTORED"?<small>Salvando progresso… Você já pode se mover.</small>:null}
      {intro&&encounter.seenByAll?<button type="button" onClick={onSkip}>Pular recordação ({encounter.skipVotes.length}/{encounter.participantIds.length})</button>:null}
      {encounter.state==="PURIFICATION"&&encounter.serverTimeMs-encounter.stateAtMs>3400?<small>{definition.purification.dialogue[encounter.serverTimeMs-encounter.stateAtMs>5000?1:0]}</small>:null}
    </div>
  </>;
}
