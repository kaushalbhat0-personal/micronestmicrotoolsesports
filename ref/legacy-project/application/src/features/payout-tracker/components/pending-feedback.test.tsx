import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function src(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const manager = src("src/features/payout-tracker/components/recipient-manager.tsx");
const detail = src("src/features/payout-tracker/components/tracker-detail.tsx");

describe("payout recipient actions (P2-2)", () => {
  it("shows loading on the correct row for toggle, remove, and save", () => {
    // busyId is row-scoped: toggle, remove, and save each bind loading to
    // their own row id — exactly three row-level bindings plus the "new" one.
    expect(manager.match(/loading=\{busyId === r\.id\}/g)).toHaveLength(3);
    expect(manager).toContain("disabled={busyId === r.id}");
  });

  it("shows loading on add recipient with the new-item discriminator", () => {
    expect(manager).toContain('loading={busyId === "new"}');
    expect(manager).toContain('disabled={busyId === "new"}');
  });

  it("preserves scoped disabling, confirms, errors, and refresh", () => {
    expect(manager).toContain("setBusyId(null)");
    expect(manager).toContain("window.confirm(`Remove ${recipient.recipient_name}");
    expect(manager).toContain('role="alert"');
    expect(manager).toContain("router.refresh()");
    expect(manager).not.toContain("aria-busy");
  });
});

describe("payout tracker detail actions", () => {
  it("shows loading on revoke, save-meta, and delete with exact busy values", () => {
    expect(detail).toContain('loading={busy === "revoke"}');
    expect(detail).toContain('loading={busy === "meta"}');
    expect(detail).toContain('loading={busy === "delete"}');
  });

  it("keeps publish loading and existing guards/semantics", () => {
    expect(detail).toContain('loading={busy === "publish"}');
    expect(detail).toContain("window.confirm(");
    expect(detail).toContain('role="alert"');
    expect(detail).toContain('role="status"');
    expect(detail).toContain("router.push(");
  });
});

describe("conformant-surface regression (sentinel + tie-breaker + claim + button unchanged)", () => {
  it("sponsor sentinel reference pattern is intact", () => {
    const check = src("src/features/sponsor-sentinel/components/check-now-button.tsx");
    expect(check).toContain("aria-busy={pending}");
    expect(check).toContain("loading={pending}");
    expect(check).toContain("useTransition");
    expect(check).toContain('"Checking…"');
  });

  it("tie-breaker lock stays conformant and untouched", () => {
    const lock = src("src/features/tie-breaker/components/lock-dialog.tsx");
    expect(lock).toContain("loading={locking}");
    expect(lock).not.toContain("aria-busy");
  });

  it("ClaimCard shared claim pattern is intact", () => {
    const card = src("src/components/freemium/claim-card.tsx");
    expect(card).toContain("loading={loading}");
    expect(card).toContain("aria-busy={loading}");
    expect(card).toContain('role="alert"');
    expect(card).toContain('role="status"');
  });

  it("Button primitive is byte-identical in behavior contract", () => {
    const button = src("src/components/ui/button.tsx");
    expect(button).toContain("disabled={disabled || loading}");
    expect(button).toContain("animate-spin");
    expect(button).toContain("active:translate-y-px");
    expect(button).not.toContain("aria-busy");
  });
});
