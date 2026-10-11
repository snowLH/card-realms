# Phase 1 — native auth and cloud synchronization

## Implemented

Native PKCE returns through `folklard://auth/callback` to the application that owns its verifier. The shared auth provider preserves SDK flow IDs, handles first/warm launches, rejects uninitiated/expired callbacks and duplicate exchanges, refreshes authoritative progress on account changes and signs out only the current device. Android/iOS generators register the scheme; Capacitor uses the system auth browser. Electron keeps sandbox/context isolation and exposes a restricted, main-frame/origin-checked auth bridge.

The server page and refresh API load the same complete economy, boss, world and loadout snapshot. A session boundary immediately unmounts stale gameplay/cache writers during account changes, discards delayed receipts and waits for matching server data, including a different restored initial session. Cloud state replaces account cache only after preserving conflicting offline data. Preferences use a separate revisioned contract with retry/restart/account isolation; no client economy/reward import is introduced.

No character, sprite, floating weapon, boss presentation, dungeon layout or Vercel deployment configuration changed.

## Local Windows QA observed

The user authorized side-by-side installation and opening. A real NSIS installer installed **Folklard Native QA 0.2.0** under its separate product name/app ID. The QA profile is `Folklard-Native-QA`, and its package embeds only the loopback origin `http://127.0.0.1:3000/`. Normal installers keep the production origin and existing profile.

Observed in the installed executable, through Windows UI automation:

- Title screen and Guild rendered the authored pixel art from the local production build.
- F11 entered fullscreen and Escape returned to the window.
- Guest Boto purchase changed 500 coins to 260; selection displayed Boto in the Guild.
- Sound was disabled, then the app was closed and relaunched. Boto, 260 coins and disabled sound persisted.
- The native protocol command was registered to the installed executable with the QA origin/profile arguments.
- Opening while the local server was stopped showed the bundled recovery screen. After starting the server, the updated installed executable's retry button returned to the configured loopback game inside the app.
- Production loopback builds originally reported a ready offline pack but bypassed navigation caching. Production registration now explicitly opts into offline handling; development still unregisters both worker URLs and clears its caches. After updating the pack and stopping the server, `/offline` and the Phaser Guild rendered from cache with Boto, 260 coins and sound off. This is local-server-offline QA, not physical network disconnection or a complete dungeon/boss run.

Screenshots were captured in the task's `outputs/native-auth-sync` directory: title, Guild, fullscreen, before/after restart, legend catalog, `windows-recovery.png`, `windows-recovered.png`, `windows-offline-title.png` and `windows-offline-guild.png`. Private browser/app storage was not committed. The user's original browser tab and visitor progress were preserved.

The browser title/auth dialog was also inspected locally. This build has no Supabase environment variables; it correctly offers visitor play and does not claim a cloud session. This is **not** a real Google or cloud-save acceptance test.

## Verification categories

| Category | Evidence / status |
|---|---|
| Implemented | Native bridge/registration/provider, full server bootstrap, cache preservation, revisioned sound sync |
| Unit / component tests | Parser, SDK flow binding, exchange failure/retry/replay, account changes, native listener lifecycle, settings lifecycle and conflicts |
| Embedded PostgreSQL | Additive preference migration, repeat migration retaining data, optimistic revision conflict/idempotence, RLS ownership and denied client writes; existing boss migration suite retained |
| Browser UI | Local title and honest unconfigured account state observed |
| Real installed Windows | Title, Guild, fullscreen/Escape, guest progress/sound restart persistence, recovery retry and cached offline Guild observed |
| Native builds | Windows regular and isolated QA installers compiled locally; Android APK, iOS simulator app, Windows NSIS and Linux AppImage passed CI for `56fe582`; final follow-up status is linked in the PR |
| Google with a real user | Pending correct test-project access/configuration and user-operated Google login |
| Cross-device authenticated progress/settings | Pending the same real account on web/Windows, then Android/iOS |
| Real multiplayer | Not tested in phase 1; phase 2 must wait for native auth acceptance |

## Database / external gates

`20261011115802_native_player_preferences.sql` was generated with Supabase CLI and tested on embedded PostgreSQL. It adds a new table without modifying existing account/economy tables. Authenticated clients can select only their row; direct INSERT/UPDATE/DELETE and RPC execution are revoked. A verified HTTP account claim supplies the target ID to the service-only `SECURITY INVOKER` RPC. Invalid user/reward fields and cross-origin mutations are rejected.

This migration has **not** been applied remotely. The available connectors still list only `lfmbvqixixbhffdpmvhp`; the documented authorized ref is `ywawwhnsvpfeppfcuwzg`. Remote migration history, database advisors, RLS probes and OAuth allowlist/provider configuration must be verified on the authorized environment before promotion. Production is not a substitute.

After access is restored: inspect migration history, apply the additive migration in the proper test environment, run security/performance advisors and RLS/duplicate/conflict tests, configure native redirect with SDK query parameters, and provide local test-project public/secret environment configuration through the normal secure environment setup. Google must retain the project's HTTPS `/auth/v1/callback`; the custom scheme is a Supabase application redirect.

Then validate web progress → installed Windows same account → restart session → Windows progress → web same account, duplicate/cold/warm returns, cancellation, offline restart and settings conflicts. The human user completes Google credential/authentication screens. Build success and mocked callbacks do not prove Google works on a physical device.

## Reproducing the Windows QA package

Build the root application and run it on port 3000. In `desktop`, run `npm run dist:win:qa`, then install the generated `dist-qa/Folklard-Native-QA-0.2.0.exe`. Launch the installed **Folklard Native QA** shortcut. It uses separate storage and only the loopback origin. `npm run dist:win` remains the normal installer; QA metadata is never injected there.

## Performance and limitations

Auth runs at session boundaries, not in the Phaser update loop. Callback exchange is serialized. Preference requests happen on account load, setting changes and reconnect; they do not poll every frame. Offline backup lists are bounded to three entries. No five-player FPS/network benchmark or physical mobile performance claim is made in this phase.

The initial Windows targeted test attempt encountered a worker startup timeout; its complete targeted rerun passed. Final local mandatory checks passed: `npm run typecheck`, `npm run lint`, `npm test` (**137 files / 721 tests**) and `npm run build`. CI verification and all native targets passed for `56fe582`: [Verify](https://github.com/snowLH/card-realms/actions/runs/38139134804), [Android](https://github.com/snowLH/card-realms/actions/runs/38139134830), [iOS Simulator](https://github.com/snowLH/card-realms/actions/runs/38139134793), [Windows/Linux](https://github.com/snowLH/card-realms/actions/runs/38139134794). The subsequent offline follow-up is covered by the local gate and the latest checks on [draft PR #18](https://github.com/snowLH/card-realms/pull/18).

Phase 1 is not accepted until real native Google/session/cloud tests and remote schema/advisors pass. Phase 2 has not started. No Vercel deployment, automatic-build reactivation or merge to main was performed.
