"use client";

import { useState } from "react";
import { createDeliverableAction } from "@/features/sponsor-sentinel/actions/deliverable-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCapabilities } from "@/features/sponsor-sentinel/services/capabilities";

const RULE_OPTIONS = [
  { value: "required_title_contains", label: "Title includes" },
  { value: "required_hashtag", label: "Hashtag included" },
  { value: "required_category", label: "Category" },
  { value: "required_twitch_tag", label: "Twitch tag included" },
  { value: "required_youtube_tags", label: "YouTube tags include" },
  { value: "required_kick_tags", label: "Kick tags include" },
  { value: "minimum_duration", label: "Minimum stream duration" },
  { value: "required_vod_exists", label: "VOD available" },
  { value: "required_description_contains", label: "Description includes" },
  { value: "required_streaming_window", label: "Streaming window" },
] as const;

export function DeliverableForm({ orgSlug, campaignId }: { orgSlug: string; campaignId: string }) {
  const [platform, setPlatform] = useState<"twitch" | "youtube" | "kick">("twitch");
  const [ruleType, setRuleType] = useState<string>("required_title_contains");
  const caps = getCapabilities(platform);

  // Filter rule options by capability
  const filtered = RULE_OPTIONS.filter((opt) => {
    if (opt.value === "required_twitch_tag" && platform !== "twitch") return false;
    if (opt.value === "required_youtube_tags" && platform !== "youtube") return false;
    if (opt.value === "required_kick_tags" && platform !== "kick") return false;
    if (opt.value === "minimum_duration" && !caps.vodDuration) return false;
    if (opt.value === "required_vod_exists" && !caps.vodExistence) return false;
    if (opt.value === "required_description_contains" && !caps.vodDescription && !caps.streamDescription) return false;
    if (opt.value === "required_description_contains" && platform === "kick" && !caps.vodDescription) return false;
    return true;
  });

  return (
    <form action={createDeliverableAction} className="space-y-4">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="campaignId" value={campaignId} />
      <div className="space-y-2">
        <Label htmlFor="deliverable-name">Requirement name</Label>
        <Input id="deliverable-name" name="name" required minLength={2} maxLength={120} placeholder="Title must contain #OurBrand" />
        <p className="text-xs text-muted-foreground">What should the creator deliver?</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="deliverable-desc">Description (optional)</Label>
        <textarea
          id="deliverable-desc"
          name="description"
          maxLength={2000}
          placeholder="Optional context for this requirement"
          rows={2}
          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="platformHint">Where should we check it?</Label>
          <select id="platformHint" name="platformHint" value={platform} onChange={(e) => setPlatform(e.target.value as never)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="twitch">Twitch</option>
            <option value="youtube">YouTube</option>
            <option value="kick">Kick</option>
          </select>
          <p className="text-xs text-muted-foreground">Platform</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ruleType">What should we check?</Label>
          <select id="ruleType" name="ruleType" value={ruleType} onChange={(e) => setRuleType(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {filtered.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Check type</p>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ruleValue">What should the creator include?</Label>
        <Input id="ruleValue" name="ruleValue" placeholder={ruleType === "minimum_duration" ? "30" : "#OurBrand"} required={ruleType !== "required_vod_exists" && ruleType !== "required_streaming_window"} />
        <p className="text-xs text-muted-foreground">
          For category, enter category ID; for tags, comma-separated; for duration, minutes.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="categoryId">Category ID (if category check)</Label>
        <Input id="categoryId" name="categoryId" placeholder="509658" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tagIds">Tags (comma-separated, for tag checks)</Label>
        <Input id="tagIds" name="tagIds" placeholder="tag1, tag2" />
      </div>
      <Button type="submit" aria-label="Add requirement">
        Add requirement
      </Button>
    </form>
  );
}
