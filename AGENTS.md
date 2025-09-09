# LRP Driver Portal — AGENTS.md

## LRP Agent Rules (Scoped)
**Stack:** React 19 • Vite • MUI v7 • MUI X Pro v7 • Firebase v12 • dayjs (utc+tz)  
**Brand:** dark #060606, primary #4cbb17. **JS/JSX only**. Use import.meta.env.*.

### Must Do
- Theme/SX only; no ad-hoc CSS.
- Times are Firestore **Timestamp**; convert at UI edge via dayjs.tz.guess().
- MUI X Pro license: `@mui/x-license` + `setLicenseKey(import.meta.env.VITE_MUIX_LICENSE_KEY)` (called once in `src/muix-license.js`, imported by `main.jsx`).
- DataGridPro v7: use **slots** API.
  - `slots={{ toolbar: GridToolbar }}`  
  - `slotProps={{ toolbar: { showQuickFilter: true, quickFilterProps: { debounceMs: 300 } } }}`
  - `density="compact"` • **stable getRowId** • null-safe valueGetters → "N/A".
- Firestore/HTTP goes in `/src/services/*`. Implement retries as needed; log via `src/utils/logError.js`.
- Perf: memo heavy cells; `useMemo` for columns/rows; `useCallback` for handlers.
- UX: explicit loading/empty/error; disable async buttons; snackbar "Undo" on destructive/bulk actions.

### Must Not
- No TypeScript. No empty blocks. No `process.env.*`. No duplicate utils/components.

### Patterns
- **Time helpers:** `src/utils/timeUtils.js` exports `tsToDayjs`, `formatRange`, `durationHM`.
- **Grid wrapper:** prefer `src/components/datagrid/LrpGrid.jsx` to centralize defaults.
- **Claim flows:** use `src/services/claims.js` and show snackbar results with optional Undo.

### Checklists
- [ ] Builds on Node 22 (Vite).  
- [ ] Grids use v7 slots + quick filter + stable ids.  
- [ ] Time formatting is tz-aware and null-safe.  
- [ ] Async actions disable controls + show feedback.  
- [ ] Mobile layouts don’t overflow horizontally.

## File Map (References)
- `src/muix-license.js` — `@mui/x-license` key setup.  
- `src/utils/timeUtils.js` — dayjs helpers (tz, range, duration).  
- `src/utils/logError.js` — centralized logging.  
- `src/components/datagrid/LrpGrid.jsx` — DataGridPro defaults.  
- `src/services/*` — Firestore/HTTP.

## Purpose
This document describes all automation, AI agents, and external integrations that interact with the `lrpbolt` repository. It clarifies what each agent does, how it is triggered, and what parts of the project it can change.

## Agents Overview

- **Codex AI** – interactive coding assistant used by maintainers to propose code or documentation updates through pull requests. Actively used for:
  - Firestore migration scripts & schema alignment
  - Refactoring components for API changes
  - Adding admin-only tools (e.g., user management, shootout stats)
- **GitHub Actions** – CI/CD workflows for linting, testing, building, deploying, and Firebase deployment validations.
- **ESLint** – JavaScript/TypeScript linter run locally and in CI to enforce style and catch common issues.
- **Prettier** – automatic code formatter. Configured to run locally and optionally via pre-commit hooks.
- **Dependabot** – GitHub service for automated dependency updates. Recommended to be enabled now that Firebase SDK versions must stay current.
- **Security Bot** – automated security scanning (CodeQL). Suggested to configure due to sensitive data (Firebase API keys, Firestore rules).

## Permissions & Access

| Agent          | Branches                           | Files                                       | Access                                                                                  |
| -------------- | ---------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| Codex AI       | All via PRs                        | Entire repo                                 | Suggests changes that must be reviewed and merged by a maintainer.                      |
| GitHub Actions | `main` (deploy), all branches (CI) | Read-only source; writes to build artifacts | Executes workflows; deploys to Firebase Hosting & validates Firestore security rules.   |
| ESLint         | All                                | All source files                            | Read-only analysis; may modify files only when run with `--fix` by a developer.         |
| Prettier       | All                                | All source files                            | Rewrites code formatting when run locally.                                              |
| Dependabot     | `main`                             | `package.json`, `package-lock.json`         | Opens PRs for dependency upgrades (Firebase SDKs, MUI versions).                        |
| Security Bot   | `main`                             | Repository metadata                         | Creates security alerts or PRs; ensures Firebase rules do not expose sensitive data.    |

## Automation Triggers

- **Codex AI**: Triggered manually by maintainers submitting prompts (see updated Codex Prompt Library).
- **GitHub Actions**:
  - Runs on pushes to `main` and `workflow_dispatch`.
  - Validates Firebase security rules via `firebase emulators:exec`.
  - Builds and deploys to Firebase Hosting.
- **ESLint**: Runs via `npm run lint` locally or in GitHub Actions.
- **Prettier**: Executes locally or as a pre-commit hook.
- **Dependabot**: Performs scheduled checks for dependency updates.
- **Security Bot**: Runs on scheduled scans or when vulnerabilities are detected.

## Codex Prompt Library

| Use Case                      | Prompt                                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Firestore Migration           | `Update API hooks to use Firestore collections (rideQueue, claimedRides, tickets, etc.) with correct schema.` |
| Firestore Admin Tools         | `Create an admin-only tab in the portal that allows adding userAccess entries in Firestore.`               |
| Security Rule Adjustments     | `Update Firestore security rules to allow null endTime for timeLogs but still enforce type checks.`        |
| Component Refactor for API    | `Refactor TicketScanner to read/write tickets from Firestore instead of Google Sheets API.`                 |
| Deployment Validation         | `Add GitHub Action to validate Firebase rules before deploy.`                                              |

## Limitations & Warnings

- Firebase deployment requires correct Firestore security rules — GitHub Actions will block deploy if invalid.
- Prettier, Dependabot, and Security Bot are recommended for consistent formatting, dependency hygiene, and security.
- Codex AI prompts must follow the updated Firestore schema to avoid runtime write failures.
- Firestore is schemaless — schema is enforced via rules and documented in `docs/firestore-schema.md`.

## Responsive Components

- `src/hooks/useIsMobile.js` – hook providing `{ isXs, isSm, isMdDown }` for breakpoint logic.
- `src/components/responsive/ResponsiveContainer.jsx` – page wrapper enforcing mobile-first padding and max width.
- `src/components/datagrid/SmartAutoGrid.jsx` – DataGridPro wrapper with toolbar, auto-height and mobile defaults.
- `src/components/datagrid/ResponsiveScrollBox.jsx` – enables touch-friendly scrolling for grids on narrow screens.
- Layouts are standardized on MUI Grid v2 (`@mui/material/Grid`); convert legacy Grid v1 instances to `Grid2` when touched.
