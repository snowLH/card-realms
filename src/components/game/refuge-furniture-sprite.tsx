import type {RefugeFurnitureKey} from '@/game/refuge';
import {REFUGE_ART} from '@/game/arpg/art/manifest';
import {useAuthoredImage} from '@/components/ui/use-authored-image';
export function RefugeFurnitureSprite({itemKey,className}:{itemKey:RefugeFurnitureKey;className?:string}){
  const path = useAuthoredImage(REFUGE_ART[itemKey]);
  // Existing authored furniture is exported once, never reconstructed in the browser.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={path} className={className} width={32} height={32} alt="" aria-hidden="true" draggable={false}/>;
}
