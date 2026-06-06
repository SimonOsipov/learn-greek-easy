# Mobile Design Tokens — NativeWind v4 Native Opacity Convention (MOB-13)

## The Defect

In NativeWind v4.2.4, using the Tailwind `/<NN>` opacity modifier on a **var-backed** colour
token (e.g. `bg-primary/50`) renders **dark (fully opaque)** on native iOS instead of the
expected translucent colour.

### Root cause

NativeWind v4 compiles `/<NN>` modifiers using CSS `color-mix(in srgb, … <NN>%, transparent)`.
On native (React Native's StyleSheet), `color-mix()` is not supported and the alpha channel is
silently dropped, leaving only the base colour at full opacity.

### Rejected alternative: `<alpha-value>`

Replacing `hsl(var(--x))` with `hsl(var(--x) / <alpha-value>)` (or the equivalent
`rgb(R G B / <alpha-value>)`) was trialled in MOB-09 (PR #555, login.tsx reference workaround).
Both forms still rendered dark on a clean cache-busted Release build. The `<alpha-value>`
substitution path is **not a viable fix** for NativeWind v4.2.4 on native.

### Deferred alternative: NativeWind upgrade

Upgrading NativeWind to a version where native `color-mix()` is supported would remove the
need for the explicit rgba workaround. This path is **deferred** pending on-device verification
that the bug is fixed in the target release. Until that verification is complete, the explicit
rgba convention below is mandatory.

---

## The Convention

> **Never use `/<NN>` on a var-backed token on native. Use an explicit `<base>-<NN>` rgba token instead.**

### Rule

- `bg-primary/50` — FORBIDDEN on native (var-backed + `/NN` → dark)
- `bg-primary-15` — REQUIRED (explicit rgba token, used without a modifier)

Explicit rgba tokens are defined in `tailwind.config.js` inside the
`MOB-13 explicit opacity tokens` block. They are **full-colour** `rgba(R,G,B,0.NN)` values,
theme-invariant (no `.dark` override), and used directly without any `/NN` suffix.

### Safe exception: element-level `opacity-NN`

Element-level `opacity-NN` (and its variant forms like `active:opacity-NN`) is **safe** and
**out of scope** for this convention. It maps to React Native's `style.opacity` — a separate
mechanism that is not affected by the `color-mix()` bug.

Examples of safe usage (not flagged by the CI guard):
- `login.tsx:387` — `opacity-50`
- `login.tsx:441` — `active:opacity-50`
- `login.tsx:455` — `active:opacity-70`
- `observability-debug.tsx:34` — `opacity-50`
- `observability-debug.tsx:50` — `active:opacity-80`

---

## Decision Record (NWOPA-02)

| Decision | Outcome |
|----------|---------|
| `/<NN>` modifier on var-backed token | **FORBIDDEN** on native — routes through `color-mix()`, renders dark |
| `<alpha-value>` substitution | **REJECTED** — MOB-09/PR #555 confirmed still dark on Release build |
| Explicit `<base>-<NN>` rgba tokens | **CANONICAL** — defined in `tailwind.config.js`, used without modifier |
| Element-level `opacity-NN` | **SAFE / OUT OF SCOPE** — RN `style.opacity`, unaffected by the bug |
| NativeWind upgrade | **DEFERRED** — pending on-device verification of the fix in a future release |

---

## Token Reference

### Var-backed tokens (unsafe with `/NN` modifier on native)

These tokens produce dark renders when combined with `/<NN>`. Use their explicit rgba
counterparts (below) for translucent surfaces.

| Token | CSS var | Notes |
|-------|---------|-------|
| `bg` | `--bg` | |
| `bg-2` | `--bg-2` | |
| `card` | `--card` | |
| `fg`, `fg2`, `fg3` | `--fg`, `--fg-2`, `--fg-3` | |
| `line`, `line-2` | `--line`, `--line-2` | |
| `primary`, `primary-2` | `--primary`, `--primary-2` | |
| `accent`, `accent-2`, `accent-3` | `--accent`, `--accent-2`, `--accent-3` | |
| `success`, `warning`, `danger` | `--success`, `--warning`, `--danger` | |
| `danger-soft`, `danger-softer` | `--danger-soft`, `--danger-softer` | |
| `popover`, `secondary`, `muted` | `--popover`, `--secondary`, `--muted` | |
| `muted-foreground` | `--muted-foreground` | |
| `border`, `border-strong`, `input`, `ring` | `--border`, `--border-strong`, `--input`, `--ring` | |
| `destructive-foreground` | `--destructive-foreground` | |
| `on-photo`, `on-photo-scrim`, `on-photo-active` | `--on-photo-fg`, `--on-photo-scrim`, `--on-photo-active-fg` | Over-photo surface |
| `badge-recommended` | `--badge-recommended` | Brand Cyprus gold |

### Explicit rgba tokens (safe — full colour, used without `/NN`)

These tokens are defined in `tailwind.config.js` inside the `MOB-13 explicit opacity tokens`
block. Use them directly without any modifier.

| Token | Value | Source HSL |
|-------|-------|-----------|
| `on-photo-10` | `rgba(255,255,255,0.10)` | `--on-photo-fg` white |
| `on-photo-14` | `rgba(255,255,255,0.14)` | |
| `on-photo-18` | `rgba(255,255,255,0.18)` | |
| `on-photo-22` | `rgba(255,255,255,0.22)` | |
| `on-photo-25` | `rgba(255,255,255,0.25)` | |
| `on-photo-55` | `rgba(255,255,255,0.55)` | |
| `on-photo-60` | `rgba(255,255,255,0.60)` | |
| `on-photo-66` | `rgba(255,255,255,0.66)` | |
| `on-photo-72` | `rgba(255,255,255,0.72)` | |
| `on-photo-78` | `rgba(255,255,255,0.78)` | |
| `on-photo-85` | `rgba(255,255,255,0.85)` | |
| `on-photo-96` | `rgba(255,255,255,0.96)` | |
| `on-photo-scrim-42` | `rgba(8,11,20,0.42)` | `--on-photo-scrim` 225 43% 5% |
| `danger-18` | `rgba(239,68,68,0.18)` | `--danger` 0 78% 58% |
| `danger-55` | `rgba(239,68,68,0.55)` | |
| `danger-70` | `rgba(239,68,68,0.70)` | |
| `badge-recommended-25` | `rgba(255,149,10,0.25)` | `--badge-recommended` 34 100% 52% |
| `primary-15` | `rgba(36,99,235,0.15)` | `--primary` 221 83% 53% (light, theme-invariant) |

---

## Do / Don't

```tsx
// WRONG — var-backed token + /NN modifier → dark on native iOS
<View className="bg-primary/50" />
<View className="bg-on-photo/10" />
<View className="border-danger/55" />

// CORRECT — explicit rgba token, no modifier
<View className="bg-primary-15" />
<View className="bg-on-photo-10" />
<View className="border-danger-55" />

// SAFE — element-level opacity is NOT affected by the bug
<View className="opacity-50" />
<View className="active:opacity-70" />
```

---

## CI Enforcement

The guard script `scripts/check-token-opacity.mjs` scans `src/**/*.{js,jsx,ts,tsx}` for
`/<NN>` modifier violations on var-backed tokens and exits 1 if any are found.

```bash
# Run locally
npm run lint:tokens

# Or directly
node scripts/check-token-opacity.mjs
```

The script runs in CI as part of the `mobile-ci` job in `.github/workflows/preview.yml`
(step: "Token opacity guard (MOB-13)"), after the Jest step.

To add a new explicit rgba token:
1. Add it to the `MOB-13 explicit opacity tokens` block in `tailwind.config.js`.
2. Update the token table in this file.
3. The guard script will automatically exclude it from the denylist (it parses `rgba(...)` vs
   `hsl(var(...))` to distinguish safe from unsafe tokens).
