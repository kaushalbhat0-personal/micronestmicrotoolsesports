"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { COMPETITIVE_LEVELS } from "@/features/finder/domain/levels";
import { BGMI_ROLES } from "@/features/finder/domain/roles";
import { saveMyProfileAction } from "./actions";

export interface ProfileFormInitial {
  handle: string;
  display_name: string;
  region: string;
  languages: string;
  timezone: string;
  current_level: string;
  target_level: string;
  primary_role: string;
  secondary_roles: string[];
  availability: string[];
  looking_for: boolean;
  open_to_tryout: boolean;
  bio: string;
  allow_indexing: boolean;
  ign: string;
  character_id: string;
  verification_status: string;
}

const AVAILABILITY_OPTIONS = [
  "weekday-evenings",
  "weekend-afternoons",
  "weekend-evenings",
  "late-night",
  "flexible",
];

const selectClass =
  "flex h-11 w-full rounded-[12px] border border-input bg-card px-3 text-sm text-foreground";
const checkboxClass = "h-5 w-5 accent-current";
const hintClass = "text-xs leading-relaxed text-muted-foreground";

export function ProfileForm({ initial }: { initial: ProfileFormInitial }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; handle?: string } | null>(null);
  const [secondaryRoles, setSecondaryRoles] = useState<string[]>(initial.secondary_roles);
  const [availability, setAvailability] = useState<string[]>(initial.availability);
  const [bioLength, setBioLength] = useState(initial.bio.length);

  function toggle(list: string[], value: string, set: (next: string[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setResult(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      profile: {
        handle: String(form.get("handle") ?? ""),
        display_name: String(form.get("display_name") ?? ""),
        region: String(form.get("region") ?? ""),
        languages: String(form.get("languages") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        timezone: String(form.get("timezone") ?? ""),
        current_level: String(form.get("current_level") ?? ""),
        target_level: String(form.get("target_level") ?? ""),
        primary_role: String(form.get("primary_role") ?? ""),
        secondary_roles: secondaryRoles,
        availability,
        looking_for: form.get("looking_for") === "on",
        open_to_tryout: form.get("open_to_tryout") === "on",
        bio: String(form.get("bio") ?? ""),
        allow_indexing: form.get("allow_indexing") === "on",
      },
      game: {
        game: "bgmi",
        ign: String(form.get("ign") ?? ""),
        character_id: String(form.get("character_id") ?? ""),
      },
    };
    const outcome = await saveMyProfileAction(payload);
    setResult(outcome);
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Player identity</CardTitle>
          <CardDescription>How teams recognize you in the Finder.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Label htmlFor="handle">Handle</Label>
            <Input id="handle" name="handle" defaultValue={initial.handle} required minLength={3} maxLength={20} autoComplete="off" />
            <p className={hintClass}>Lowercase letters, numbers, underscores. Shown in your public URL.</p>
          </div>
          <div>
            <Label htmlFor="display_name">Display name</Label>
            <Input id="display_name" name="display_name" defaultValue={initial.display_name} required maxLength={40} />
          </div>
          <div>
            <Label htmlFor="region">Region</Label>
            <Input id="region" name="region" defaultValue={initial.region} required maxLength={40} placeholder="e.g. IN-North" />
            <p className={hintClass}>Broad region only. Never share an exact address.</p>
          </div>
          <div>
            <Label htmlFor="languages">Languages</Label>
            <Input id="languages" name="languages" defaultValue={initial.languages} maxLength={160} placeholder="e.g. English, Hindi" />
            <p className={hintClass}>Comma-separated.</p>
          </div>
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" name="timezone" defaultValue={initial.timezone} maxLength={60} placeholder="e.g. Asia/Kolkata" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Competitive context</CardTitle>
          <CardDescription>Self-reported. These are not MicroNest ratings.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="current_level">Current level</Label>
              <select id="current_level" name="current_level" defaultValue={initial.current_level} className={selectClass}>
                {COMPETITIVE_LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="target_level">Target level</Label>
              <select id="target_level" name="target_level" defaultValue={initial.target_level} className={selectClass}>
                {COMPETITIVE_LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="primary_role">Primary role (BGMI)</Label>
              <select id="primary_role" name="primary_role" defaultValue={initial.primary_role} className={selectClass}>
                {BGMI_ROLES.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          </div>
          <fieldset>
            <legend className="text-[13px] font-medium">Secondary roles (up to 3)</legend>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {BGMI_ROLES.map((role) => (
                <label key={role} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={secondaryRoles.includes(role)}
                    onChange={() => toggle(secondaryRoles, role, setSecondaryRoles)}
                    className={checkboxClass}
                  />
                  {role}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-[13px] font-medium">Availability</legend>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {AVAILABILITY_OPTIONS.map((slot) => (
                <label key={slot} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={availability.includes(slot)}
                    onChange={() => toggle(availability, slot, setAvailability)}
                    className={checkboxClass}
                  />
                  {slot}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <Label htmlFor="bio">Bio ({bioLength}/280)</Label>
            <textarea
              id="bio"
              name="bio"
              defaultValue={initial.bio}
              maxLength={280}
              rows={3}
              onChange={(e) => setBioLength(e.target.value.length)}
              className="flex w-full rounded-[12px] border border-input bg-card px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" name="looking_for" defaultChecked={initial.looking_for} className={checkboxClass} />
              Looking for a team
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" name="open_to_tryout" defaultChecked={initial.open_to_tryout} className={checkboxClass} />
              Open to tryouts
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" name="allow_indexing" defaultChecked={initial.allow_indexing} className={checkboxClass} />
              Allow search engines to show my public profile
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>BGMI identity</CardTitle>
          <CardDescription>
            Entering your IGN and Character ID does not verify ownership.{" "}
            <Badge variant={initial.verification_status === "verified" ? "success" : "secondary"}>
              {initial.verification_status === "verified" ? "Verified" : "Unverified"}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ign">Current IGN</Label>
            <Input id="ign" name="ign" defaultValue={initial.ign} required minLength={2} maxLength={30} autoComplete="off" />
          </div>
          <div>
            <Label htmlFor="character_id">BGMI Character ID</Label>
            <Input id="character_id" name="character_id" defaultValue={initial.character_id} required inputMode="numeric" autoComplete="off" placeholder="Digits only" />
            <p className={hintClass}>Stored as text so leading zeroes are preserved.</p>
          </div>
        </CardContent>
      </Card>

      {result && (
        <p role={result.ok ? "status" : "alert"} className={result.ok ? "text-sm text-green-600" : "text-sm text-red-600"}>
          {result.message}{" "}
          {result.ok && result.handle && (
            <Link href={`/players/${result.handle}` as Route} className="underline">View public profile</Link>
          )}
        </p>
      )}
      <Button type="submit" loading={pending} className="w-full sm:w-auto">
        Save profile
      </Button>
    </form>
  );
}
