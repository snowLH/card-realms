import { DEFAULT_AVATAR_CONFIG, type AvatarConfig } from "@/game/save/local-progress";
import { ARPG_ASSET_MANIFEST, registerArpgSpriteSheetAnimations } from "../assets";

const PLAYER_SHEET = ARPG_ASSET_MANIFEST.player;
export const CARTOGRAPHER_PLAYER_TEXTURE = PLAYER_SHEET.textureKey;
export const CARTOGRAPHER_PLAYER_FRAME_SIZE = PLAYER_SHEET.frameWidth;
export const CARTOGRAPHER_PLAYER_SCALE = PLAYER_SHEET.scale;

const AVATAR_COLORS = {
  skin: { amber: "#d8a16d", copper: "#b9764d", umber: "#694638", rose: "#edb6a2" },
  hair: { braids: "#302119", short: "#43291d", waves: "#563421", mohawk: "#292027" },
  outfit: { traveler: "#47694a", scholar: "#446c76", ranger: "#637340", merchant: "#a25f3b" },
  armor: { none: null, leather: "#9b6841", runic: "#65518d", guardian: "#5c7681" },
  accent: { gold: "#e8b849", emerald: "#4bd199", azure: "#69c5ec", crimson: "#ec6671" },
} as const;

const spritePose = (row: number, frame: number) => {
  const stride = [-5, 0, 5, 0][frame];
  const vertical = [0, -2, 0, -2][frame];
  if (row === 5) return { body: "rotate(-12 94 105)", arm: "translate(28 -4)", leg: 0 };
  if (row === 6) return { body: "rotate(9 94 105)", arm: "translate(-10 1)", leg: 0 };
  if (row === 7) return { body: "rotate(-18 94 105)", arm: "translate(12 10)", leg: stride };
  if (row === 8) return { body: "rotate(8 94 105)", arm: "translate(-18 11)", leg: 0 };
  if (row === 9) return { body: "translate(0 -4)", arm: "translate(0 -14)", leg: 0 };
  if (row === 10) return { body: "rotate(86 94 126) translate(16 -23)", arm: "translate(8 13)", leg: 0 };
  return { body: `translate(0 ${vertical})`, arm: "", leg: stride };
};

/** Returns the animated Phaser spritesheet for a configured player avatar. */
export function createCartographerAvatarSpritesheet(avatarConfig: AvatarConfig = DEFAULT_AVATAR_CONFIG) {
  const skin = AVATAR_COLORS.skin[avatarConfig.skin];
  const hair = AVATAR_COLORS.hair[avatarConfig.hair];
  const outfit = AVATAR_COLORS.outfit[avatarConfig.outfit];
  const armor = AVATAR_COLORS.armor[avatarConfig.armor];
  const accent = AVATAR_COLORS.accent[avatarConfig.accent];
  const hairStyle = avatarConfig.hair === "mohawk"
    ? `<path d="M68 50 Q75 26 92 27 Q106 29 111 51 L105 56 Q94 44 73 56Z" fill="${hair}"/><path d="M88 30 L94 16 L102 31Z" fill="${accent}"/>`
    : avatarConfig.hair === "waves"
      ? `<path d="M65 51 Q67 30 83 28 Q95 18 109 34 Q124 39 119 56 L109 53 Q104 42 96 45 Q85 38 77 53Z" fill="${hair}"/><circle cx="69" cy="50" r="8" fill="${hair}"/><circle cx="112" cy="48" r="8" fill="${hair}"/>`
      : avatarConfig.hair === "short"
        ? `<path d="M67 54 Q65 29 91 27 Q117 28 116 53 L105 49 Q91 43 76 52Z" fill="${hair}"/>`
        : `<path d="M65 52 Q67 27 91 27 Q116 28 118 53 L108 49 Q95 40 76 52Z" fill="${hair}"/><path d="M71 48 Q61 70 69 94 L77 88 L78 55Z M108 49 Q123 69 116 92 L108 88 L103 54Z" fill="${hair}"/><path d="M65 89 L70 101 L76 92 M112 88 L117 101 L121 90" fill="none" stroke="${accent}" stroke-width="4"/>`;

  const frames = Array.from({ length: PLAYER_SHEET.frameCount }, (_, frameIndex) => {
    const column = frameIndex % PLAYER_SHEET.columns;
    const row = Math.floor(frameIndex / PLAYER_SHEET.columns);
    const pose = spritePose(row, column);
    const facingBack = row === 2;
    const facingSide = row === 3 || row === 4;
    const face = facingBack
      ? ""
      : `<ellipse cx="94" cy="66" rx="24" ry="27" fill="${skin}"/><path d="M72 66 Q94 75 116 64 L113 82 Q106 95 94 95 Q80 92 74 80Z" fill="${skin}"/>${facingSide ? `<rect x="103" y="64" width="5" height="5" rx="2" fill="#241914"/>` : `<rect x="81" y="63" width="5" height="5" rx="2" fill="#241914"/><rect x="103" y="63" width="5" height="5" rx="2" fill="#241914"/>`}<path d="M88 79 Q94 83 101 79" fill="none" stroke="#754b36" stroke-width="3" stroke-linecap="round"/>`;
    const legLeft = row >= 5 && row !== 7 && row !== 10 ? 0 : pose.leg;
    const legRight = row >= 5 && row !== 7 && row !== 10 ? 0 : -pose.leg;
    const armorFill = armor ?? outfit;
    const armorDetails = armor
      ? `<path d="M74 97 L94 102 L114 97 L110 128 L94 135 L78 128Z" fill="${armor}" stroke="#302b31" stroke-width="4"/><path d="M78 104 L94 109 L110 104" fill="none" stroke="${accent}" stroke-width="4"/><circle cx="94" cy="118" r="5" fill="${accent}"/>`
      : `<path d="M76 99 L94 104 L112 99 L108 132 L94 139 L80 132Z" fill="${outfit}" stroke="#302b31" stroke-width="4"/><path d="M88 105 L94 113 L100 105 L101 135 L87 135Z" fill="${accent}"/>`;
    return `<g transform="translate(${column * CARTOGRAPHER_PLAYER_FRAME_SIZE} ${row * CARTOGRAPHER_PLAYER_FRAME_SIZE})">
      <ellipse cx="94" cy="158" rx="42" ry="8" fill="#15221d" opacity=".55"/>
      <g transform="${pose.body}">
        <rect x="76" y="124" width="15" height="27" rx="5" fill="#46392f" transform="translate(${legLeft} 0)"/><rect x="97" y="124" width="15" height="27" rx="5" fill="#46392f" transform="translate(${legRight} 0)"/>
        <path d="M70 145 Q82 140 94 145 Q107 140 118 145 L121 153 Q108 159 94 155 Q80 159 67 153Z" fill="#332820"/><path d="M73 149 L91 150 M98 150 L116 149" stroke="${accent}" stroke-width="3"/>
        <path d="M73 96 Q94 87 115 96 L120 127 Q94 139 68 127Z" fill="${outfit}" stroke="#302b31" stroke-width="4"/>
        ${armorDetails}
        <path d="M76 98 Q61 105 62 126 L72 130 L82 108Z M112 98 Q127 105 126 126 L116 130 L106 108Z" fill="${armorFill}" stroke="#302b31" stroke-width="4"/>
        <g transform="${pose.arm}"><rect x="58" y="119" width="17" height="10" rx="5" fill="${skin}"/><rect x="113" y="119" width="17" height="10" rx="5" fill="${skin}"/></g>
        <path d="M78 90 Q94 99 110 90 L108 101 Q94 110 80 101Z" fill="${accent}"/>
        <rect x="82" y="84" width="24" height="16" rx="4" fill="${skin}"/>
        ${face}
        ${hairStyle}
        <path d="M78 92 Q94 99 110 92" fill="none" stroke="#4b3024" stroke-width="3"/>
      </g>
    </g>`;
  }).join("");

  const sheetWidth = CARTOGRAPHER_PLAYER_FRAME_SIZE * PLAYER_SHEET.columns;
  const sheetHeight = CARTOGRAPHER_PLAYER_FRAME_SIZE * PLAYER_SHEET.rows;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetWidth}" height="${sheetHeight}" viewBox="0 0 ${sheetWidth} ${sheetHeight}" shape-rendering="crispEdges">${frames}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export type CartographerPlayerAnimation = keyof typeof PLAYER_SHEET.animations;
export type CartographerPlayerAction = Exclude<CartographerPlayerAnimation, "idle" | `walk-${string}`>;

export function registerCartographerPlayerAnimations(scene: import("phaser").Scene) {
  registerArpgSpriteSheetAnimations(scene, {
    textureKey: PLAYER_SHEET.textureKey,
    animations: PLAYER_SHEET.animations,
    columns: PLAYER_SHEET.columns,
    keyPrefix: PLAYER_SHEET.animationKeyPrefix!,
  });
}

export function playCartographerPlayerAnimation(
  sprite: import("phaser").GameObjects.Sprite,
  animation: CartographerPlayerAnimation,
  restart = false,
) {
  const key = `${PLAYER_SHEET.animationKeyPrefix}-${animation}`;
  if (restart || sprite.anims.currentAnim?.key !== key) sprite.play(key);
}
