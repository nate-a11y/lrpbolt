# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ["./tsconfig.node.json", "./tsconfig.app.json"],
      tsconfigRootDir: import.meta.dirname,
    },
  },
});
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    "react-x": reactX,
    "react-dom": reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs["recommended-typescript"].rules,
    ...reactDom.configs.recommended.rules,
  },
});
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
