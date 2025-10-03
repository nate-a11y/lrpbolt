# Phase 7 Audit Log

## Observability Bootstrap
- `src/services/observability.js` added with Sentry initialization that short-circuits when `VITE_SENTRY_DSN` is absent or init already ran. Release defaults to `VITE_RELEASE` or injected `__APP_VERSION__`; environment defaults to `import.meta.env.VITE_ENV || "dev"`.
- `src/main.jsx` guards startup with `window.__LRP_OBS__` to keep init idempotent, defers to `Promise.resolve(initSentry())`, then records a structured `app_start` event.
- `vite.config.js` injects `__APP_VERSION__` at build time via `define` using `package.json` version.

## Diagnostics Surface
- Diagnostics panel component lives at `src/components/DiagnosticsPanel.jsx` with SW/FCM/Firestore/version probes, refresh + grid debug toggles. Errors route through `captureError`; noisy logs use `logEvent`.
- Rendered on the profile settings screen (`src/pages/Profile/Settings.jsx`) for admins (or when `diag.panel` flag enabled) under notification settings.

## Feature Flags
- `diag.panel` (default true) controls diagnostics panel visibility and can be overridden via env or `localStorage`.
- `grid.debug` (default false) toggled from the panel to enable verbose grid logging downstream.

## Logging Updates
- Structured logging helpers used for diagnostics refresh + grid debug toggles; Sentry integration breadcrumbs added for `logEvent`. LocalStorage failures during flag reads/writes are reported in non-prod builds to avoid silent failures.

## Agents Guidance
- `src/agents/agents.json` now instructs repo-doctor to route errors through `captureError` and gate noisy logs behind feature flags, and UI polish to surface DiagnosticsPanel in admin/settings areas.
