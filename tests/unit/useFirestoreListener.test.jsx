import React, { useMemo, useState } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { orderBy } from "firebase/firestore";

import useFirestoreListener from "../../src/hooks/useFirestoreListener.js";

// Mock firebase/firestore
// Note: Must create the mock function inside the factory to avoid hoisting issues
vi.mock("firebase/firestore", () => {
  const mockOnSnapshot = vi.fn(() => vi.fn());
  return {
    collection: vi.fn(() => ({})),
    query: vi.fn(() => ({})),
    onSnapshot: mockOnSnapshot,
    orderBy: vi.fn(() => ({})),
  };
});

// Mock auth context and firebase init
const authMock = { user: {}, authLoading: false };
vi.mock("../../src/context/AuthContext.jsx", () => ({
  useAuth: () => authMock,
}));
vi.mock("src/utils/firebaseInit", () => ({ db: {} }));

afterEach(() => {
  vi.clearAllMocks();
});

function TestComponent() {
  const [count, setCount] = useState(0);
  const rideQuery = useMemo(() => [orderBy("pickupTime", "asc")], []);
  useFirestoreListener("liveRides", rideQuery);
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}

describe("useFirestoreListener", () => {
  it("subscribes only once when query constraints are memoized", async () => {
    const { onSnapshot } = await import("firebase/firestore");
    const { getByText } = render(<TestComponent />);
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    fireEvent.click(getByText("0"));
    expect(onSnapshot).toHaveBeenCalledTimes(1);
  });
});
