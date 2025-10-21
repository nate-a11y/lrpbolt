import { describe, it, expect } from "vitest";

import { normalizeRide, normalizeRideArray } from "../../src/utils/normalizeRide.js";

describe("normalizeRide", () => {
  it("should handle null/undefined input", () => {
    expect(normalizeRide(null)).toMatchObject({
      id: null,
      tripId: null,
      status: "queued",
    });
    expect(normalizeRide(undefined)).toMatchObject({
      id: null,
      tripId: null,
      status: "queued",
    });
  });

  it("should normalize basic ride data", () => {
    const ride = {
      id: "ride123",
      tripId: "trip456",
      pickupTime: new Date("2024-01-15T10:00:00Z"),
      rideType: "standard",
      vehicle: "sedan",
      status: "pending",
    };

    const result = normalizeRide(ride);

    expect(result).toMatchObject({
      id: "ride123",
      tripId: "trip456",
      pickupTime: expect.any(Date),
      rideType: "standard",
      vehicle: "sedan",
      status: "pending",
    });
  });

  it("should resolve legacy aliases for tripId", () => {
    expect(normalizeRide({ tripID: "abc" })).toMatchObject({ tripId: "abc" });
    expect(normalizeRide({ rideId: "def" })).toMatchObject({ tripId: "def" });
    expect(normalizeRide({ trip: "ghi" })).toMatchObject({ tripId: "ghi" });
  });

  it("should resolve legacy aliases for pickupTime", () => {
    const date = new Date("2024-01-15T10:00:00Z");
    expect(normalizeRide({ pickupAt: date })).toMatchObject({
      pickupTime: date,
    });
    expect(normalizeRide({ pickup: date })).toMatchObject({
      pickupTime: date,
    });
  });

  it("should convert Firestore Timestamp to Date", () => {
    const firestoreTimestamp = {
      toDate: () => new Date("2024-01-15T10:00:00Z"),
    };

    const result = normalizeRide({
      pickupTime: firestoreTimestamp,
    });

    expect(result.pickupTime).toBeInstanceOf(Date);
    expect(result.pickupTime?.toISOString()).toBe("2024-01-15T10:00:00.000Z");
  });

  it("should handle Firestore document snapshots", () => {
    const snapshot = {
      id: "snap123",
      data: () => ({
        tripId: "trip789",
        status: "active",
      }),
    };

    const result = normalizeRide(snapshot);

    expect(result).toMatchObject({
      id: "snap123",
      tripId: "trip789",
      status: "active",
    });
  });

  it("should extract claimedBy ID from various formats", () => {
    expect(normalizeRide({ claimedBy: "user123" })).toMatchObject({
      claimedBy: "user123",
    });
    expect(normalizeRide({ ClaimedBy: "user456" })).toMatchObject({
      claimedBy: "user456",
    });
    expect(normalizeRide({ claimed_by: "user789" })).toMatchObject({
      claimedBy: "user789",
    });
    expect(
      normalizeRide({ claimedBy: { id: "user999" } }),
    ).toMatchObject({
      claimedBy: "user999",
    });
  });

  it("should extract claimedByName from various formats", () => {
    expect(normalizeRide({ claimedByName: "John Doe" })).toMatchObject({
      claimedByName: "John Doe",
    });
    expect(normalizeRide({ ClaimedByName: "Jane Smith" })).toMatchObject({
      claimedByName: "Jane Smith",
    });
    expect(
      normalizeRide({
        claimedBy: { displayName: "Alice Johnson" },
      }),
    ).toMatchObject({
      claimedByName: "Alice Johnson",
    });
  });

  it("should build name from firstName and lastName", () => {
    const result = normalizeRide({
      claimedBy: { firstName: "Bob", lastName: "Wilson" },
    });

    expect(result.claimedByName).toBe("Bob Wilson");
  });

  it("should handle nested ID extraction", () => {
    const result = normalizeRide({
      claimedBy: { uid: "nested-id" },
    });

    expect(result.claimedBy).toBe("nested-id");
  });

  it("should default status to queued if missing", () => {
    expect(normalizeRide({})).toMatchObject({ status: "queued" });
    expect(normalizeRide({ status: null })).toMatchObject({
      status: "queued",
    });
    expect(normalizeRide({ status: "" })).toMatchObject({
      status: "queued",
    });
  });

  it("should preserve rideDuration as number", () => {
    expect(normalizeRide({ rideDuration: 45 })).toMatchObject({
      rideDuration: 45,
    });
    expect(normalizeRide({ rideDuration: 0 })).toMatchObject({
      rideDuration: 0,
    });
    expect(normalizeRide({ rideDuration: "45" })).toMatchObject({
      rideDuration: null,
    });
  });

  it("should trim and normalize string fields", () => {
    const result = normalizeRide({
      tripId: "  abc123  ",
      vehicle: "  sedan  ",
      rideNotes: "  some notes  ",
    });

    expect(result.tripId).toBe("abc123");
    expect(result.vehicle).toBe("sedan");
    expect(result.rideNotes).toBe("some notes");
  });

  it("should convert empty strings to null", () => {
    const result = normalizeRide({
      tripId: "",
      vehicle: "   ",
      rideNotes: "",
    });

    expect(result.tripId).toBeNull();
    expect(result.vehicle).toBeNull();
    expect(result.rideNotes).toBeNull();
  });

  it("should preserve raw document data", () => {
    const raw = { tripId: "abc", custom: "field" };
    const result = normalizeRide(raw);

    expect(result._raw).toEqual(raw);
  });

  it("should handle invalid dates gracefully", () => {
    expect(normalizeRide({ pickupTime: "invalid" })).toMatchObject({
      pickupTime: null,
    });
    expect(normalizeRide({ pickupTime: {} })).toMatchObject({
      pickupTime: null,
    });
  });

  it("should handle array of IDs in claimedBy", () => {
    const result = normalizeRide({
      claimedBy: [null, "", "valid-id"],
    });

    expect(result.claimedBy).toBe("valid-id");
  });
});

describe("normalizeRideArray", () => {
  it("should normalize array of rides", () => {
    const rides = [
      { tripId: "trip1", status: "pending" },
      { tripId: "trip2", status: "active" },
    ];

    const result = normalizeRideArray(rides);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ tripId: "trip1", status: "pending" });
    expect(result[1]).toMatchObject({ tripId: "trip2", status: "active" });
  });

  it("should handle empty array", () => {
    expect(normalizeRideArray([])).toEqual([]);
  });

  it("should handle null/undefined", () => {
    expect(normalizeRideArray(null)).toEqual([]);
    expect(normalizeRideArray(undefined)).toEqual([]);
  });
});
