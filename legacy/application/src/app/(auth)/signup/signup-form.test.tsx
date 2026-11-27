// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { SignupForm } from "./signup-form";

// Enable React act() in the jsdom environment.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Signup confirmation resend (RCCF F7). Interaction-level coverage with a
 * mocked Supabase client — no network, no real emails.
 */

const mockSignUp = vi.fn();
const mockResend = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signUp: mockSignUp, resend: mockResend } }),
}));

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function renderSignedUp(email = "new-user@example.com") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<SignupForm plan={null} />);
  });
  const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
  const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
  await act(async () => {
    setInputValue(emailInput, email);
    setInputValue(passwordInput, "valid-pass-123");
  });
  const submit = container.querySelector('button[type="submit"]') as HTMLButtonElement;
  await act(async () => {
    submit.click();
  });
  return { container, root };
}

beforeEach(() => {
  document.body.innerHTML = "";
  mockSignUp.mockReset();
  mockResend.mockReset();
  mockSignUp.mockResolvedValue({ data: {}, error: null });
  mockResend.mockResolvedValue({ data: {}, error: null });
});

describe("SignupForm confirmation resend (RCCF F7)", () => {
  it("shows wait guidance plus spam hint after signup", async () => {
    const { container, root } = await renderSignedUp();
    expect(mockSignUp).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Check your email to confirm your account");
    expect(container.textContent).toContain("spam or junk folder");
    expect(container.textContent).toContain("Resend confirmation email");
    root.unmount();
  });

  it("resends once, then cools down with neutral status", async () => {
    const { container, root } = await renderSignedUp();
    const resend = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Resend confirmation email")
    ) as HTMLButtonElement;
    await act(async () => {
      resend.click();
    });
    expect(mockResend).toHaveBeenCalledTimes(1);
    expect(mockResend).toHaveBeenCalledWith({ type: "signup", email: "new-user@example.com" });
    // Cooldown: disabled with countdown, neutral status visible.
    const updated = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Resend email (")
    ) as HTMLButtonElement;
    expect(updated.disabled).toBe(true);
    expect(container.textContent).toContain("a new email is on its way");
    // Second click during cooldown never re-fires (abuse friction).
    await act(async () => {
      updated.click();
    });
    expect(mockResend).toHaveBeenCalledTimes(1);
    root.unmount();
  });

  it("stays neutral when resend fails (no account oracle)", async () => {
    mockResend.mockRejectedValue(new Error("rate limited"));
    const { container, root } = await renderSignedUp();
    const resend = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Resend confirmation email")
    ) as HTMLButtonElement;
    await act(async () => {
      resend.click();
    });
    // Same neutral message as success — nothing reveals account state.
    expect(container.textContent).toContain("a new email is on its way");
    expect(container.textContent).not.toContain("rate limited");
    root.unmount();
  });
});
