// P13-A F-02 reviewed-snapshot tests (static SQL + binding logic).
// Covers: hash determinism properties, version bump, validator clauses,
// decision CHECK, published_at exclusion rationale. Static + simulated only.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isApprovalBindingValid,
  requiredApprovalFor,
} from "../domain/approval";
import { stripSqlComments } from "./sql";

const MIG_DIR = path.join(process.cwd(), "supabase/migrations");
const SNAPSHOT = readFileSync(path.join(MIG_DIR, "20261113000004_p13_f02_snapshot.sql"), "utf8");
const ACTIVATION = readFileSync(path.join(MIG_DIR, "20261113000005_p13_activation.sql"), "utf8");
const SNAP_BODY = stripSqlComments(SNAPSHOT);
const ACT_BODY = stripSqlComments(ACTIVATION);

describe("snapshot schema (static)", () => {
  it("adds a version column without touching the P3 projection", () => {
    expect(SNAPSHOT).toContain("add column if not exists submission_version int not null default 0");
    expect(SNAPSHOT).not.toMatch(/create or replace function public\.(search_|get_)/i);
  });

  it("hashes all 19 reviewed content fields deterministically", () => {
    expect(SNAP_BODY).toContain("immutable");
    expect(SNAP_BODY).toContain("set search_path = ''");
    expect(SNAP_BODY).toContain("extensions.digest");
    expect(SNAP_BODY).toContain("'sha256'");
    // Timezone-independent instants (never raw ::text on timestamptz).
    expect(SNAPSHOT).toContain("at time zone 'UTC'");
    // published_at is freeze-protected, not snapshot-hashed (set at publish).
    expect(SNAP_BODY).not.toContain("p_published_at");
    // NULL-safe separators (no ambiguous concatenation).
    expect(SNAPSHOT).toContain("\\x1F");
  });

  it("binds decisions to snapshots with a CHECK (hash+version rules)", () => {
    expect(SNAPSHOT).toContain("moderation_decisions_snapshot_binding_check");
    expect(SNAPSHOT).toContain("char_length(content_hash) = 64");
  });

  it("validator re-checks reviewer, version, hash, and membership at transition time", () => {
    expect(SNAP_BODY).toContain("security definer");
    expect(SNAP_BODY).toContain("d.decision = p_decision");
    expect(SNAP_BODY).toContain("d.submission_version = p_version");
    expect(SNAP_BODY).toContain("d.content_hash = p_hash");
    expect(SNAP_BODY).toContain("au.status = 'active'");
    expect(SNAP_BODY).toContain("organizer_members");
    expect(SNAP_BODY).not.toContain("p_reviewer");
  });

  it("activation bumps the version on submit and enforces the validator", () => {
    expect(ACT_BODY).toContain("NEW.submission_version := OLD.submission_version + 1");
    expect(ACT_BODY).toContain("tournament_content_hash(NEW.title");
    expect(ACT_BODY).toContain("tournament_review_approval_valid(NEW.id, 'publish'");
    expect(ACT_BODY).toContain("tournament_review_approval_valid(NEW.id, 'republish'");
    expect(ACT_BODY).toContain("tournament_review_approval_valid(NEW.id, 'return_to_draft'");
    expect(ACT_BODY).toContain("tournament_review_approval_valid(NEW.id, 'archive'");
  });

  it("preserves P9 unpublish behavior exactly (no decision required)", () => {
    const branch = ACT_BODY.match(/OLD\.lifecycle = 'published' and NEW\.lifecycle = 'unpublished'[^]*?return NEW;/)?.[0] ?? "";
    expect(branch).not.toContain("tournament_review_approval_valid");
    expect(branch).toContain("return NEW;");
  });
});

describe("approval binding logic (simulated)", () => {
  const publishReq = requiredApprovalFor("submitted", "published");
  const returnReq = requiredApprovalFor("submitted", "draft");

  it("maps every moderator transition to its decision, hash-bound where content matters", () => {
    expect(publishReq).toEqual({ decision: "publish", needsHash: true });
    expect(requiredApprovalFor("unpublished", "published")).toEqual({
      decision: "republish",
      needsHash: true,
    });
    expect(returnReq).toEqual({ decision: "return_to_draft", needsHash: false });
    // The review vocabulary models archive from unpublished; the validator is
    // decision-type-based, so a moderator archive decision also authorizes a
    // published row (D-08). The mapping stays informational — SQL governs.
    expect(requiredApprovalFor("unpublished", "archived")).toEqual({
      decision: "archive",
      needsHash: false,
    });
    // No decision authorizes a direct bypass.
    expect(requiredApprovalFor("draft", "published")).toBeNull();
  });

  it("accepts a fully valid binding", () => {
    expect(
      isApprovalBindingValid(
        publishReq!,
        {
          decision: "publish",
          submissionVersion: 3,
          contentHash: "abc",
          reviewerActiveModerator: true,
          reviewerOrganizerMember: false,
        },
        3,
        "abc"
      )
    ).toBe(true);
  });

  it("rejects stale replay (version mismatch)", () => {
    expect(
      isApprovalBindingValid(
        publishReq!,
        {
          decision: "publish",
          submissionVersion: 2,
          contentHash: "abc",
          reviewerActiveModerator: true,
          reviewerOrganizerMember: false,
        },
        3,
        "abc"
      )
    ).toBe(false);
  });

  it("rejects concurrent-edit divergence (hash mismatch on hash-bound types)", () => {
    expect(
      isApprovalBindingValid(
        publishReq!,
        {
          decision: "publish",
          submissionVersion: 3,
          contentHash: "old",
          reviewerActiveModerator: true,
          reviewerOrganizerMember: false,
        },
        3,
        "new"
      )
    ).toBe(false);
  });

  it("rejects wrong-type decisions (publish approval cannot return, return cannot publish)", () => {
    const binding = {
      decision: "return_to_draft" as const,
      submissionVersion: 3,
      contentHash: null,
      reviewerActiveModerator: true,
      reviewerOrganizerMember: false,
    };
    expect(isApprovalBindingValid(publishReq!, binding, 3, "abc")).toBe(false);
    expect(isApprovalBindingValid(returnReq!, binding, 3, "abc")).toBe(true);
  });

  it("rejects inactive reviewers and organizer-member reviewers", () => {
    const base = {
      decision: "publish" as const,
      submissionVersion: 3,
      contentHash: "abc",
      reviewerActiveModerator: true,
      reviewerOrganizerMember: false,
    };
    expect(isApprovalBindingValid(publishReq!, { ...base, reviewerActiveModerator: false }, 3, "abc")).toBe(false);
    expect(isApprovalBindingValid(publishReq!, { ...base, reviewerOrganizerMember: true }, 3, "abc")).toBe(false);
  });
});
