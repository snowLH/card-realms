"use client";
import type { ArpgRaidDungeonRegionId } from "@/game/arpg/raid";
import { ARPG_DUNGEON_CONFIGS } from "@/game/arpg/content/dungeons";
import { getArpgEnemyAnimationProfile, isArpgEnemyAnimationProfile } from "@/game/arpg/runtime/enemy-sprites";
import { getGeneratedLegendSpriteSheet } from "@/game/arpg/runtime/legend-sprite-sheets";
import { useAuthoredImage } from "@/components/ui/use-authored-image";

export function RaidEnemyArt({regionId,definitionId,name,nowMs}:{regionId:ArpgRaidDungeonRegionId;definitionId:string;name:string;nowMs:number}) {
  const profile=ARPG_DUNGEON_CONFIGS[regionId].enemyAnimations?.[definitionId];
  const definition=isArpgEnemyAnimationProfile(profile)?getArpgEnemyAnimationProfile(profile):null;
  const path=useAuthoredImage(profile==="sprout-enemy"?getGeneratedLegendSpriteSheet("sprout"):definition?.path??null,true);
  const frame=4+Math.floor(nowMs/180)%4;
  return <span className="arpg-raid-enemy__sprite" role="img" aria-label={name} style={{backgroundImage:`url(${path})`,backgroundPosition:`${frame%4/3*100}% ${Math.floor(frame/4)/5*100}%`}}/>;
}

export function raidRoomBackground(regionId:ArpgRaidDungeonRegionId) {
  return ARPG_DUNGEON_CONFIGS[regionId].background;
}
