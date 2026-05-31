# Greeklish Mobile

Expo SDK 56 + Expo Router + TypeScript app with a custom dev-client build. Managed via EAS Build under the `sams-team` org.

## Variants & bundle IDs

Per-environment config is driven by the `APP_VARIANT` env var. When unset it defaults to `development`.

| `APP_VARIANT` | Display name | iOS bundleIdentifier / Android package |
|---|---|---|
| `development` | Greeklish (Dev) | `eu.greeklish.app.dev` |
| `preview` | Greeklish (Preview) | `eu.greeklish.app.preview` |
| `production` | Greeklish | `eu.greeklish.app` |

Each variant installs as a separate app on device/simulator because the bundle IDs differ.

## Config approach — no `.env`

All per-environment config lives committed in `app.config.ts`, keyed by `APP_VARIANT`. EAS sets this variable at build time via the `env` block in each `eas.json` profile — there is no `.env` file to create or manage locally.

These values are intentionally client-public: a mobile binary can be decompiled, so there is nothing to hide in `app.config.ts`. The only real secret in this epic (the EAS CI token) lives in GitHub Actions secrets and is wired in MOB-08.

Future stories will add committed Supabase credentials (MOB-03) and the API URL (MOB-05) into the same variant map in `app.config.ts`.

## EAS build commands per profile

Authenticate first (`eas whoami` — must be in `sams-team` org):

```bash
eas login          # if not already logged in
eas whoami         # confirm sams-team org
```

Then build:

```bash
# iOS simulator dev-client build (developmentClient: true, simulator: true)
eas build --profile development --platform ios

# Internal-distribution simulator-capable build
eas build --profile preview --platform ios

# Store-oriented build (not wired for TestFlight/store submit yet)
eas build --profile production --platform ios
```

Notes:
- `development` and `preview` target the iOS simulator.
- There is no Apple Developer Program enrollment yet, so device distribution, TestFlight, and store submission are not wired up.
- All builds run on EAS cloud (no local Xcode required for building).

## Local development

```bash
npm install
npx expo start           # starts Metro; opens Expo Go or a dev-client if installed
```

Use `npx expo start --ios` to open directly in the iOS simulator.

## Verification (DCEAS-05)

1. **TypeScript** — run from this directory:

   ```bash
   npx tsc --noEmit
   ```

   Expected: 2 pre-existing NativeWind/CSS errors (`animated-icon.module.css`, `@/global.css`). These are owned by MOB-02 and are unrelated to the config work. No other errors should appear.

2. **Dev-client simulator build** — trigger the development profile:

   ```bash
   eas build --profile development --platform ios
   ```

   When the build completes, download the `.app` artifact, then install and launch it:

   ```bash
   # Install on the booted simulator
   xcrun simctl install booted /path/to/Greeklish.app

   # Launch
   xcrun simctl launch booted eu.greeklish.app.dev
   ```

   Expected: app boots showing the Greeklish (Dev) name, and the Expo dev menu appears on Cmd+D. Requires an iOS simulator runtime installed locally (`xcode-select --install` + Xcode Simulator runtimes).
