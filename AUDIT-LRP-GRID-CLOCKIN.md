# AUDIT — Grid & Time Clock Fixes (2025-02-14)

## Files Updated
- `src/components/datagrid/LrpDataGridPro.jsx`
  - Removed automatic valueGetter injection. Added optional `naFallback` handling and debug logging hook. Hardened `getRowId` fallback.
- `src/services/fs/index.js`
  - Ensured snapshot mappers emit Firestore `doc.id` as `row.id` while preserving legacy ids. Confirmed `logTime` writes to `timeLogs` and returns the created doc id.
- `src/components/Tickets.jsx`
  - Added per-column `naFallback` usage and grid debug logging hook.
- `src/components/LiveRidesGrid.jsx`
  - Added temporary grid debug logging hook for diagnostics.

## Verification Notes
- Grid wrapper now leaves author-defined value getters intact; columns opt into "N/A" formatting via `naFallback`.
- Firestore rows consistently expose `row.id = doc.id`; legacy identifiers retained under `logicalId`.
- `fs.logTime()` persists entries to `timeLogs` with retries and returns the document id.
- Debug logging gated behind `observability.getFlag("grid.debug")`.

## Manual QA Checklist
1. Tickets grid renders live Firestore data (no blanket "N/A" rows).
2. Admin time log grids show live timestamps with correct ids and editing works.
3. Time Clock "Clock In" creates a new `timeLogs` document (`doc.id` visible in Firestore console).
4. Editing or ending a time log continues to function now that ids align with doc ids.
5. Columns requiring "N/A" opt-in define `naFallback: true` explicitly.
