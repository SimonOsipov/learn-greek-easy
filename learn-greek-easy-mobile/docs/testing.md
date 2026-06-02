# Mobile Testing

This document covers the testing setup for the Greeklish mobile app: unit and component
tests (Jest + React Native Testing Library) and the Maestro E2E smoke flow.

---

## Test layers

| Layer | Tool | Command |
|-------|------|---------|
| Unit | Jest (`jest-expo` preset) | `npm test` |
| Component | React Native Testing Library | `npm test` |
| E2E smoke | Maestro | `maestro test .maestro/smoke.yaml` |

---

## Unit and component tests

### Running tests

From the `learn-greek-easy-mobile/` directory:

```bash
npm test              # run all suites once
npm run test:watch    # watch mode (re-runs on file changes)
```

### Stack

- **Jest** with the `jest-expo` preset — provides the React Native runtime transformer,
  environment shims, and auto-mocks for native modules (e.g. `expo-modules-core`,
  `@react-native-async-storage/async-storage`).
- **`@testing-library/react-native`** — RNTL — for rendering components and asserting
  on the accessibility tree.

### Path alias

The `@/` path alias (maps to `src/`) is wired via `jest.config.js` `moduleNameMapper`:

```js
moduleNameMapper: {
  '^@/assets/(.*)$': '<rootDir>/assets/$1',
  '^@/(.*)$': '<rootDir>/src/$1',
},
```

`jest-expo` does **not** read `tsconfig.json` paths, so the mapper is required and must be
kept in sync with any new aliases added to `tsconfig.json`.

### Why Jest, not Vitest

The web app uses Vitest with `jsdom`. React Native code cannot run under `jsdom` — it
requires the RN-specific transforms and native shims that `jest-expo` provides. Using Jest
here is intentional, not an oversight.

### Current suites

| File | What it covers |
|------|----------------|
| `src/lib/analytics/__tests__/scrub.test.ts` | `scrubPii` — PII scrubbing unit logic |
| `src/components/__tests__/themed-text.test.tsx` | `ThemedText` — RNTL render + snapshot |

---

## Maestro smoke flow

### Prerequisites

1. **Maestro CLI** installed on your machine:
   [https://docs.maestro.dev/getting-started/installing-maestro](https://docs.maestro.dev/getting-started/installing-maestro)

2. A **dev-client build** (`APP_VARIANT=development`, bundle id `eu.greeklish.app.dev`)
   installed on a booted iOS simulator. Build and install steps are in
   [docs/mobile-app.md](../../docs/mobile-app.md) (MOB-01 instructions).

### Running the flow

From the repo root (or the `learn-greek-easy-mobile/` directory):

```bash
maestro test .maestro/smoke.yaml
```

### What the flow does

1. **Launches the app** (`eu.greeklish.app.dev`) with a clean state.
2. **Asserts** the signed-out entry screen is visible:
   - `"Welcome back"` (heading)
   - `"Sign in"` (button label / accessibilityLabel)

The entry point is always the login screen because auth navigation is owned by MOB-03
and the app always starts signed-out in a clean-state run.

> **Note on selectors:** Maestro has no `label:` selector. A React Native
> `accessibilityLabel` is surfaced through Maestro's standard text matcher, so `"Sign in"`
> is asserted as text — this is correct behaviour, not a workaround.

### E2E philosophy

The smoke flow is **small and critical-path only**: launch → login screen. It mirrors the
web Playwright suite's philosophy of gating on the entry path rather than covering every
user journey. Visual regression (Sherlo/Storybook) is deferred by product decision.

---

## CI status

Unit/component tests and the Maestro smoke flow run **locally only** at this stage.
Wiring them into CI and EAS (automated Maestro on PRs, EAS Update channels, OTA release
rules) is owned by **MOB-08**. See [docs/mobile-ci.md](../../docs/mobile-ci.md) §"Not yet
wired (MOB-08)" for the full list of deferred CI work.
