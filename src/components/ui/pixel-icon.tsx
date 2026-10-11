"use client";
import {useState,type CSSProperties,type ImgHTMLAttributes} from 'react';
import {UI_ART,FOLKLARD_ART_MANIFEST,type UiArtName} from '@/game/arpg/art/manifest';
type PixelIconProps=Omit<ImgHTMLAttributes<HTMLImageElement>,'src'|'width'|'height'> & {size?:number|string;strokeWidth?:number;color?:string};
function icon(name:UiArtName,style?:CSSProperties){
  function PixelIcon({size=24,strokeWidth,color,...props}:PixelIconProps){
    void strokeWidth;void color;
    const [failed,setFailed]=useState(false);
    // Native image keeps the authored 64px icon crisp at every UI scale.
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} className={['pixel-icon',props.className].filter(Boolean).join(' ')} src={failed?FOLKLARD_ART_MANIFEST.missing.path:UI_ART[name].path} width={size} height={size} alt={props.alt??''} draggable={false}
      style={{imageRendering:'pixelated',objectFit:'contain',flexShrink:0,...style,...props.style}}
      onError={()=>{if(!failed){console.error('Missing pixel icon: '+name);setFailed(true);}}}/>;
  }
  return PixelIcon;
}
export const Album=icon('book');
export const Apple=icon('hero');
export const ArrowLeft=icon('back');
export const ArrowLeftRight=icon('equipment');
export const ArrowRight=icon('back',{transform:'scaleX(-1)'});
export const BookOpen=icon('book');
export const CalendarDays=icon('book');
export const Check=icon('check');
export const ChevronLeft=icon('back');
export const ChevronRight=icon('back',{transform:'scaleX(-1)'});
export const Clock3=icon('pause');
export const Coins=icon('coin');
export const Compass=icon('map');
export const Copy=icon('book');
export const Crosshair=icon('target-marker-locked');
export const Crown=icon('boss');
export const Download=icon('backpack');
export const Filter=icon('settings');
export const Footprints=icon('dash');
export const Gamepad2=icon('attack');
export const Gem=icon('shard');
export const Gift=icon('shard');
export const Hand=icon('interact');
export const Heart=icon('life');
export const KeyRound=icon('lock');
export const Link2=icon('connection');
export const LoaderCircle=icon('star',{animation:'pixel-icon-spin 1s steps(8) infinite'});
export const Lock=icon('lock');
export const LockKeyhole=icon('lock');
export const LogIn=icon('hero');
export const LogOut=icon('exit');
export const Mail=icon('book');
export const Map=icon('map');
export const MapPin=icon('map');
export const MapPinned=icon('map');
export const Maximize2=icon('fullscreen');
export const MessageCircle=icon('book');
export const Monitor=icon('fullscreen');
export const MousePointer2=icon('cursor-default');
export const Move=icon('dash');
export const PackageOpen=icon('backpack');
export const PackagePlus=icon('backpack');
export const Pause=icon('pause');
export const Play=icon('attack');
export const Radio=icon('connection');
export const RotateCcw=icon('back');
export const RotateCw=icon('back');
export const Save=icon('check');
export const ScrollText=icon('book');
export const Search=icon('map');
export const Settings=icon('settings');
export const Shield=icon('defense');
export const ShieldAlert=icon('defense');
export const ShieldCheck=icon('defense');
export const ShoppingBag=icon('backpack');
export const Skull=icon('boss');
export const Smartphone=icon('fullscreen');
export const Sparkles=icon('skill');
export const Star=icon('star');
export const Store=icon('backpack');
export const Swords=icon('attack');
export const TentTree=icon('roots');
export const Trash2=icon('exit');
export const Trophy=icon('star');
export const UserPlus=icon('party');
export const UserRound=icon('hero');
export const Users=icon('party');
export const UsersRound=icon('party');
export const Volume2=icon('sound');
export const VolumeX=icon('sound',{opacity:0.45});
export const Wind=icon('dash');
export const X=icon('exit');
export const Zap=icon('lightning');
