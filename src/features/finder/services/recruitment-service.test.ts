import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createRecruitmentPostForCaptain,
  setRecruitmentPostStatus,
  updateRecruitmentPostForCaptain,
} from "./recruitment-service";
import {
  createRecruitmentPost,
  findRecruitmentPostById,
  updateRecruitmentPost,
  type FinderRecruitmentPostRow,
} from "../repositories/finder";
import { assertTeamCaptain } from "./team-service";

vi.mock("../repositories/finder", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../repositories/finder")>();
  return {
    ...actual,
    createRecruitmentPost: vi.fn(),
    findRecruitmentPostById: vi.fn(),
    updateRecruitmentPost: vi.fn(),
  };
});

vi.mock("./team-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./team-service")>();
  return { ...actual, assertTeamCaptain: vi.fn() };
});

const client = {} as unknown as SupabaseClient;

function postRow(overrides: Partial<FinderRecruitmentPostRow> = {}): FinderRecruitmentPostRow {
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
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    created_by: "user-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const validCreate = {
  team_id: "00000000-0000-4000-8000-000000000001",
  game: "bgmi" as const,
  role_needed: "Scout" as const,
  slots: 2,
  current_level_min: "community" as const,
  target_level: "competitive" as const,
  region: "IN-North",
  availability_required: [],
  tryout_required: true,
  status: "open" as const,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("recruitment-service", () => {
  it("requires captain authority to create (no client team_id trust)", async () => {
    vi.mocked(assertTeamCaptain).mockRejectedValue(
      Object.assign(new Error("Only the team captain can do this."), {
        code: "FORBIDDEN",
      }),
    );
    await expect(createRecruitmentPostForCaptain(client, "user-2", validCreate)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(createRecruitmentPost).not.toHaveBeenCalled();
  });

  it("derives created_by from the session", async () => {
    vi.mocked(assertTeamCaptain).mockResolvedValue(undefined as never);
    vi.mocked(createRecruitmentPost).mockResolvedValue(postRow());
    await createRecruitmentPostForCaptain(client, "user-1", validCreate);
    expect(createRecruitmentPost).toHaveBeenCalledWith(
      client,
      "user-1",
      expect.objectContaining({
        team_id: "00000000-0000-4000-8000-000000000001",
        role_needed: "Scout",
        slots: 2,
      }),
    );
    const patch = vi.mocked(createRecruitmentPost).mock.calls[0]?.[2] ?? {};
    expect(patch).not.toHaveProperty("created_by");
  });

  it("rejects out-of-range slots at the application layer", async () => {
    vi.mocked(assertTeamCaptain).mockResolvedValue(undefined as never);
    await expect(
      createRecruitmentPostForCaptain(client, "user-1", { ...validCreate, slots: 11 }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(createRecruitmentPost).not.toHaveBeenCalled();
  });

  it("returns not-found when updating an unknown post", async () => {
    vi.mocked(findRecruitmentPostById).mockResolvedValue(null);
    await expect(
      updateRecruitmentPostForCaptain(client, "user-1", "missing", {
        role_needed: "Scout",
        slots: 1,
        current_level_min: "community",
        target_level: "competitive",
        region: "IN-North",
        availability_required: [],
        tryout_required: true,
        status: "paused",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("supports pause/close/fill status transitions", async () => {
    vi.mocked(findRecruitmentPostById).mockResolvedValue(postRow());
    vi.mocked(assertTeamCaptain).mockResolvedValue(undefined as never);
    vi.mocked(updateRecruitmentPost).mockResolvedValue(postRow({ status: "paused" }));
    const paused = await setRecruitmentPostStatus(client, "user-1", "post-1", "paused");
    expect(paused.status).toBe("paused");
    expect(updateRecruitmentPost).toHaveBeenCalledWith(
      client,
      "post-1",
      expect.objectContaining({ status: "paused" }),
    );
  });
});
