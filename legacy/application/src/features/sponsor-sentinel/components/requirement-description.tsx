/**
 * Presentation-only formatter: converts backend rule objects to user-facing language.
 * No business logic, no schema changes. Unknown types fall back to generic text — never JSON.
 */
export function formatRequirementDescription(rule: unknown): string {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
    return "Requirement configured";
  }
  const r = rule as Record<string, unknown>;
  const type = typeof r.type === "string" ? r.type : undefined;

  switch (type) {
    case "required_title_contains": {
      const v = typeof r.value === "string" ? r.value.trim() : "";
      if (v) return `Title contains ${v}`;
      return "Title contains required text";
    }
    case "required_hashtag": {
      const v = typeof r.value === "string" ? r.value.trim() : "";
      if (v) return `Includes ${v}`;
      return "Includes required hashtag";
    }
    case "required_category": {
      const cat = typeof r.categoryId === "string" ? r.categoryId.trim() : "";
      if (cat) return `Category ID: ${cat}`;
      return "Required category selected";
    }
    case "required_streaming_window": {
      return "Stream during the required campaign window";
    }
    case "required_twitch_tag": {
      const v = typeof r.tag_id === "string" ? r.tag_id.trim() : "";
      if (v) return `Twitch tags include ${v}`;
      return "Twitch tag included";
    }
    case "required_youtube_tags": {
      const tags = Array.isArray(r.tags) ? (r.tags as unknown[]).filter((t): t is string => typeof t === "string" && t.trim().length > 0) : [];
      if (tags.length > 0) return `YouTube tags include ${tags.join(", ")}`;
      return "YouTube tags configured";
    }
    case "required_kick_tags": {
      const tags = Array.isArray(r.tags) ? (r.tags as unknown[]).filter((t): t is string => typeof t === "string" && t.trim().length > 0) : [];
      if (tags.length > 0) return `Kick tags include ${tags.join(", ")}`;
      return "Kick tags configured";
    }
    case "minimum_duration": {
      const mins = typeof r.minutes === "number" ? r.minutes : typeof r.minutes === "string" ? Number(r.minutes) : undefined;
      if (typeof mins === "number" && !Number.isNaN(mins) && mins > 0) return `Stream for at least ${mins} minutes`;
      return "Minimum stream duration required";
    }
    case "required_vod_exists": {
      return "A VOD must be available";
    }
    case "required_description_contains": {
      const v = typeof r.value === "string" ? r.value.trim() : "";
      if (v) return `Description contains ${v}`;
      return "Description must include required text";
    }
    default:
      return "Requirement configured";
  }
}

/**
 * Small presentational component — usable in both server and client.
 */
export function RequirementDescription({ rule }: { rule: unknown }) {
  const text = formatRequirementDescription(rule);
  return <span>{text}</span>;
}
