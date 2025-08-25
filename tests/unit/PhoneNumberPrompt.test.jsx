import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import PhoneNumberPrompt from "../../src/components/PhoneNumberPrompt.jsx";

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => "docRef"),
  setDoc: vi.fn(() => Promise.resolve()),
}));
vi.mock("src/utils/firebaseInit", () => ({ db: {} }));

import { setDoc } from "firebase/firestore";

test("saves phone number", async () => {
  const onClose = vi.fn();
  render(<PhoneNumberPrompt open email="test@example.com" onClose={onClose} />);
  const input = screen.getByRole("textbox", { name: /phone/i });
  fireEvent.change(input, { target: { value: "1234567890" } });
  fireEvent.click(screen.getByText(/save/i));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(setDoc).toHaveBeenCalledWith(
    "docRef",
    { phone: "1234567890" },
    { merge: true },
  );
});
