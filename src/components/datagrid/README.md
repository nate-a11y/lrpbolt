# DataGrid Components - React 19 + MUI v8 Compatibility Guide

## Overview

This directory contains all MUI DataGrid wrapper components with comprehensive error handling, diagnostics, and React 19 compatibility fixes.

## The Problem

After upgrading to React 19.2.0 and MUI DataGrid v8.16.0, several issues emerged:
- "R.ids is not iterable" errors from malformed row selection state
- "Rendered fewer hooks than expected" errors (React 19 issue)
- Blank grids due to missing/invalid row IDs
- Context errors from v7→v8 migration artifacts

## The Solution

We've created a layered approach with multiple safety mechanisms:

### 1. **Error Boundary** (`DataGridErrorBoundary.jsx`)
- Catches ALL React errors in DataGrid components
- Provides detailed diagnostics (row count, column count, sample data)
- Shows user-friendly error UI with retry functionality
- Logs all errors with full context for debugging

### 2. **Diagnostic Wrapper** (`DiagnosticDataGrid.jsx`)
- Validates row data structure before rendering
- Validates column definitions
- Checks for missing IDs, circular references, etc.
- Shows validation warnings in development

### 3. **Safe Wrappers**
- `SafeUniversalDataGrid.jsx` - UniversalDataGrid + error boundary
- `SafeLrpDataGridPro.jsx` - LrpDataGridPro + error boundary

## Available Components

| Component | Purpose | When to Use |
|-----------|---------|-------------|
| **UniversalDataGrid** | Core grid with all fixes | Production use (most common) |
| **SafeUniversalDataGrid** | UniversalDataGrid + error boundary | When you need extra safety |
| **LrpDataGridPro** | Enhanced grid with ride-specific logic | Ride queues, claimed rides |
| **SafeLrpDataGridPro** | LrpDataGridPro + error boundary | Ride grids with extra safety |
| **DiagnosticDataGrid** | Development/debugging tool | Debugging data issues |
| **SmartAutoGrid** | Auto-generates columns from data | Quick prototyping |
| **DataGridErrorBoundary** | Error boundary only | Wrap custom grids |

## Quick Start

### Option 1: Use Safe Wrappers (Recommended)

```jsx
import { SafeUniversalDataGrid } from '@/components/datagrid';

function MyComponent() {
  const [rows, setRows] = useState([]);
  const columns = [
    { field: 'name', headerName: 'Name', width: 200 },
    { field: 'email', headerName: 'Email', width: 250 },
  ];

  return (
    <SafeUniversalDataGrid
      id="my-grid"
      rows={rows}
      columns={columns}
    />
  );
}
```

### Option 2: Use Diagnostic Grid for Debugging

```jsx
import { DiagnosticDataGrid } from '@/components/datagrid';

function MyComponent() {
  return (
    <DiagnosticDataGrid
      id="my-grid"
      rows={suspiciousData}
      columns={columns}
      enableValidation={true}
      showWarnings={true}
      onValidationError={(errors) => {
        console.error('Grid validation failed:', errors);
      }}
    />
  );
}
```

### Option 3: Manually Wrap Custom Grids

```jsx
import { DataGridPro } from '@mui/x-data-grid-pro';
import { DataGridErrorBoundary } from '@/components/datagrid';

function MyCustomGrid() {
  return (
    <DataGridErrorBoundary gridId="custom-grid" rows={rows} columns={columns}>
      <DataGridPro
        rows={rows}
        columns={columns}
        // ... custom props
      />
    </DataGridErrorBoundary>
  );
}
```

## Built-in Fixes

All grid components include these fixes automatically:

### ✅ Row ID Fallback Chain
```javascript
row?.id
  ?? row?.docId
  ?? row?._id
  ?? row?.ticketId
  ?? row?.rideId
  ?? row?.uid
  ?? generateDeterministicId(row)  // Hash function fallback
```

### ✅ Safe Row Selection Model
```javascript
// Handles: Array, Set, Map, malformed objects, null, undefined
// Always returns a valid array for MUI v8
const safeRowSelectionModel = normalizeSelection(rowSelectionModel);
```

### ✅ Cleaned Persisted State
```javascript
// Automatically removes malformed rowSelection from localStorage
// Prevents "R.ids is not iterable" errors
```

## Debugging Grid Issues

### Step 1: Check Browser Console
Look for these log entries:
- `=== DataGrid Error Boundary Caught Error ===`
- `=== DataGrid Validation Errors ===`
- `[LrpDataGridPro] Missing row id, using fallback`

### Step 2: Use DiagnosticDataGrid
Temporarily replace your grid with DiagnosticDataGrid:

```jsx
// Before
<UniversalDataGrid id="my-grid" rows={rows} columns={columns} />

// After (for debugging)
<DiagnosticDataGrid
  id="my-grid"
  rows={rows}
  columns={columns}
  enableValidation={true}
  showWarnings={true}
/>
```

This will show detailed validation errors.

### Step 3: Check Row Data Structure
Ensure your rows have at least ONE of these ID fields:
```javascript
{
  id: "unique-id",           // Preferred
  docId: "firestore-doc-id", // Firestore documents
  _id: "mongo-id",           // MongoDB documents
  ticketId: "ticket-123",    // Tickets
  rideId: "ride-456",        // Rides
  uid: "user-uid"            // Users
}
```

### Step 4: Validate Column Definitions
Ensure columns have required fields:
```javascript
[
  {
    field: 'name',      // REQUIRED
    headerName: 'Name', // REQUIRED
    width: 200,
  }
]
```

## Common Errors & Solutions

### Error: "R.ids is not iterable"
**Cause:** Malformed rowSelection in localStorage from v7→v8 migration

**Solution:** This is automatically fixed. If still occurring:
1. Clear localStorage: `localStorage.clear()`
2. Ensure you're using SafeUniversalDataGrid or UniversalDataGrid
3. Check console for validation errors

### Error: "Rendered fewer hooks than expected"
**Cause:** React 19 compatibility issue with MUI DataGrid

**Solution:**
1. Use SafeUniversalDataGrid to catch the error
2. Check if you're conditionally rendering the grid
3. Ensure hooks are always called in the same order

### Error: Blank Grid (no data showing)
**Cause:** Missing or invalid row IDs

**Solution:**
1. Use DiagnosticDataGrid to validate data
2. Check console for "Missing row id" warnings
3. Ensure rows have at least one ID field
4. Verify getRowId function returns valid values

### Error: "Could not find the Data Grid context"
**Cause:** MUI v7→v8 migration issue, bundler problems

**Solution:**
1. Clear node_modules and reinstall: `npm run deps:refresh`
2. Clear Vite cache: `rm -rf node_modules/.vite`
3. Ensure all @mui packages are v8+

## Migration Guide

### Migrating from Direct DataGridPro Usage

```jsx
// Before
import { DataGridPro } from '@mui/x-data-grid-pro';

<DataGridPro rows={rows} columns={columns} />

// After
import { SafeUniversalDataGrid } from '@/components/datagrid';

<SafeUniversalDataGrid id="my-grid" rows={rows} columns={columns} />
```

### Migrating from Legacy Components

```jsx
// Before
import LrpDataGridPro from '@/components/datagrid/LrpDataGridPro';

<LrpDataGridPro rows={rows} columns={columns} />

// After
import { SafeLrpDataGridPro } from '@/components/datagrid';

<SafeLrpDataGridPro id="my-grid" rows={rows} columns={columns} />
```

## Performance Tips

1. **Always provide an `id` prop** for state persistence
2. **Use `memo()` for custom renderCell functions**
3. **Keep row objects shallow** (avoid deep nesting)
4. **Use `getRowId`** if your data doesn't have an `id` field
5. **Enable virtualization** for large datasets (default in DataGridPro)

## Testing

To verify your grid works correctly:

```javascript
// 1. Check that rows are being displayed
expect(screen.getByRole('grid')).toBeInTheDocument();

// 2. Check that data is rendered
expect(screen.getByText('Expected Cell Value')).toBeInTheDocument();

// 3. Check that no errors are logged
expect(console.error).not.toHaveBeenCalled();
```

## Known Issues

### React 19 + MUI v8 Compatibility
- **Issue:** GridRootPropsContext re-renders on every state change
- **Status:** Known MUI issue, being tracked
- **Workaround:** Our error boundary catches these errors

### Hook Rendering Errors
- **Issue:** "Rendered fewer hooks than expected" in some scenarios
- **Status:** React 19 regression, MUI working on fix
- **Workaround:** Error boundary shows fallback UI

## Getting Help

If you're still experiencing issues:

1. **Check this README** for common solutions
2. **Use DiagnosticDataGrid** to validate your data
3. **Check browser console** for detailed error logs
4. **Look at working examples** in:
   - `src/components/TimeClock.jsx`
   - `src/components/adminTimeLog/EntriesTab.jsx`
   - `src/tickets/TicketGrid.jsx`

## References

- [MUI X v8 Migration Guide](https://mui.com/x/migration/migration-data-grid-v7/)
- [React 19 Update Blog](https://mui.com/blog/react-19-update/)
- [DataGrid Pro API Docs](https://mui.com/x/api/data-grid/data-grid-pro/)
