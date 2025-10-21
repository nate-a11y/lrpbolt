# LRP Driver Portal

React 18 + Vite application using Material UI v7 and MUI X Pro (DataGridPro, Date/Time Pickers). The codebase is JavaScript-only and optimized for mobile-first layouts.

## Responsive Utilities

- `src/hooks/useIsMobile.js` – breakpoint helpers.
- `src/components/responsive/ResponsiveContainer.jsx` – page wrapper with adaptive padding.
- `src/components/datagrid/SmartAutoGrid.jsx` – responsive DataGridPro wrapper with toolbar and auto-height.
- `src/components/datagrid/ResponsiveScrollBox.jsx` – touch-friendly scroll container for grids.

## State Management Architecture

This application uses **React Context** for global state management, with module-level caching for performance-critical data.

### Context Providers

The app uses multiple context providers for different concerns:

| Context | Location | Purpose |
|---------|----------|---------|
| **AuthContext** | `src/context/AuthContext.jsx` | Firebase authentication state, user profile |
| **ColorModeContext** | `src/context/ColorModeContext.jsx` | Light/dark theme preference (persisted to localStorage) |
| **DriverContext** | `src/context/DriverContext.jsx` | Selected driver for admin actions |
| **ActiveClockContext** | `src/context/ActiveClockContext.jsx` | Time clock session tracking |
| **NotificationsProvider** | `src/context/NotificationsProvider.jsx` | Push notification permissions and FCM tokens |
| **SnackbarProvider** | `src/context/SnackbarProvider.jsx` | Toast notifications for user feedback |

### Provider Hierarchy

Contexts are composed in `src/App.jsx`:

```jsx
<AuthProvider>
  <ColorModeProvider>
    <NotificationsProvider>
      <DriverProvider>
        <ActiveClockProvider>
          <SnackbarProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </SnackbarProvider>
        </ActiveClockProvider>
      </DriverProvider>
    </NotificationsProvider>
  </ColorModeProvider>
</AuthProvider>
```

### Module-Level Cache Pattern

For performance-critical data (ride collections), we use **module-level caching** with a listener registry pattern:

**Location**: `src/hooks/useRides.js`

**How it works**:
1. Module maintains a cache object and listener set outside React
2. Firebase subscriptions are shared across all components
3. Changes notify all registered listeners
4. Automatically cleans up when no components are subscribed

**Example**:
```jsx
const { rides, loading, error } = useRides('rideQueue');
```

**Trade-offs**:
- ✅ **Pros**: Excellent performance, prevents duplicate Firebase listeners
- ⚠️ **Cons**: Non-standard React pattern, harder to test, couples state to module scope

**Recommendation**: Consider migrating to **Zustand** or **Context** for better React patterns while maintaining performance.

### Custom Hooks

The app includes 25+ custom hooks for reusable logic:

**Data Fetching**:
- `useRides()` – Real-time ride data with caching
- `useFirestoreListener()` – Generic Firestore subscription hook
- `useUserAccessDrivers()` – Fetch available drivers for admin

**Authentication**:
- `useAuth()` – Access current user and auth state
- `useRole()` – Get user role (driver, admin, shootout)

**UI State**:
- `useIsMobile()` – Responsive breakpoint detection
- `useClaimSelection()` – Form state for ride claiming
- `useActiveClockSession()` – Current time clock session

**Device APIs**:
- `useWakeLock()` – Keep screen awake during active sessions
- `useGameSound()` – Audio playback for notifications

### Best Practices

#### ✅ DO

- Use Context for global state (auth, theme, notifications)
- Use local `useState` for component-specific UI state
- Use `useCallback` and `useMemo` for expensive operations
- Implement proper cleanup in `useEffect` (return cleanup function)

#### ❌ DON'T

- Don't create new contexts unnecessarily
- Don't put rapidly-changing state in Context (causes re-renders)
- Don't forget dependency arrays in `useEffect`
- Don't access module-level state directly; use the provided hooks

### State Update Patterns

**Context updates**:
```jsx
// AuthContext example
const { user, loading } = useAuth();

// Internal: Updates trigger re-render for all consumers
const updateUser = (newUser) => {
  setUser(newUser);
};
```

**Module-level updates**:
```jsx
// useRides example
const { rides, loading } = useRides('rideQueue');

// Internal: Notifies all registered listeners
listeners.forEach(listener => listener(newRides));
```

### Migration Path

For long-term maintainability, consider:

1. **Phase 1**: Consolidate multiple contexts into a single app context
2. **Phase 2**: Migrate `useRides` module cache to Context or Zustand
3. **Phase 3**: Add TypeScript for better type safety
4. **Phase 4**: Implement React Query for server state management

### Testing State

**Context testing**:
```jsx
import { render } from '@testing-library/react';
import { AuthProvider } from './context/AuthContext';

const wrapper = ({ children }) => (
  <AuthProvider>{children}</AuthProvider>
);

render(<MyComponent />, { wrapper });
```

**Module-level state testing**:
- Mock Firebase subscriptions with MSW (see `tests/unit/useFirestoreListener.test.jsx`)
- Reset module cache between tests with `vi.clearAllMocks()`

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
