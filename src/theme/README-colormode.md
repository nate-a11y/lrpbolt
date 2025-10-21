# LRP Theme – Color Mode

* Single source of truth is **src/theme/index.js** exporting `buildTheme(mode)`.
* Do **not** reintroduce `getTheme.js` or hardcode dark-only colors in components.
* Use `theme.palette.*` tokens and `alpha(...)` with theme colors.
* If you need a one-off background or divider, derive it from `theme.palette` or `theme.vars` (MUI v7).

## Quick Checks (CI/CD)
- Search for `rgba(255,255,255` or `#060606` in component files. If found, refactor into palette tokens.
