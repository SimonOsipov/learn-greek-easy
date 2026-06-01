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

   To install a finished cloud build on a booted simulator without rebuilding:

   ```bash
   eas build:run -p ios --id <build-id>
   ```

   **First verified dev-client build:** [`81fbd3cf`](https://expo.dev/accounts/sams-team/projects/greeklish-app/builds/81fbd3cf-a886-40c3-98c2-7d8e109b6688) — booted on the iOS 26.4 simulator with a working Expo dev menu.

## CI / CD (mobile vs web split)

Mobile CI is **separated from the web pipeline** by path (MOB-01a). A `dorny/paths-filter`
job classifies each change as `mobile` (`learn-greek-easy-mobile/**`) and/or `web`
(anything else):

- **Mobile-only PR** → runs only the `Mobile CI (tsc + lint)` job (`npx tsc --noEmit`
  + `expo lint`). The web test suite and the web preview deployment are **skipped**.
- **Web PR** → runs the full web suite unchanged. A PR touching both runs both.
- **Mobile-only merge to `main`** → the backend/frontend production deploy is **skipped**
  (there is no mobile deploy yet — EAS Update lands in MOB-08).

The single required status check is **`CI Gate`** — an always-running aggregator that
passes iff each pipeline that *should* run (web and/or mobile) succeeded. This replaces
the web-only `CI Tests / Frontend tsc -b` so mobile-only PRs aren't blocked by a web
check that never runs.

**Branch protection (one-time, owner-only):** make `CI Gate` the required check and drop
`Frontend tsc -b`:

```bash
gh api -X PATCH repos/SimonOsipov/learn-greek-easy/branches/main/protection/required_status_checks \
  -F 'strict=true' -f 'checks[][context]=CI Gate'
```

(Or GitHub → Settings → Branches → `main` → Require status checks → add **CI Gate**,
remove **Frontend tsc -b**.) Do this after `CI Gate` first reports green on the PR and
before merging, so mobile-only PRs stay mergeable.

> Not yet wired (MOB-08): mobile `jest` in CI, EAS preview builds + Maestro on PRs, EAS
> Update channels, and the OTA-vs-native release rules. `expo lint`/`tsc` config and the
> ambient `globals.d.ts` CSS declaration are temporary scaffolding — NativeWind (MOB-02)
> supplies its own CSS types.
