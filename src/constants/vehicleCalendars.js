/* Proprietary and confidential. See LICENSE. */
export const VEHICLE_CALENDARS = {
  // Fill these with your actual calendar IDs (Settings → Integrate calendar → Calendar ID)
  // "LRP03 - Michael": "your_calendar_id_1@group.calendar.google.com",
  // "LRPSPR - Sprinter": "your_calendar_id_2@group.calendar.google.com",
};

export const getCalendarIdsForVehicles = (vehicles, fallbackPrimaryId) => {
  const ids = new Set();
  (vehicles || []).forEach((vehicle) => {
    const id = VEHICLE_CALENDARS[vehicle];
    if (id) ids.add(id);
  });
  if (!ids.size && fallbackPrimaryId) ids.add(fallbackPrimaryId);
  return Array.from(ids);
};
