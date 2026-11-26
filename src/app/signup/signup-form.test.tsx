import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SignupForm } from "./signup-form";
import { LoginForm } from "../login/login-form";
import { ForgotPasswordForm } from "../forgot-password/forgot-password-form";

// Forms render without a router; mock next/navigation for static render.
import { vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: () => undefined, refresh: () => undefined }),
  useSearchParams: () => ({ get: () => null }),
}));

describe("auth forms — accessible labels, requirements and states (P14-D10)", () => {
  it("signup exposes display name, email, password + confirm with visibility toggles", () => {
    const html = renderToStaticMarkup(<SignupForm />);
    expect(html).toContain('aria-label="Sign up"');
    expect(html).toContain('for="signup-name"');
    expect(html).toContain('for="signup-email"');
    expect(html).toContain('for="signup-password"');
    expect(html).toContain('for="signup-confirm"');
    expect(html).toContain("Show password");
    expect(html).toContain("At least 8 characters");
    expect(html).toContain("Create account");
  });

  it("login exposes email/password with visibility toggle and recovery link", () => {
    const html = renderToStaticMarkup(<LoginForm />);
    expect(html).toContain('aria-label="Sign in"');
    expect(html).toContain('for="login-email"');
    expect(html).toContain('for="login-password"');
    expect(html).toContain("/forgot-password");
    expect(html).toContain("Show password");
  });

  it("forgot-password exposes a labelled email field with generic copy", () => {
    const html = renderToStaticMarkup(<ForgotPasswordForm />);
    expect(html).toContain('aria-label="Forgot password"');
    expect(html).toContain('for="recovery-email"');
    expect(html).toContain("Send reset link");
  });
});
