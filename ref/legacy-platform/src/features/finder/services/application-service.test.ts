import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyToPost,
  decideApplicationAsCaptain,
  withdrawMyApplication,
} from "./application-service";
import {
  createApplication,
  decideApplication,
  findApplicationById,
  findRecruitmentPostById,
  insertTeamMember,
  withdrawApplication,
  type FinderApplicationRow,
} from "../repositories/finder";
import { assertTeamCaptain } from "./team-service";

vi.mock("../repositories/finder", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../repositories/finder")>();
  return {
    ...actual,
    createApplication: vi.fn(),
    decideApplication: vi.fn(),
    findApplicationById: vi.fn(),
    findRecruitmentPostById: vi.fn(),
    insertTeamMember: vi.fn(),
    withdrawApplication: vi.fn(),
  };
});

vi.mock("./team-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./team-service")>();
  return { ...actual, assertTeamCaptain: vi.fn() };
});

const client = {} as unknown as SupabaseClient;
const future = new Date(Date.now() + 86400000).toISOString();

function openPost() {
  return {
    id: "post-1",
    team_id: "team-1",
    game: "bgmi",
    role_needed: "Scout",
    slots: 1,
    current_level_min: "community",
    target_level: "competitive",
    region: "IN-North",
    availability_required: [],
    experience_min: null,
    tryout_required: true,
    status: "open",
    expires_at: future,
    created_by: "user-1",
    created_at: future,
    updated_at: future,
  };
}

function applicationRow(overrides: Partial<FinderApplicationRow> = {}): FinderApplicationRow {
  return {
    id: "app-1",
    post_id: "post-1",
    applicant_user_id: "user-2",
    note: null,
    status: "applied",
    decided_by: null,
    created_at: future,
    decided_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("application-service — apply", () => {
  it("creates an application on an open post", async () => {
    vi.mocked(findRecruitmentPostById).mockResolvedValue(openPost());
    vi.mocked(createApplication).mockResolvedValue(applicationRow());
    const application = await applyToPost(client, "user-2", {
      post_id: "00000000-0000-4000-8000-000000000001",
    });
    expect(application.status).toBe("applied");
    expect(createApplication).toHaveBeenCalledWith(
      client,
      "user-2",
      expect.objectContaining({ post_id: "00000000-0000-4000-8000-000000000001" }),
    );
  });

  it("refuses closed, paused, or expired posts", async () => {
    const postId = "00000000-0000-4000-8000-000000000001";
    vi.mocked(findRecruitmentPostById).mockResolvedValue({ ...openPost(), status: "paused" });
    await expect(applyToPost(client, "user-2", { post_id: postId })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    vi.mocked(findRecruitmentPostById).mockResolvedValue({
      ...openPost(),
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    await expect(applyToPost(client, "user-2", { post_id: postId })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(createApplication).not.toHaveBeenCalled();
  });

  it("maps duplicate active applications to a safe conflict", async () => {
    vi.mocked(findRecruitmentPostById).mockResolvedValue(openPost());
    vi.mocked(createApplication).mockRejectedValue({
      code: "23505",
      message: 'duplicate key value violates unique constraint "finder_applications_active_unique"',
    });
    await expect(
      applyToPost(client, "user-2", {
        post_id: "00000000-0000-4000-8000-000000000001",
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});

describe("application-service — withdraw", () => {
  it("lets players withdraw their own active application", async () => {
    vi.mocked(findApplicationById).mockResolvedValue(applicationRow());
    vi.mocked(withdrawApplication).mockResolvedValue(applicationRow({ status: "withdrawn" }));
    const withdrawn = await withdrawMyApplication(client, "user-2", "app-1");
    expect(withdrawn.status).toBe("withdrawn");
  });

  it("blocks withdrawing another player's application", async () => {
    vi.mocked(findApplicationById).mockResolvedValue(applicationRow());
    await expect(withdrawMyApplication(client, "user-3", "app-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(withdrawApplication).not.toHaveBeenCalled();
  });

  it("blocks withdrawing decided applications", async () => {
    vi.mocked(findApplicationById).mockResolvedValue(applicationRow({ status: "accepted" }));
    await expect(withdrawMyApplication(client, "user-2", "app-1")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});

describe("application-service — captain decisions", () => {
  it("requires captain authority (cross-team isolation)", async () => {
    vi.mocked(findApplicationById).mockResolvedValue(applicationRow());
    vi.mocked(findRecruitmentPostById).mockResolvedValue(openPost());
    vi.mocked(assertTeamCaptain).mockRejectedValue(
      Object.assign(new Error("Only the team captain can do this."), { code: "FORBIDDEN" }),
    );
    await expect(
      decideApplicationAsCaptain(client, "user-3", "app-1", "accepted"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(decideApplication).not.toHaveBeenCalled();
  });

  it("accepting adds roster membership; existing members do not break acceptance", async () => {
    vi.mocked(findApplicationById).mockResolvedValue(applicationRow());
    vi.mocked(findRecruitmentPostById).mockResolvedValue(openPost());
    vi.mocked(assertTeamCaptain).mockResolvedValue(undefined as never);
    vi.mocked(decideApplication).mockResolvedValue(applicationRow({ status: "accepted" }));
    vi.mocked(insertTeamMember).mockRejectedValue({ code: "23505", message: "duplicate" });
    const decided = await decideApplicationAsCaptain(client, "user-1", "app-1", "accepted");
    expect(decided.status).toBe("accepted");
    expect(insertTeamMember).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ team_id: "team-1", user_id: "user-2", role: "player" }),
    );
  });

  it("shortlist does not touch the roster", async () => {
    vi.mocked(findApplicationById).mockResolvedValue(applicationRow());
    vi.mocked(findRecruitmentPostById).mockResolvedValue(openPost());
    vi.mocked(assertTeamCaptain).mockResolvedValue(undefined as never);
    vi.mocked(decideApplication).mockResolvedValue(applicationRow({ status: "shortlisted" }));
    await decideApplicationAsCaptain(client, "user-1", "app-1", "shortlisted");
    expect(insertTeamMember).not.toHaveBeenCalled();
  });
});
