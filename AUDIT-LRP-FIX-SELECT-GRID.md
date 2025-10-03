# Audit — LRP Fix Select/Grid

## Dropdown Fix
- Converted Ride Entry form selects to MUI `TextField` selects with `displayEmpty`, MenuItem placeholders, and consistent helper text so labels and placeholders no longer overlap.

## Daily Drop Placement
- Moved the admin-only Daily Drop accordion outside the Multi-Ride tab so it is rendered below the tab content for all tabs.

## Grid Data Mapping
- Updated the DataGrid wrapper to avoid forcing "N/A" and use a stable row-id fallback.
- Normalized ride snapshots now merge raw data with coerced fields and provide trip/pickup fallbacks.
- Ride Queue, Live Rides, and Claimed grids use explicit value getters/formatters so real values appear instead of blanket "N/A".
