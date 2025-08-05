# Agents

## Purpose

This document describes all automation and AI agents that interact with the `lrpbolt` repository. It clarifies what each agent does, how it is triggered, and what parts of the project it can change.

## Agents Overview

- **Codex AI** – interactive coding assistant used by maintainers to propose code or documentation updates through pull requests.
- **GitHub Actions** – CI/CD workflows for linting, testing, building, and deploying the application.
- **ESLint** – JavaScript/TypeScript linter run locally and in CI to enforce style and catch common issues.
- **Prettier** – automatic code formatter. Not currently configured but recommended for consistent styling.
- **Dependabot** – GitHub service for automated dependency updates. Not yet enabled in this repository.
- **Security Bot** – automated security scanning (e.g., CodeQL). Not configured at this time.

## Permissions & Access

| Agent          | Branches                           | Files                                       | Access                                                                          |
| -------------- | ---------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------- |
| Codex AI       | All via PRs                        | Entire repo                                 | Suggests changes that must be reviewed and merged by a maintainer.              |
| GitHub Actions | `main` (deploy), all branches (CI) | Read-only source; writes to build artifacts | Executes workflows; does not commit code.                                       |
| ESLint         | All                                | All source files                            | Read-only analysis; may modify files only when run with `--fix` by a developer. |
| Prettier       | All                                | All source files                            | Rewrites code formatting when run locally.                                      |
| Dependabot     | `main`                             | `package.json`, `package-lock.json`         | Opens PRs for dependency upgrades when enabled.                                 |
| Security Bot   | `main`                             | Repository metadata                         | Creates security alerts or PRs; no direct commits.                              |

## Automation Triggers

- **Codex AI**: Triggered manually by maintainers submitting prompts or tasks.
- **GitHub Actions**: Runs on pushes to `main` and on manual `workflow_dispatch` events.
- **ESLint**: Runs via `npm run lint` locally or within GitHub Actions.
- **Prettier**: Executes when manually run or configured as a pre-commit hook.
- **Dependabot**: Performs scheduled checks for dependency updates (once configured).
- **Security Bot**: Runs on scheduled security scans or when new vulnerabilities are detected (once configured).

## Codex Prompt Library

| Use Case                  | Prompt                                                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Layout fixes              | `Refine component layout using MUI Grid and spacing utilities so elements are aligned and responsive.`                 |
| Performance refactors     | `Refactor components to minimize unnecessary re-renders using React.memo, useMemo, and useCallback where appropriate.` |
| Add Ride screen alignment | `Align the Add Ride screen so form fields remain centered and consistent on both desktop and mobile.`                  |

## Limitations & Warnings

- GitHub Actions deployment requires `vite.config.js` to have `base: './'`; otherwise the deploy step fails.
- Prettier, Dependabot, and security scanning are not yet configured; enable them to benefit from automation.
- Automated formatting or fixes can introduce large diffs. Review changes carefully before merging.
- Codex AI suggestions may not always follow project conventions; maintainers should verify all generated code.
- ESLint may flag style issues that Prettier would handle automatically. Combining the two is recommended.
