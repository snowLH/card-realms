<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Deployment safety

- Vercel Git auto-deployments are intentionally disabled in `vercel.json`.
- Never use `main` as a scratch/work branch or push a sequence of intermediate refactor commits there.
- Before any production deployment, `npm run verify:deploy` must pass completely: typecheck, lint, tests, and Next.js production build.
- For production, prefer a local Vercel production build followed by a prebuilt deployment: `vercel pull --yes --environment=production`, then `vercel build --prod`, then `vercel deploy --prebuilt --prod`.
- Do not create a remote deployment to discover build errors. Fix build/type/lint/test failures locally or in CI first.
- Database migrations must be applied and verified against the intended Supabase project before promoting application code that depends on them.
- Do not re-enable automatic Vercel Git deployments unless the user explicitly asks for that behavior.
