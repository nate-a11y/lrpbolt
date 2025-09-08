# CI install verbosity & audits

We suppress npm’s deprecation noise in CI to keep logs readable:
- CI uses `npm run ci:install` → `npm ci --no-progress --foreground-scripts=false --loglevel=error`
- Local dev stays chatty (no loglevel override in `.npmrc`).

Security:
- We use `audit-ci` instead of `npm audit` to avoid forced downgrades.
- Run `npm run audit` locally or in CI to fail on new high/critical issues.

