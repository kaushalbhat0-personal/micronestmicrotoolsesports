"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { COMPETITIVE_LEVELS } from "@/features/finder/domain/levels";
import { BGMI_ROLES } from "@/features/finder/domain/roles";
import type { FinderRecruitmentPostRow } from "@/features/finder/repositories/finder";
import { createPostAction, updatePostAction } from "./actions";

const selectClass =
  "flex h-11 w-full rounded-[12px] border border-input bg-card px-3 text-sm text-foreground";
const checkboxClass = "h-5 w-5 accent-current";
const hintClass = "text-xs leading-relaxed text-muted-foreground";

const AVAILABILITY_OPTIONS = [
  "weekday-evenings",
  "weekend-afternoons",
  "weekend-evenings",
  "late-night",
  "flexible",
];

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Captain recruitment post create/edit form (Phase C). */
export function PostForm({
  teamId,
  post,
}: {
  teamId: string;
  post: FinderRecruitmentPostRow | null;
}) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [availability, setAvailability] = useState<string[]>(
    post?.availability_required ?? [],
  );

  function toggleAvailability(value: string) {
    setAvailability((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setResult(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      ...(post ? {} : { team_id: teamId, game: "bgmi" as const }),
      role_needed: String(form.get("role_needed") ?? ""),
      slots: Number(form.get("slots") ?? 1),
      current_level_min: String(form.get("current_level_min") ?? ""),
      target_level: String(form.get("target_level") ?? ""),
      region: String(form.get("region") ?? ""),
      availability_required: availability,
      experience_min: emptyToUndefined(String(form.get("experience_min") ?? "")),
      tryout_required: form.get("tryout_required") === "on",
      status: post ? String(form.get("status") ?? post.status) : "open",
      expires_at: emptyToUndefined(String(form.get("expires_at") ?? "")),
    };
    const outcome = post
      ? await updatePostAction(post.id, payload)
      : await createPostAction(payload);
    setResult(outcome);
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{post ? "Edit opening" : "Post an opening"}</CardTitle>
          <CardDescription>
            {post
              ? "Update the role, level window, or status."
              : "Describe exactly who you need. Openings expire after 30 days by default."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={post ? `role_needed-${post.id}` : "role_needed"}>
                Role needed (BGMI)
              </Label>
              <select
                id={post ? `role_needed-${post.id}` : "role_needed"}
                name="role_needed"
                defaultValue={post?.role_needed ?? "Assaulter"}
                className={selectClass}
              >
                {BGMI_ROLES.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor={post ? `slots-${post.id}` : "slots"}>Slots</Label>
              <Input
                id={post ? `slots-${post.id}` : "slots"}
                name="slots"
                type="number"
                min={1}
                max={10}
                defaultValue={post?.slots ?? 1}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={post ? `current_level_min-${post.id}` : "current_level_min"}>
                Minimum current level
              </Label>
              <select
                id={post ? `current_level_min-${post.id}` : "current_level_min"}
                name="current_level_min"
                defaultValue={post?.current_level_min ?? "casual"}
                className={selectClass}
              >
                {COMPETITIVE_LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor={post ? `target_level-${post.id}` : "target_level"}>
                Target level
              </Label>
              <select
                id={post ? `target_level-${post.id}` : "target_level"}
                name="target_level"
                defaultValue={post?.target_level ?? "community"}
                className={selectClass}
              >
                {COMPETITIVE_LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor={post ? `region-${post.id}` : "region"}>Region</Label>
            <Input
              id={post ? `region-${post.id}` : "region"}
              name="region"
              defaultValue={post?.region ?? ""}
              required
              maxLength={40}
              placeholder="e.g. IN-North"
            />
          </div>
          <fieldset>
            <legend className="text-[13px] font-medium">Availability required</legend>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {AVAILABILITY_OPTIONS.map((slot) => (
                <label key={slot} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={availability.includes(slot)}
                    onChange={() => toggleAvailability(slot)}
                    className={checkboxClass}
                  />
                  {slot}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <Label htmlFor={post ? `experience_min-${post.id}` : "experience_min"}>
              Experience requirement (optional)
            </Label>
            <Input
              id={post ? `experience_min-${post.id}` : "experience_min"}
              name="experience_min"
              defaultValue={post?.experience_min ?? ""}
              maxLength={120}
              placeholder="e.g. 1 season of competitive scrims"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {post && (
              <div>
                <Label htmlFor={`status-${post.id}`}>Status</Label>
                <select
                  id={`status-${post.id}`}
                  name="status"
                  defaultValue={post.status}
                  className={selectClass}
                >
                  {(["open", "paused", "closed", "filled"] as const).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <Label htmlFor={post ? `expires_at-${post.id}` : "expires_at"}>
                Expiry (optional)
              </Label>
              <Input
                id={post ? `expires_at-${post.id}` : "expires_at"}
                name="expires_at"
                type="datetime-local"
                defaultValue={post?.expires_at ? post.expires_at.slice(0, 16) : ""}
              />
              <p className={hintClass}>Leave empty for the default 30-day window.</p>
            </div>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="tryout_required"
              defaultChecked={post?.tryout_required ?? true}
              className={checkboxClass}
            />
            Tryout required
          </label>
        </CardContent>
      </Card>
      {result && (
        <p
          role={result.ok ? "status" : "alert"}
          className={result.ok ? "text-sm text-green-600" : "text-sm text-red-600"}
        >
          {result.message}
        </p>
      )}
      <Button type="submit" loading={pending} className="w-full sm:w-auto">
        {post ? "Save opening" : "Post opening"}
      </Button>
    </form>
  );
}
