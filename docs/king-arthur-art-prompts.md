# Rei Arthur — prompts de arte v5

Gerados com a ferramenta integrada `image_gen`, seguindo a base visual aprovada da Naturalista. Fontes PNG arquivadas em `outputs/art-sources-v5` do workspace; assets finais em `public/art`. A exportação utiliza o mesmo `scripts/export-character-atlases.mjs` das demais lendas, com `scripts/king-arthur-art.json`. A exportação é determinística a partir das fontes; a geração criativa não é determinística.

## Referências do personagem restaurado

1. `docs/folklard-character-style-reference.png` — captura da Naturalista enviada pelo usuário.
2. `public/art/guild-bestiary-keeper-spritesheet-v5.webp` — Naturalista ativa.
3. `public/art/legend-curupira-spritesheet-v5.webp` — Curupira ativo.

Fonte: `king-arthur.png`. Resultado: `/art/legend-king-arthur-spritesheet-v5.webp`.

```
Use case: style-transfer / game sprite sheet.
Create King Arthur RESTORED / PLAYABLE for the existing Folklard pixel-art ARPG. These are STYLE REFERENCES, not edit targets: image 1 is the exact user-approved Naturalist screenshot; image 2 is the active Naturalist v5 spritesheet; image 3 is the active Curupira v5 spritesheet. Match their visual family literally. Do not reuse their costumes or identity.

ART BASE IS MANDATORY: compact cute chibi body, oversized round expressive head about 45% of standing height, tiny short limbs, simple narrow black pixel eyes like Naturalist, dense intentional 2D 16-bit square-pixel clusters, dark stair-step 1–2 logical pixel outline, small 3–4 tone color ramps, same detail density and flat lighting as the reference sprites. Human knight king, NOT a rectangular block/stick figure, NOT realistic, NO 3D, NO smooth illustrated/painted gradients. Native logical 64x64 cells; character about 44–46 logical pixels tall. Render pixels cleanly and at nearest-neighbor scale.

IDENTITY: mature but chibi King Arthur, light brown slightly tousled hair, small short sandy brown beard, readable face with small old cheek scar, battered golden three-point crown with one slightly bent point, royal navy-blue short cape lined cream, silver plate armor with soft blue shadows and small warm gold clasps/trim. Armor has a few dark old dents/fracture marks, retained after restoration. Noble gentle tired expression. Colors stay warm and saturated enough to belong beside Naturalist and Curupira. No corruption covering the restored hero, no long face, no angular robot torso. EMPTY HANDS in idle/walk: the game supplies floating weapons separately. Tiny spectral silver/gold blade or round-table pixel sigil is permitted only within attack/power frames.

TECHNICAL COMPOSITION: a TRUE TRANSPARENT spritesheet, exact 1024x1536 PNG, four columns and six rows, 24 full-body frames in exact 256x256 cells. Feet standing baseline about y=224 within each cell. Every cell has at least 16 px transparent margins; no overlap across cells. Consistent body size, head size, camera and proportions. Same southeast-facing three-quarter angle in ALL idle frames. No scenery, floor, throne, labels, text, watermark or grid.

ROW ORDER:
1: four idle/blink/breath poses, hands empty.
2: four walk-cycle poses with alternating short legs and cape movement.
3: four Camelot Cut casting/attack poses, an intentional compact spectral silver/gold blade gesture, no enormous effects hiding the actor.
4: four Round Table Oath casting poses, hands gesture with tiny gold/blue rune sparks.
5: four hurt/recover poses.
6: four exhausted/fall gameplay poses, ending lying/collapsed for ordinary playable defeat; not the boss purification.
All frames must be individually authored, not one identical pose pasted 24 times.

Deliver only the spritesheet. GENUINE TRANSPARENT ALPHA, no checkerboard drawn into pixels. Preserve the specific user-approved art base above.
```

## Referências do boss corrompido

1. A mesma captura aprovada da Naturalista.
2. A mesma folha ativa da Naturalista.
3. `king-arthur.png` recém-gerado — identidade do mesmo Arthur restaurado.

Fonte: `king-arthur-corrupted.png`. Resultado: `/art/monster-king-arthur-corrupted-spritesheet-v5.webp`.

```
Use case: style-transfer / game sprite sheet.
Create the CORRUPTED KING ARTHUR BOSS animation sheet for Folklard.
Input images are references, not edit targets: image 1 is the user-approved Naturalist screenshot (MANDATORY style base), image 2 is the active Naturalist v5 spritesheet (pixel geometry/detail reference), image 3 is the newly generated RESTORED ARTHUR sheet (MANDATORY SAME CHARACTER identity). Arthur must be immediately recognizable as the same king in image3 with identical compact chibi proportions, hair, crown, armor and cape. Do not draw a different face or a taller realistic knight.

STYLE: match Naturalist literally: oversized expressive round head ~45% of standing height, tiny short stout limbs, simple narrow pixel eyes, detailed small clusters, black/dark-brown stepped outline 1–2 logical pixels, 3–4 tone ramps, flat warm 16-bit 2D game sprite shading. Native logical64x64cells and44–46pixel standing silhouette. NO 3D, NO realistic anatomy, NO painterly textures, NO blocky rectangle/stick-figure body. Pixel detail as rich as Naturalist, not simplified. The boss is larger ONLY when rendered by the game, not through different body proportions.

SAME ARTHUR from image3, now a forgotten wounded king trapped in his final war: light brown tousled hair and small short sandy beard, crooked dented golden three-point crown with blue inset, battered silver plate armor with visible cracks, rich navy-blue royal shroud/cape torn at the edge, gold clasps retained. Face has old small scar and weary exhausted gaze, pale skin, small violet eyes/memory cracks in late awake frames. Blue/silver/gold remain clear under muted charcoal-violet corrosion. Sinister sadness and memory fragmentation, NOT gore or red horror, NOT monster skull. Excalibur silver/gold long straight knight sword is a boss prop.

COMPOSITION: exact transparent1024x1536PNG spritesheet,4columns6rows256x256cells,24 fullbody frames. Standing feet baseline224 within cells, transparent16px margins all cells, exact regular grid. Consistent scale, same southeast three-quarter view for all poses. No background, no scenery, no throne (throne is separate in game), no text, watermark, drawn grid, checkerboard or smooth glow. Truly transparent alpha. Each frame isolated.

EXACT FRAME CONTENT BY ROW, read left to right:
ROW1 intro: 1 seated slumped completely still eyes lowered (sitting on an invisible seat, bent short legs, crown/cape visible); 2 seated with hand/finger twitch; 3 seated head raised toward players; 4 seated awake with tiny violet eye/corruption cracks.
ROW2 awakening: 5 struggling to rise leaning/knees bent; 6 leaning on upright sword tip as support; 7 drawing/lifting Excalibur; 8 upright ready knight stance with sword beside body.
ROW3 four walking frames: short heavy alternating steps with sword carried and cape sway.
ROW4 four clear royal sword attack windup/swing/recovery frames, keep blade inside cell, no enormous attack effect.
ROW5: 17 defensive sword guard pose; 18 exhausted weakness supported on sword; 19 defeated KNEELING alive with EMPTY HANDS, sword released (game draws dropped sword separately); 20 kneeling reaching toward fallen sword with EMPTY HANDS. No body disappears, no death, no lying corpse.
ROW6 four purification frames SAME KNEELING ALIVE KING: 21 dark corruption escaping as a few discrete pixels; 22 fewer violet fragments and warmer armor; 23 clear silver/blue/gold armor restored; 24 fully RESTORED kneeling alive, peaceful face, old scars and dents still present, matching image3 colors, EMPTY HANDS. Tiny discrete fragments only, no opaque glow.

Do not convert defeat into death. Deliver only the sheet, exact same character and game art base in every cell.
```

