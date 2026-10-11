import {DUNGEON_ART} from '../art/manifest';
export function getAuthoredDungeonTiles(regionId:string){
  const art=DUNGEON_ART[regionId as keyof typeof DUNGEON_ART];
  if(!art)throw new Error('Authored dungeon tiles missing: '+regionId);
  return art;
}
