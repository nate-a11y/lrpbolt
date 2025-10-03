/* Proprietary and confidential. See LICENSE. */
// src/utils/csvTemplates.js

export const rideCsvTemplateHeaders = [
  "passengerName",
  "phone",
  "pickupTime",
  "pickupAddress",
  "dropoffAddress",
  "vehicle",
  "notes",
  "rideType",
  "durationMinutes",
  "tripId",
];

const sampleRow = {
  passengerName: "ABCD-12",
  phone: "555-0100",
  pickupTime: "2025-05-15T08:00:00",
  pickupAddress: "123 Main St",
  dropoffAddress: "456 Oak Ave",
  vehicle: "Sedan",
  notes: "Sample note",
  rideType: "Standard",
  durationMinutes: 45,
  tripId: "ABCD-12",
};

export function getRideTemplateCsv() {
  const header = rideCsvTemplateHeaders.join(",");
  const row = rideCsvTemplateHeaders
    .map((key) => {
      const value = sampleRow[key];
      if (value === undefined || value === null) return "";
      const str = String(value).replace(/"/g, '""');
      return str.includes(",") ? `"${str}"` : str;
    })
    .join(",");
  return `${header}
${row}
`;
}
