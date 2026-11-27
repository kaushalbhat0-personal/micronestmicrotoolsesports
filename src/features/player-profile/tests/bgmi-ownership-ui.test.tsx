import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BgmiOwnershipVerificationView } from "@/app/settings/profile/_components/bgmi-ownership-verification-section";
import { PUBLIC_PROJECTION_COLUMNS } from "../domain/public-projection";
import { PLAYER_SHARE_FIELD_KEYS } from "../share/player-card-model";

const noopAction = () => undefined;

const baseProps = {
  createAction: noopAction,
  createPending: false,
  uploadAction: noopAction,
  uploadPending: false,
  submitAction: noopAction,
  submitPending: false,
  withdrawAction: noopAction,
  withdrawPending: false,
  feedback: "",
  feedbackOk: false,
  enableEvidencePreview: false,
};

const baseCase = {
  id: "a1000000-0000-4000-8000-000000000001",
  identity_mismatch: false,
  evidence_count: 1,
  submitted_at: "2026-11-28T00:00:00.000Z" as string | null,
  withdrawn_at: null as string | null,
  created_at: "2026-11-28T00:00:00.000Z",
  claimed_game_user_id: "00123456" as string | null,
  live_id_matches_claim: true as boolean | null,
  player_facing_message: null as string | null,
  decided_at: null as string | null,
};

describe("BgmiOwnershipVerificationView states", () => {
  it("State A: prompts for BGMI ID with anchor to settings", () => {
    const html = renderToStaticMarkup(
      <BgmiOwnershipVerificationView
        {...baseProps}
        gameUserId={null}
        caseStatus={null}
        evidence={[]}
      />,
    );
    expect(html).toContain("Save your BGMI Player ID");
    expect(html).toContain("#bgmi-player-id-settings");
  });

  it("State B: ready to submit when ID present and no active case", () => {
    const html = renderToStaticMarkup(
      <BgmiOwnershipVerificationView
        {...baseProps}
        gameUserId="00123456"
        caseStatus={null}
        evidence={[]}
      />,
    );
    expect(html).toContain("Start evidence submission");
  });

  it("State E: pending review", () => {
    const html = renderToStaticMarkup(
      <BgmiOwnershipVerificationView
        {...baseProps}
        gameUserId="00123456"
        caseStatus={{ ...baseCase, status: "pending_review" }}
        evidence={[]}
      />,
    );
    expect(html).toContain("Pending manual review");
  });

  it("State approved: shows reviewed wording without official endorsement", () => {
    const html = renderToStaticMarkup(
      <BgmiOwnershipVerificationView
        {...baseProps}
        gameUserId="00123456"
        caseStatus={{
          ...baseCase,
          status: "approved",
          decided_at: "2026-11-28T02:00:00.000Z",
        }}
        evidence={[]}
      />,
    );
    expect(html).toContain("BGMI ownership evidence reviewed");
    expect(html).toContain("not official BGMI endorsement");
  });

  it("State rejected: shows player-facing message only", () => {
    const html = renderToStaticMarkup(
      <BgmiOwnershipVerificationView
        {...baseProps}
        gameUserId="00123456"
        caseStatus={{
          ...baseCase,
          status: "rejected",
          player_facing_message: "Please resubmit with a clearer Player ID screenshot.",
          decided_at: "2026-11-28T02:00:00.000Z",
        }}
        evidence={[]}
      />,
    );
    expect(html).toContain("Please resubmit with a clearer Player ID screenshot.");
    expect(html).not.toContain("internal");
  });

  it("State G: id mismatch", () => {
    const html = renderToStaticMarkup(
      <BgmiOwnershipVerificationView
        {...baseProps}
        gameUserId="99999999"
        caseStatus={{
          ...baseCase,
          status: "id_mismatch",
          identity_mismatch: true,
          live_id_matches_claim: false,
        }}
        evidence={[]}
      />,
    );
    expect(html).toContain("cannot be approved");
  });
});

describe("projection freeze regression", () => {
  it("keeps ownership fields off public projection and share kit", () => {
    expect(PUBLIC_PROJECTION_COLUMNS).toHaveLength(12);
    expect(PUBLIC_PROJECTION_COLUMNS).not.toContain("claimed_game_user_id");
    expect(PLAYER_SHARE_FIELD_KEYS).not.toContain("storage_path");
  });
});
