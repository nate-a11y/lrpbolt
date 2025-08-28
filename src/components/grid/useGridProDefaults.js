export function useGridProDefaults() {
  // Keep this intentionally light; DO NOT add valueFormatter here.
  const defaultColDef = {
    flex: 1,
    minWidth: 120,
    sortable: true,
    filterable: true,
    resizable: true,
  };
  return { defaultColDef };
}

export default useGridProDefaults;
