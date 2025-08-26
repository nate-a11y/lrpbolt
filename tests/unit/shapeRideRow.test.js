import { Timestamp } from "firebase/firestore";

import { shapeRideRow } from "../../src/services/shapeRideRow.js";

describe("shapeRideRow", () => {
  it("handles legacy PickupTime and RideDuration fields", () => {
    const ts = Timestamp.fromDate(new Date("2024-01-01T00:00:00Z"));
    const doc = { id: "1", data: () => ({ PickupTime: ts, RideDuration: 90 }) };
    const row = shapeRideRow(doc);
    expect(row.pickupTime).toEqual(ts);
    expect(row.rideDuration).toBe(90);
    expect(row.pickupDateStr).not.toBe("N/A");
    expect(row.pickupTimeStr).not.toBe("N/A");
    expect(row.rideDurationStr).toBe("01:30");
  });
});
