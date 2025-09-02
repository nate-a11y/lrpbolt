# LRP Driver Portal

React 18 + Vite application using Material UI v7 and MUI X Pro (DataGridPro, Date/Time Pickers). The codebase is JavaScript-only and optimized for mobile-first layouts.

## Responsive Utilities

- `src/hooks/useIsMobile.js` – breakpoint helpers.
- `src/components/responsive/ResponsiveContainer.jsx` – page wrapper with adaptive padding.
- `src/components/datagrid/SmartAutoGrid.jsx` – responsive DataGridPro wrapper with toolbar and auto-height.
- `src/components/datagrid/ResponsiveScrollBox.jsx` – touch-friendly scroll container for grids.

## Development

```bash
npm install
npm run dev
```

Run checks locally:

```bash
npm run lint
npm run format
npm run test
```

## Running Tests

Run unit tests with:

```bash
npm test
```

## Firebase Setup

Authorized Domains: In the Firebase Console → Authentication → Sign-in Method → Authorized Domains, add:

- localhost (for development)
- lakeridepros.xyz (production)

Persistence: We use browserLocalPersistence so redirect sign-in survives full reloads.

## Environment Setup

This project requires **Node.js 22** or later. If you're using [nvm](https://github.com/nvm-sh/nvm), run `nvm install 22`.

On some systems `npm` warns about an unknown `http-proxy` environment
variable. To avoid this warning, unset `HTTP_PROXY` and `http_proxy` and
set the recognized `npm_config_proxy` and `npm_config_https_proxy` variables:

```bash
unset HTTP_PROXY http_proxy
export npm_config_proxy="http://proxy:8080"
export npm_config_https_proxy="http://proxy:8080"
```

## License

This project is provided under a proprietary license; no use is permitted. See the [LICENSE](LICENSE) file for details.

## Move Queue → Live Function

Trigger the Cloud Function manually with `curl`:

```bash
curl -X POST "$VITE_DROP_DAILY_URL" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true, "limit": 10}'
```

Expected response:

```json
{ "ok": true, "dryRun": true, "moved": 0, "skipped": 0, "durationMs": 0 }
```

### Deploying

1. Enable required services:
   ```bash
   gcloud services enable cloudscheduler.googleapis.com pubsub.googleapis.com
   ```
2. Deploy functions:
   ```bash
   firebase deploy --only functions
   ```
3. Verify a scheduled trigger for 6:00 PM America/Chicago exists in Cloud Console.
4. Configure `.env` with `VITE_DROP_DAILY_URL` (and optional `VITE_LRP_ADMIN_TOKEN`), rebuild and redeploy the web app.
5. Use the “Move Queue → Live” button and confirm a success snackbar and no CORS errors.

### Clearing Service Worker Cache

After deploying a new build, open your browser DevTools and navigate to **Application → Service Workers**. Unregister old service workers and perform a hard refresh to clear cached assets.

## ✅ Production Checklist

Before committing or deploying, run:

```bash
npm run verify:prod     # lint + format:check + tests + build
npm run audit           # check for security vulnerabilities
npm run deps:check      # see if dependencies are outdated
npm run deps:unused     # detect unused dependencies
npm run env:sync        # ensure .env.sample is up to date
```

Pre-commit and pre-push hooks (via Husky) run automatically to keep code clean.
