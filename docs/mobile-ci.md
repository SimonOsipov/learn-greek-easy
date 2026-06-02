# Mobile CI/CD — Pipeline Split

Mobile CI is **separated from the web pipeline** by path (story MOB-01a). A
`dorny/paths-filter` job in `preview.yml` (and `deploy-production.yml`) classifies each
change as `mobile` (`learn-greek-easy-mobile/**`) and/or `web` (anything else).

## Behavior

- **Mobile-only PR** → runs only the `Mobile CI (tsc + lint)` job (`npx tsc --noEmit`
  + `expo lint`). The web test suite and the web preview deployment are **skipped**.
- **Web PR** → runs the full web suite unchanged. A PR touching both runs both.
- **Mobile-only merge to `main`** → the backend/frontend production deploy is **skipped**
  (there is no mobile deploy yet — EAS Update lands in MOB-08).

## CI Gate (required check)

The single required status check is **`CI Gate`** — an always-running aggregator job that
passes iff each pipeline that *should* run (web and/or mobile, on a non-draft PR) succeeded.
It replaces the web-only `CI Tests / Frontend tsc -b` so mobile-only PRs aren't blocked by a
web check that never runs (a reusable-workflow job that is gated off does not report its
child check contexts, which would otherwise block branch protection indefinitely).

## Branch protection (one-time, owner-only)

Make `CI Gate` the required check and drop `Frontend tsc -b`:

```bash
gh api -X PATCH repos/SimonOsipov/learn-greek-easy/branches/main/protection/required_status_checks \
  -F 'strict=true' -f 'checks[][context]=CI Gate'
```

(Or GitHub → Settings → Branches → `main` → Require status checks → add **CI Gate**,
remove **Frontend tsc -b**.) Do this after `CI Gate` first reports green on the PR and
before merging, so mobile-only PRs stay mergeable.

## EAS authentication — EXPO_TOKEN

`EXPO_TOKEN` is a GitHub Actions **repository** secret (Settings → Secrets and variables →
Actions → Repository secrets). It holds an Expo access token scoped to the `@sams-team` org
and the `greeklish-app` project. Use a robot/org token rather than a personal full-access
token (least-privilege principle).

**Consumed by two workflows** — referenced only as `${{ secrets.EXPO_TOKEN }}`; the value is
never echoed or logged:

- `deploy-production.yml` — the `mobile-ota` job (`eas update --branch production ...`)
- `mobile-native-build.yml` — the on-demand job (`eas build --local ...`)

The repo is public, so the token value must never be committed, printed, or pasted anywhere in
code, docs, or comments.

**Creating the token:** tokens must be minted in the Expo dashboard (Account/Org → Access
Tokens) — there is no CLI command to create them. Create the token there first, then add it to
GitHub:

```bash
gh secret set EXPO_TOKEN --repo SimonOsipov/learn-greek-easy
# paste the token value at the prompt — do NOT use -b "value" on the command line
```

**Rotation:** revoke the old token in the Expo dashboard (Account/Org → Access Tokens), create
a new one with the same scope, then re-run the `gh secret set` command above. No code change
is needed — both consuming workflows read the secret by name at runtime.

## Mobile delivery — OTA vs native

Not every change needs a full App Store / TestFlight release. The decision rule:

| Change type | Delivery path |
|-------------|---------------|
| JS / TS / asset-only (no native modules, no SDK bump, no config-plugin change) | **OTA update** — `eas update` ships automatically via the `mobile-ota` job in `deploy-production.yml` on merge to `main`. No store review required. |
| New native module, Expo SDK bump, config-plugin change, or anything that bumps `runtimeVersion` | **Native build required** — trigger the on-demand `mobile-native-build.yml` workflow; eventual store release is required. |

### runtimeVersion semantics

The `runtimeVersion` policy is `appVersion` (tied to the native binary's `version` field in
`app.config.ts`). An OTA update is only delivered to installed builds whose `runtimeVersion`
matches the update's. This is the safety boundary: if a change requires a new binary at a
bumped version it can never be delivered over OTA to the existing binary — the runtimes won't
match.

**When OTA is NOT safe:** any change that touches native code, adds a native module, bumps the
Expo SDK, or modifies a config plugin will change the `runtimeVersion`. Those changes must go
through a native rebuild; publishing them as OTA will result in the update being silently
ignored by all installed builds.

### Channels

Two EAS channels exist, each linked to a same-named branch:

| Channel | Branch | Purpose |
|---------|--------|----------|
| `production` | `production` | What merge-to-`main` publishes to (live users) |
| `preview` | `preview` | Preview / internal distribution environment |

Authentication for both OTA and native-build workflows uses the `EXPO_TOKEN` secret — see
[§ EAS authentication — EXPO_TOKEN](#eas-authentication--expo_token) above.

### Triggering an on-demand native build

Two ways to trigger `mobile-native-build.yml`:

1. **Label on a PR:** add the `needs-native-build` label — the workflow runs automatically.
2. **Manual dispatch:** GitHub → Actions → "Mobile Native Build (on-demand)" →
   Run workflow (or `gh workflow run mobile-native-build.yml`).

The workflow runs `eas build --local --profile development --platform ios` on `macos-latest`
and executes the Maestro smoke flow against the resulting build.

## Scaffolding note

The `eslint.config.js` / `tsc` setup and the ambient `globals.d.ts` CSS declaration are
temporary scaffolding — NativeWind (MOB-02) supplies its own CSS types and replaces the
declaration.
