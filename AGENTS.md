<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CARD REALMS: strategy, cards, and living folklore tabletop board

The user explicitly authorized direct implementation on `main`. Do not create development branches; the separate branch workflow has caused deploy issues. Preserve history and commit cohesive, reviewed changes; never force-push main. A code commit is not permission to deploy to production.

## Product rules
- `src/game/card-realms` is the primary gameplay: a strategic card and living tabletop board game (Phaser 2.5D tilted board + React tactical hand/HUD) where world folklores and mythologies (starting with Brazil vs Japan in the Vertical Slice) clash across dynamic territories, structures, events, and materialized creatures that choose between Attack (`Investida`) or Awakening Power (`Despertar Ancestral`) to destroy the opponent's Kingdom Heart (`Coração do Reino`).
- `src/game/arpg` is archived/frozen legacy code kept only for backward compatibility with existing database snapshots and legacy routes; do not expand the old real-time WASD dungeon crawler.
- `src/components/game/game-shell.tsx` is navigation only, not a second game engine.
- Never copy code, proprietary rules, card names, or assets of Card Wars, Soul Knight, or any other proprietary title. Reuse abstract genre conventions and build original IP rooted in world folklore.
- **Visual assets, spritesheets, UI art, animation, color and layout passes must stay cohesive.** Reuse the established authored pixel-art atlases (`FOLKLARD_ART_MANIFEST`) and v5 character catalog (`docs/folklard-character-style-reference.png`) consistently across cards, portraits, and materialized board actors.

## Code quality and release safety
- Keep domain, board, and gameplay simulation functions pure and testable in `src/game/card-realms/{domain,board,gameplay}` without depending on Phaser; Phaser (`src/game/card-realms/runtime`) materializes the board state visually.
- Changes to match simulation and AI must stay deterministic.
- Supabase performs persisted economy and authorization. Never trust client loot, run clears or coins; never commit secrets.
- Before deployment, `npm run verify:deploy` must pass fully (typecheck, lint, Vitest, Next production build). Inspect latest GitHub Actions status if only remote testing is available.
- Migrations cannot be presumed applied. Do not touch an unrelated Supabase project or promote code requiring unverified schema.
- Vercel auto-deploy remains disabled in `vercel.json`. Production deployment is a separate, verified step.
- Document any inaccessible staging, device or browser tests honestly.
