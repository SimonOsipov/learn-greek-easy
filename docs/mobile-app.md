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

## Supabase config & API URL — environment variables

Supabase credentials (`SUPABASE_URL` and `SUPABASE_ANON_KEY`) and the backend API base URL
(`API_URL`) are **not committed** to source. `app.config.ts` reads them from `process.env`
and exposes them via `extra`; `src/lib/config.ts` throws a descriptive error at app runtime
if any required value is missing.

### Cloud builds (EAS)

Values are **EAS environment variables** (server-side, scoped per environment). Each
`eas.json` build profile maps to an EAS environment via the `"environment"` key. The
maintainer must create them once:

```bash
eas env:create --environment development --name SUPABASE_URL --value https://nyiyljmtbnvykbpdjfjq.supabase.co --visibility sensitive
eas env:create --environment development --name SUPABASE_ANON_KEY --value <dev anon key> --visibility sensitive
eas env:create --environment development --name API_URL --value <dev backend base url> --visibility sensitive
eas env:create --environment preview --name SUPABASE_URL --value https://nyiyljmtbnvykbpdjfjq.supabase.co --visibility sensitive
eas env:create --environment preview --name SUPABASE_ANON_KEY --value <dev anon key> --visibility sensitive
eas env:create --environment preview --name API_URL --value <preview backend base url> --visibility sensitive
eas env:create --environment production --name SUPABASE_URL --value https://qduwfsuybkqsginndguz.supabase.co --visibility sensitive
eas env:create --environment production --name SUPABASE_ANON_KEY --value <prod anon key> --visibility sensitive
eas env:create --environment production --name API_URL --value <prod backend base url> --visibility sensitive
```

Environment → Supabase project mapping:
- `development` + `preview` → **DEV** Supabase project (`nyiyljmtbnvykbpdjfjq`)
- `production` → **PROD** Supabase project (`qduwfsuybkqsginndguz`)

### Local development

Create a gitignored `learn-greek-easy-mobile/.env` with the dev values:

```bash
SUPABASE_URL=https://nyiyljmtbnvykbpdjfjq.supabase.co
SUPABASE_ANON_KEY=<dev anon key>
API_URL=<dev backend base url>
```

Alternatively, run `eas env:pull --environment development` to generate it automatically.

> **Note:** `npx expo run:ios` (local dev-client builds) reads env vars only from `.env` —
> EAS cloud env vars are not available locally. The value of `API_URL` is baked into
> `app.config` `extra` at **Metro start**, so **restart Metro after changing `API_URL`**
> (a running Metro will not pick up the new value without a restart).

### CI (tsc + lint)

The `Mobile CI` tsc and lint checks do **not** need these env vars — `app.config.ts`
evaluates without side-effects when the values are `undefined`, and the accessor only
throws at app runtime.

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

> **Iterate via Metro Fast Refresh — never `--configuration Release` per change.** A Release
> rebuild is a full ~10-min native compile; Metro hot-reloads JS / NativeWind / `tailwind.config`
> changes in ~1s. Build the Debug dev-client **once** (`npx expo run:ios`), then leave Metro
> running. Reserve `Release` builds (`expo run:ios --configuration Release`, with
> `SENTRY_DISABLE_AUTO_UPLOAD=true` to skip the auth-gated source-map upload) only for final
> **unattended** screenshot capture (e.g. a headless visual-QA gate, where no dev server is wanted).
> A background job can boot its OWN simulator and capture it headlessly via
> `xcrun simctl io <udid> screenshot` — it cannot see the user's GUI-session sim (session isolation).

## Styling gotchas (NativeWind)

- **`token/NN` opacity modifiers render DARK on native.** NativeWind v4's Tailwind opacity modifier
  (`bg-foo/50`, `text-foo/72`) does **not** apply alpha on iOS for custom **var-backed** tokens
  (`hsl(var(--x))`) — it falls back to a near-black color. Full-strength `text-foo` works; only the
  `/NN` variant breaks. (RN has no `color-mix`; NativeWind #689 / react-native-css #207.) Adding
  `<alpha-value>` is **not** a reliable fix on native (verified). **Define the translucent value as
  its own full-color token** instead (e.g. `'on-photo-72': 'rgba(255,255,255,0.72)'` →
  `text-on-photo-72`). Codebase-wide migration tracked in **MOB-13**.
- **Size native-module views (`LinearGradient`, `BlurView`) with an inline `style`, not a class.**
  A NativeWind `className` (e.g. `className="absolute inset-0"`) is **not applied** to some native
  views — the view renders at zero size and silently draws nothing (this is what made the login
  scrim render as a blank/washed photo). Use `style={StyleSheet.absoluteFill}`.

## Visual QA (design fidelity)

When verifying a mobile screen against a hi-fi design handoff, **diff against the authoritative
design export** (`design_handoff_*/screenshots/*`, or the handoff mock rendered at phone size) —
never against self-generated app captures (circular → false-pass). Be strict: a hi-fi design
degraded to a "sanctioned fallback" (flat `View` instead of `BlurView`, a dropped social button, a
weak scrim) is a real fidelity miss to flag, not an acceptable shortcut. Subjective pixel fidelity
is **human-confirmed** — surface app-vs-export to the maintainer rather than self-certify.

### Capture mechanism — the `mobile-mcp` cross-platform MCP

Per-screen screenshots for the fidelity critique are captured with the
[`@mobilenext/mobile-mcp`](https://github.com/mobile-next/mobile-mcp) MCP server (Apache-2.0),
**not** `xcrun simctl io booted screenshot`. The MCP drives **both** an iOS simulator and an
Android emulator through one toolset, so the same agent captures and critiques each platform:

| Tool | Use |
|------|-----|
| `mobile_list_available_devices` | list booted iOS sims + Android emulators (merged); pick a device id |
| `mobile_launch_app` | launch `eu.greeklish.app.dev` (iOS bundle id / Android package) |
| `mobile_list_elements_on_screen` | read the accessibility/view tree to locate elements |
| `mobile_click_on_screen_at_coordinates` / `mobile_type_keys` / `mobile_swipe_on_screen` | navigate |
| `mobile_take_screenshot` / `mobile_save_screenshot` | capture each screen (save `ios-*` / `android-*`) |

It is **local only** and needs **no API keys**. Config lives in the gitignored root `.mcp.json`
(the repo is public, so it is **not** committed). Add the `mobile-mcp` server entry below, then
**reload the session** so the `mcp__mobile-mcp__*` tools load:

```jsonc
// .mcp.json  (gitignored)
"mobile-mcp": { "type": "stdio", "command": "npx", "args": ["-y", "@mobilenext/mobile-mcp@latest"], "env": {} }
```

### Per-platform prerequisites

- **iOS (ready on this machine):** Xcode + a simulator runtime (`xcodebuild -downloadPlatform iOS`),
  a booted simulator, and **WebDriverAgent** running on it — the MCP drives iOS simulators through
  WDA. Newer `mobile-mcp` bundles `mobilecli`, which can start WDA automatically; if it cannot, build
  it once from [appium/WebDriverAgent](https://github.com/appium/WebDriverAgent).
- **Android (not installed by default — multi-GB):** the Android SDK + platform-tools (`adb` on
  PATH) + the emulator + a system image + an AVD. None of this ships with Xcode. Start the emulator
  and confirm `adb devices` lists it before running the MCP. Typical one-time setup:
  ```bash
  brew install --cask android-commandlinetools   # or Android Studio
  sdkmanager "platform-tools" "emulator" "system-images;android-35;google_apis;arm64-v8a"
  avdmanager create avd -n greeklish -k "system-images;android-35;google_apis;arm64-v8a"
  emulator -avd greeklish & adb wait-for-device
  ```

### Local vs CI boundary

- **MCP = local visual-fidelity capture.** Element-aware, cross-platform, human-confirmed; **never
  runs in CI** (CI cannot host an MCP).
- **Maestro (shell) = repeatable E2E + CI gate.** The `.maestro/*.yaml` flows are the behaviour
  gate and run in the `mobile-e2e` CI job, so Maestro stays the source of truth for "the flow
  works." See [testing.md](../learn-greek-easy-mobile/docs/testing.md).

The **oracle is unchanged**: diff against the authoritative design export, never against
self-generated captures; fidelity is human-confirmed. Only the capture *mechanism* changed
(simctl → MCP).

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
