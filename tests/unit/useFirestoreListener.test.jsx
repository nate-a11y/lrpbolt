import React, { useMemo, useState } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import useFirestoreListener from "../../src/hooks/useFirestoreListener.js";
import { orderBy } from "firebase/firestore";

// Mock firebase/firestore
var onSnapshotMock;
vi.mock("firebase/firestore", () => {
  onSnapshotMock = vi.fn(() => vi.fn());
  return {
    collection: vi.fn(() => ({})),
    query: vi.fn(() => ({})),
    onSnapshot: onSnapshotMock,
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
  onSnapshotMock.mockClear();
});

function TestComponent() {
  const [count, setCount] = useState(0);
  const rideQuery = useMemo(() => [orderBy("pickupTime", "asc")], []);
  useFirestoreListener("liveRides", rideQuery);
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}

describe("useFirestoreListener", () => {
  it("subscribes only once when query constraints are memoized", () => {
    const { getByText } = render(<TestComponent />);
    expect(onSnapshotMock).toHaveBeenCalledTimes(1);
    fireEvent.click(getByText("0"));
    expect(onSnapshotMock).toHaveBeenCalledTimes(1);
  });
});
