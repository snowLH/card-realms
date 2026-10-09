<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# FOLKLARD: gameplay is exclusively a real-time ARPG

The user explicitly authorized direct implementation on `main`. Do not create development branches; the separate branch workflow has caused deploy issues. Preserve history and commit cohesive, reviewed changes; never force-push main. A code commit is not permission to deploy to production.

## Product rules
- `src/game/arpg` is the primary gameplay: Phaser top-down action, procedural dungeons, folklore playable legends, two signature powers, two weapon slots, bosses, loot, online progression, co-op ARPG.
- `src/components/game/game-shell.tsx` is navigation only, not a second game engine.
- Retired TCG, energy packs, turn-based PvP and board-picking must not be added back to the playable UI. Internal legacy API, schema and snapshot fields exist only to preserve past saves and database compatibility until an audited migration is possible.
- Never copy code/assets/map layouts of Soul Knight or any other proprietary title. Reuse abstract genre conventions and build original IP.
- **Visual assets, spritesheets, UI art, animation, color and layout passes are reserved for ChatGPT Work.** Gameplay/API tasks may modify structural markup required to support interaction, but never block or rewrite art passes.
- Preserve the detailed hero and NPC designs in the active sprite catalog. The user rejected the simplified 32px v3 character studies as a regression on 2026-10-09. Keep those studies archived; do not activate them again. Compare future art changes with the established designs inside the actual Guild and dungeons, preserving detail, personality and consistency with the scenery.

## Code quality and release safety
- Keep domain and simulation functions pure/testable; avoid adding methods to the already-large Phaser DungeonScene when they belong in independent modules.
- Changes to encounter generation must stay seed deterministic and match client/server.
- Supabase performs persisted economy and authorization. Never trust client loot, run clears or coins; never commit secrets.
- Before deployment, `npm run verify:deploy` must pass fully (typecheck, lint, Vitest, Next production build). Inspect latest GitHub Actions status if only remote testing is available.
- Migrations cannot be presumed applied. Do not touch an unrelated Supabase project or promote code requiring unverified schema.
- Vercel auto-deploy remains disabled in `vercel.json`. Production deployment is a separate, verified step.
- Document any inaccessible staging, device or browser tests honestly.
