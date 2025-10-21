import React, { useMemo, useState } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";

import useFirestoreListener from "../../src/hooks/useFirestoreListener.js";

// Mock firebase/firestore
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  onSnapshot: vi.fn(() => vi.fn()),
  orderBy: vi.fn(() => ({})),
}));

// Mock auth context and firebase init
const authMock = { user: {}, authLoading: false };
vi.mock("../../src/context/AuthContext.jsx", () => ({
  useAuth: () => authMock,
}));
vi.mock("src/utils/firebaseInit", () => ({ db: {} }));

afterEach(() => {
  vi.clearAllMocks();
});

function TestComponent({ mockOrderBy }) {
  const [count, setCount] = useState(0);
  const rideQuery = useMemo(
    () => [mockOrderBy("pickupTime", "asc")],
    [mockOrderBy],
  );
  useFirestoreListener("liveRides", rideQuery);
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}

describe("useFirestoreListener", () => {
  it("subscribes only once when query constraints are memoized", async () => {
    const { onSnapshot, orderBy } = await import("firebase/firestore");
    const { getByText } = render(<TestComponent mockOrderBy={orderBy} />);
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    fireEvent.click(getByText("0"));
    expect(onSnapshot).toHaveBeenCalledTimes(1);
  });
});
