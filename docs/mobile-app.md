# Mobile App — Dev Client & Build Profiles

The Greeklish mobile app (`learn-greek-easy-mobile/`) is an Expo SDK 56 + Expo Router +
TypeScript app built as a custom **dev client** and managed via EAS Build under the
`sams-team` org.

## Variants & bundle IDs

Per-environment config is driven by the `APP_VARIANT` env var (default `development` when unset),
resolved in `app.config.ts`:

| `APP_VARIANT` | Display name | iOS bundleIdentifier / Android package |
|---|---|---|
| `development` | Greeklish (Dev) | `eu.greeklish.app.dev` |
| `preview` | Greeklish (Preview) | `eu.greeklish.app.preview` |
| `production` | Greeklish | `eu.greeklish.app` |

Each variant installs as a separate app (distinct bundle IDs), so dev / preview / prod
coexist on one device or simulator.

## Config approach — no `.env`

All per-environment config lives committed in `app.config.ts`, keyed by `APP_VARIANT`.
EAS sets that variable at build time via the `env` block in each `eas.json` profile —
there is no `.env` file to create or manage.

These values are intentionally client-public: a mobile binary can be decompiled, so there
is nothing to hide in `app.config.ts`. The only real secret in the epic (the EAS CI token)
lives in GitHub Actions secrets and is wired in MOB-08. Future stories add committed
Supabase credentials (MOB-03) and the API URL (MOB-05) into the same variant map.

## EAS build commands per profile

Authenticate first (`eas whoami` — must be in the `sams-team` org):

```bash
eas login          # if not already logged in
eas whoami         # confirm sams-team org
```

Then build:

```bash
# iOS simulator dev-client build (developmentClient: true, simulator: true)
eas build --profile development --platform ios

# Internal-distribution, simulator-capable build
eas build --profile preview --platform ios

# Store-oriented build (not wired for TestFlight/store submit yet)
eas build --profile production --platform ios
```

Notes:
- `development` and `preview` target the iOS simulator.
- There is no Apple Developer Program enrollment yet, so device distribution, TestFlight,
  and store submission are not wired up.
- All builds run on EAS cloud (no local Xcode required for building).

## Local development

```bash
npm install
npx expo start           # starts Metro; the dev client connects to load the JS bundle
```

Use `npx expo start --ios` to open directly in the iOS simulator. Day-to-day JS/TS edits
hot-reload over Metro — you only rebuild the dev client when **native** code or config
changes (new native module, `app.config.ts` native keys, SDK bump).

## Verification

1. **TypeScript** — from `learn-greek-easy-mobile/`:

   ```bash
   npx tsc --noEmit
   ```

2. **Dev-client simulator build** — trigger the development profile, then install/launch:

   ```bash
   eas build --profile development --platform ios

   # Install a finished cloud build on a booted simulator without rebuilding:
   eas build:run -p ios --id <build-id>
   # or manually:
   xcrun simctl install booted /path/to/Greeklish.app
   xcrun simctl launch booted eu.greeklish.app.dev
   ```

   Expected: the app boots showing the **Greeklish (Dev)** name and the Expo dev menu
   appears on Cmd+D. Requires an iOS simulator runtime installed locally
   (`xcodebuild -downloadPlatform iOS` + Xcode Simulator runtimes).

   **First verified dev-client build:**
   [`81fbd3cf`](https://expo.dev/accounts/sams-team/projects/greeklish-app/builds/81fbd3cf-a886-40c3-98c2-7d8e109b6688)
   — booted on the iOS 26.4 simulator with a working Expo dev menu.
