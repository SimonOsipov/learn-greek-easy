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

## Not yet wired (MOB-08)

Mobile `jest` in CI, EAS preview builds + Maestro on PRs, EAS Update channels, and the
OTA-vs-native release rules are deferred to MOB-08. The `eslint.config.js` / `tsc` setup and
the ambient `globals.d.ts` CSS declaration are temporary scaffolding — NativeWind (MOB-02)
supplies its own CSS types and replaces the declaration.
