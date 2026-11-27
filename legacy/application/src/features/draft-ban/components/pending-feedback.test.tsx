import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function src(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const workspace = src("src/features/draft-ban/components/draft-workspace.tsx");
const presets = src("src/features/draft-ban/components/game-preset-picker.tsx");
const rows = src("src/features/draft-ban/components/match-row-actions.tsx");

describe("draft workspace pool pending feedback (P2-1)", () => {
  it("shows an inline spinner on the acted item only", () => {
    expect(workspace).toContain("const itemPending = pendingItem === item.name");
    expect(workspace).toContain("{itemPending && (");
    expect(workspace).toContain("animate-spin");
    expect(workspace).toContain('aria-hidden />');
  });

  it("announces the in-flight pick by name (never spinner-only)", () => {
    expect(workspace).toContain("Recording ${item.name}…");
    // Untouched items keep their existing accessible names.
    expect(workspace).toContain("Select ${item.name} for ${turnName}");
  });

  it("keeps the full-pool disable while pending", () => {
    expect(workspace).toContain("disabled={taken || view.isComplete || isSideStep || pendingItem !== null || pendingOp}");
    expect(workspace).toContain("disabled={!view.canUndo || pendingOp}");
    expect(workspace).toContain("disabled={pendingOp || pendingItem !== null}");
  });

  it("does not add aria-busy to pool controls", () => {
    expect(workspace).not.toContain("aria-busy");
  });

  it("preserves async semantics (ordering, guards, refresh, errors)", () => {
    expect(workspace).toContain("expectedActionCount: match.actions.length");
    expect(workspace).toContain("router.refresh()");
    expect(workspace).toContain('role="alert"');
    expect(workspace).toContain("setPendingItem(null)");
    expect(workspace).toContain("setPendingOp(false)");
  });
});

describe("draft workspace op buttons (Undo/Finalize/Record-side/Reset)", () => {
  it("exposes Button loading on Undo, Finalize, and Reset opener", () => {
    expect(workspace).toContain("disabled={!view.canUndo || pendingOp} loading={pendingOp}");
    expect(workspace).toContain("disabled={!view.isComplete || pendingOp} loading={pendingOp}");
    expect(workspace).toContain("disabled={match.actions.length === 0 || pendingOp} loading={pendingOp}");
  });

  it("exposes loading on Record-side submit using its actual pending sources", () => {
    // Side submit runs runOp with an itemKey, so pendingItem (not pendingOp) is set.
    expect(workspace).toContain("loading={pendingOp || pendingItem !== null}");
  });

  it("exposes loading on the destructive Reset confirm without changing dialog behavior", () => {
    expect(workspace).toContain("confirmReset");
    expect(workspace).toContain("setConfirmReset(false)");
    expect(workspace).toContain("resetDraftActionsAction({ orgSlug, matchId: match.id })");
    expect(workspace.match(/variant="destructive"[\s\S]{0,120}loading=\{pendingOp\}/)).toBeTruthy();
  });
});

describe("draft preset picker + row actions (P3-1)", () => {
  it("maps loading to the correct preset and keeps the Saving label", () => {
    expect(presets).toContain("loading={pendingId === preset.id}");
    expect(presets).toContain('"Saving…"');
    expect(presets).toContain("disabled={!canCreate || pendingId !== null}");
  });

  it("maps loading to the async row actions without changing dialog flow", () => {
    expect(rows).toContain("disabled={pending} loading={pending} onClick={duplicate}");
    expect(rows).toContain("onClick={remove} loading={pending}");
    expect(rows).toContain("setConfirmDelete");
    expect(rows).toContain("router.push(");
    expect(rows).toContain('role="alert"');
  });
});

describe("sync-tool regression (splitter + roster unchanged)", () => {
  it("prize splitter calculator stays synchronous client calc", () => {
    const calc = src("src/features/prize-splitter/components/prize-splitter-calculator.tsx");
    expect(calc).not.toContain("loading={");
    expect(calc).not.toContain("useTransition");
  });

  it("roster builder output stays server-free", () => {
    const out = src("src/features/roster-builder/components/roster-output.tsx");
    expect(out).not.toMatch(/"use server"|supabase|analytics|telemetry|fetch\(/);
    expect(out).not.toContain("loading={");
  });
});
