# Native auth / cloud save — phase 1

Base: `333647c1228f11f021b572982e9a3c3ea978513b`. Branch: `feat/native-auth-sync`.

## Findings before implementation

- `src/components/auth/login-dialog.tsx` always redirects to `/auth/callback`. That route is a rewrite to `src/server/http-handlers/auth-callback.ts`, which exchanges PKCE in the browser that received the redirect. A native application's verifier/cookies belong to a different storage context, so the external browser cannot establish the application's session.
- `src/lib/native-app.ts` handles suspension/back/orientation but neither `appUrlOpen` nor cold-start launch URLs. `mobile/prepare-native.cjs` generates Android/iOS projects in CI but does not register an auth scheme. Both clients load the hosted HTTPS origin.
- Electron blocks navigation away from the game origin and opens HTTPS in the external browser. `desktop/main.cjs` has no preload, protocol registration, single-instance lock or callback queue. No route brings OAuth back to the installed client.
- The installed Supabase SSR client uses PKCE and persistent first-party cookies (400-day max age). Supabase JS 2.117.2 also appends `sb_flow_id`; callbacks must preserve that parameter when exchanging a code.
- The login dialog updates its own identity only. `GameShell` initializes state from bootstrap once, so a later server refresh/account switch can leave stale coins, equipment, world or boss progress visible or cached under a different account.
- The page bootstrap includes boss progression/loadout; the duplicate GET `/api/player/progress` implementation omits them. Use one server snapshot loader.
- Local v4 saves already partition by account and never import guest economy into an authenticated account. Keep that boundary: server-confirmed economy/entitlements win; guest and emergency offline saves must remain recoverable. Offline rewards do not constitute an authenticated server proof.
- Sound settings initially lived only in localStorage. They need an independent, revisioned account contract; never synchronize economic rewards through a settings endpoint.
- Existing migrations include `20261010004944_corrupted_legend_restoration.sql`, four-player limits and authoritative run/reward RPCs. No OAuth migration is required. Native source projects are generated, so edit generators rather than untracked generated manifests.
- Current connectors expose only `lfmbvqixixbhffdpmvhp`; documented authorized test ref is `ywawwhnsvpfeppfcuwzg`. Do not substitute production. User will connect the test account. The user later chose Windows on their own PC instead of a connected Android for this session's physical QA.

## Implementation plan

1. Central auth provider with reusable native bridge and strict `folklard://auth/callback` parser; initiate external PKCE, exchange in the initiating app, preserve flow ID, prevent duplicate exchanges and reject expired/uninitiated callbacks. Keep web login working.
2. Register Android/iOS scheme in the existing generator; Electron protocol, cold/warm queue and isolated preload with trusted-origin checks. Keep existing default persistent session/storage and floating weapons/art/gameplay.
3. Refresh server-confirmed bootstrap on identity changes, remount state on authoritative snapshot changes, and share the complete snapshot loader. Preserve offline saves rather than merging client rewards.
4. Automated parser/exchange/lifecycle/account-conflict tests; four required checks and native CI builds. Real Windows installer → Google → app → restart → server save QA, then Android/iOS when devices are available. Treat external configuration/device tests as pending until observed.
5. Only after phase 1 passes, proceed to five-player co-op, combat feel, boss animation, audio and world restoration in the requested order.

## External configuration

Allow the native redirect in the correct Supabase project (including SDK-appended query parameters). Google uses the project's HTTPS `/auth/v1/callback` as its authorized redirect URI; it does not use the Folklard custom scheme. Preserve the web callback. Old installed clients need a new binary for protocol/browser plugin support. Vercel automatic builds/deployment settings remain unchanged; no deployment is part of this phase.

References: [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Electron deep links](https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app), [Capacitor App v7](https://capacitorjs.com/docs/v7/apis/app), [Capacitor Browser v7](https://capacitorjs.com/docs/v7/apis/browser).

## Resulting save contract

- Page and refresh API use one complete server bootstrap. A partial boss/world/loadout/profile query fails as a whole; it cannot erase ownership through defaults.
- Account-specific v4 progress and equipment caches carry a local source/revision. Before a differing authoritative cloud snapshot replaces an offline or legacy cache, the previous branch is saved in a bounded backup list. Failure to save that backup aborts replacement. These local revisions are not server reward proofs.
- Auth identity changes refresh the server bootstrap and reset initialized React state using a content fingerprint. The fingerprint is not a database revision. Guest/other-account economy is never imported or merged by maximum values.
- A session boundary immediately unmounts the old simulation and cache writers when the browser account and server snapshot differ. It waits for the matching snapshot and refreshes a mismatched initial session, preventing delayed responses from being cached for the previous account.
- The additive `native_player_preferences` migration introduces an account sound preference and a monotonic cloud revision. Owner-only RLS permits reading; only server authority can mutate through the invoker RPC. Repeated identical writes are idempotent; stale conflicting writes receive the current cloud state.
- A settings toggle made offline replays only against its known cloud revision. A different newer device setting wins while the local branch is archived. Guest sound remains separate; reduced motion continues to follow the device's accessibility preference. No economy or unlock fields are accepted by this API.
- Offline economic progress is retained for recovery; automatic reward replay is intentionally excluded because the current server has no offline combat proof. [QA and remaining acceptance gates](NATIVE_AUTH_CLOUD_SYNC_QA.md).
