"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { COMPETITIVE_LEVELS } from "@/features/finder/domain/levels";
import type { FinderTeamRow } from "@/features/finder/repositories/finder";
import { createTeamAction, updateTeamAction } from "./actions";

const selectClass =
  "flex h-11 w-full rounded-[12px] border border-input bg-card px-3 text-sm text-foreground";
const checkboxClass = "h-5 w-5 accent-current";
const hintClass = "text-xs leading-relaxed text-muted-foreground";

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Team create/update form (Phase C). Slug is set once at creation and
 * then immutable, so public /teams/[slug] URLs stay stable.
 */
export function TeamForm({ team }: { team: FinderTeamRow | null }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; slug?: string | undefined } | null>(
    null,
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setResult(null);
    const form = new FormData(event.currentTarget);
    const contactMode = String(form.get("contact_mode") ?? "application_only");
    const payload = {
      ...(team
        ? {}
        : {
            slug: String(form.get("slug") ?? ""),
            game: "bgmi",
          }),
      name: String(form.get("name") ?? ""),
      region: String(form.get("region") ?? ""),
      description: emptyToUndefined(String(form.get("description") ?? "")),
      current_level: String(form.get("current_level") ?? ""),
      target_level: String(form.get("target_level") ?? ""),
      recruiting: form.get("recruiting") === "on",
      contact_mode: contactMode,
      external_link: emptyToUndefined(String(form.get("external_link") ?? "")),
      is_public: form.get("is_public") === "on",
    };
    const outcome = team
      ? await updateTeamAction(team.id, payload)
      : await createTeamAction(payload);
    setResult(outcome);
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{team ? "Team identity" : "Create your team"}</CardTitle>
          <CardDescription>
            {team
              ? "How players recognize your team. Levels are self-reported context."
              : "Your team URL is set once and cannot be changed later."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Label htmlFor="name">Team name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={team?.name ?? ""}
              required
              minLength={2}
              maxLength={60}
            />
          </div>
          {!team && (
            <div>
              <Label htmlFor="slug">Team URL</Label>
              <Input
                id="slug"
                name="slug"
                required
                minLength={2}
                maxLength={60}
                autoComplete="off"
                placeholder="e.g. night-hawks"
              />
              <p className={hintClass}>
                Lowercase words joined by hyphens. Shown as /teams/your-url.
              </p>
            </div>
          )}
          <div>
            <Label htmlFor="region">Region</Label>
            <Input
              id="region"
              name="region"
              defaultValue={team?.region ?? ""}
              required
              maxLength={40}
              placeholder="e.g. IN-North"
            />
            <p className={hintClass}>Broad region only.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="current_level">Current level</Label>
              <select
                id="current_level"
                name="current_level"
                defaultValue={team?.current_level ?? "casual"}
                className={selectClass}
              >
                {COMPETITIVE_LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="target_level">Target level</Label>
              <select
                id="target_level"
                name="target_level"
                defaultValue={team?.target_level ?? "community"}
                className={selectClass}
              >
                {COMPETITIVE_LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              name="description"
              defaultValue={team?.description ?? ""}
              maxLength={1000}
              rows={3}
              placeholder="Playstyle, goals, practice timings…"
              className="flex w-full rounded-[12px] border border-input bg-card px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div>
            <Label htmlFor="contact_mode">How players reach you</Label>
            <select
              id="contact_mode"
              name="contact_mode"
              defaultValue={team?.contact_mode ?? "application_only"}
              className={selectClass}
            >
              <option value="application_only">Applications only (recommended)</option>
              <option value="external_link">External link</option>
            </select>
            <p className={hintClass}>
              External links stay private until you accept an application.
            </p>
          </div>
          <div>
            <Label htmlFor="external_link">External contact link</Label>
            <Input
              id="external_link"
              name="external_link"
              type="url"
              defaultValue={team?.external_link ?? ""}
              maxLength={208}
              autoComplete="off"
              placeholder="https://…"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="recruiting"
                defaultChecked={team?.recruiting ?? true}
                className={checkboxClass}
              />
              Recruiting players
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_public"
                defaultChecked={team?.is_public ?? true}
                className={checkboxClass}
              />
              Show in the public team directory
            </label>
          </div>
        </CardContent>
      </Card>

      {result && (
        <p
          role={result.ok ? "status" : "alert"}
          className={result.ok ? "text-sm text-green-600" : "text-sm text-red-600"}
        >
          {result.message}{" "}
          {result.ok && result.slug && (
            <Link href={`/teams/${result.slug}` as Route} className="underline">
              View public profile
            </Link>
          )}
        </p>
      )}
      <Button type="submit" loading={pending} className="w-full sm:w-auto">
        {team ? "Save team" : "Create team"}
      </Button>
    </form>
  );
}
