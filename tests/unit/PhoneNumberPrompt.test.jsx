import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { saveUserPhoneNumber } from "src/services/users.js";

import PhoneNumberPrompt from "../../src/components/PhoneNumberPrompt.jsx";

vi.mock("src/services/users.js", () => ({
  saveUserPhoneNumber: vi.fn(() => Promise.resolve()),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test("saves phone number", async () => {
  const onClose = vi.fn();
  render(<PhoneNumberPrompt open email="test@example.com" onClose={onClose} />);
  const input = screen.getByRole("textbox", { name: /phone/i });
  fireEvent.change(input, { target: { value: "1234567890" } });
  fireEvent.click(screen.getByText(/save/i));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(saveUserPhoneNumber).toHaveBeenCalledWith(
    "test@example.com",
    "+11234567890",
  );
});

test("rejects invalid phone number", async () => {
  render(<PhoneNumberPrompt open email="test@example.com" onClose={vi.fn()} />);
  const input = screen.getByRole("textbox", { name: /phone/i });
  fireEvent.change(input, { target: { value: "123" } });
  fireEvent.click(screen.getByText(/save/i));
  await screen.findByText("Enter phone number in +1234567890 format.");
  expect(saveUserPhoneNumber).not.toHaveBeenCalled();
});

test("shows error when email missing", async () => {
  render(<PhoneNumberPrompt open email="" onClose={vi.fn()} />);
  const input = screen.getByRole("textbox", { name: /phone/i });
  fireEvent.change(input, { target: { value: "1234567890" } });
  fireEvent.click(screen.getByText(/save/i));
  await screen.findByText(/missing user context/i);
  expect(saveUserPhoneNumber).not.toHaveBeenCalled();
});
