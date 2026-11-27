import { getCapabilities } from "./capabilities";
import {
  durationSecondsToMinutes,
  normalizeHashtagForTitle,
  normalizeTagValue,
  normalizeText,
} from "./normalization";
import type { DeliverableRule } from "../schemas/rules";
import type { CanonicalLiveStream, CanonicalVideo } from "../types/observations";
import type { Platform } from "../types/platform";
import type { EvaluationOutcome } from "../types/evaluation";

export type ObservationInput =
  | { readonly kind: "live"; readonly data: CanonicalLiveStream | null }
  | { readonly kind: "video"; readonly data: CanonicalVideo | null }
  | { readonly kind: "none" };

export function evaluateRule(
  rule: DeliverableRule,
  platform: Platform,
  observation: ObservationInput,
): EvaluationOutcome {
  const caps = getCapabilities(platform);

  // Capability-driven NOT_SUPPORTED before observation checks
  switch (rule.type) {
    case "minimum_duration": {
      if (!caps.vodDuration) {
        return { result: "NOT_SUPPORTED", reason: `minimum_duration NOT_SUPPORTED on ${platform}` };
      }
      break;
    }
    case "required_vod_exists": {
      if (!caps.vodExistence) {
        return { result: "NOT_SUPPORTED", reason: `required_vod_exists NOT_SUPPORTED on ${platform}` };
      }
      break;
    }
    case "required_description_contains": {
      if (platform === "kick" && !caps.vodDescription) {
        return { result: "NOT_SUPPORTED", reason: `required_description_contains NOT_SUPPORTED on kick` };
      }
      break;
    }
    case "required_twitch_tag": {
      if (platform !== "twitch") {
        return { result: "NOT_SUPPORTED", reason: `required_twitch_tag NOT_SUPPORTED on ${platform}` };
      }
      break;
    }
    case "required_youtube_tags": {
      if (platform !== "youtube") {
        return { result: "NOT_SUPPORTED", reason: `required_youtube_tags NOT_SUPPORTED on ${platform}` };
      }
      break;
    }
    case "required_kick_tags": {
      if (platform !== "kick") {
        return { result: "NOT_SUPPORTED", reason: `required_kick_tags NOT_SUPPORTED on ${platform}` };
      }
      break;
    }
    default:
      break;
  }

  // PENDING: no observation yet
  if (observation.kind === "none" || observation.data === null) {
    // For VOD existence, absence is PENDING until provider says definitively not found?
    // Keep generic: if no data, rule cannot be verified yet unless it explicitly checks absence.
    if (rule.type === "required_vod_exists") {
      return { result: "PENDING", reason: "no video observation yet" };
    }
    return { result: "PENDING", reason: "no observation yet" };
  }

  const data = observation.data;

  switch (rule.type) {
    case "required_title_contains": {
      const normalizedTitle = normalizeText(data.title);
      const normalizedNeedle = normalizeText(rule.value);
      if (normalizedNeedle.length === 0) {
        return { result: "NOT_VERIFIABLE", reason: "empty rule value" };
      }
      return normalizedTitle.includes(normalizedNeedle)
        ? { result: "PASS", reason: `title contains "${rule.value}"` }
        : { result: "FAIL", reason: `title does not contain "${rule.value}"` };
    }
    case "required_hashtag": {
      const normalizedTitle = normalizeText(data.title);
      const normalizedTag = normalizeHashtagForTitle(rule.value);
      // title hashtag check: look for normalizedTag substring
      return normalizedTitle.includes(normalizedTag)
        ? { result: "PASS", reason: `title contains hashtag "${normalizedTag}"` }
        : { result: "FAIL", reason: `title missing hashtag "${normalizedTag}"` };
    }
    case "required_category": {
      if (data.category === null || data.category === undefined) {
        return { result: "NOT_VERIFIABLE", reason: "category missing in observation" };
      }
      return data.category.id === rule.categoryId
        ? { result: "PASS", reason: `category matches ${rule.categoryId}` }
        : { result: "FAIL", reason: `category ${data.category.id} != ${rule.categoryId}` };
    }
    case "required_streaming_window": {
      // Domain only: if observation exists, it was within campaign window assumed.
      // Without window data here, treat existence as PASS if we have startedAt.
      if (data.startedAt === null || data.startedAt === undefined) {
        return { result: "NOT_VERIFIABLE", reason: "startedAt missing" };
      }
      return { result: "PASS", reason: "stream occurred (window check assumed passed by caller)" };
    }
    case "required_twitch_tag": {
      const tags = data.tags;
      const found = tags.some((t) => t.source === "twitch_curated" && t.value === rule.tag_id);
      return found
        ? { result: "PASS", reason: `found twitch tag ${rule.tag_id}` }
        : { result: "FAIL", reason: `missing twitch tag ${rule.tag_id}` };
    }
    case "required_youtube_tags": {
      const normalizedNeedles = rule.tags.map(normalizeTagValue);
      const tagValues = data.tags
        .filter((t) => t.source === "youtube_freeform")
        .map((t) => normalizeTagValue(t.value));
      const missing = normalizedNeedles.filter((n) => !tagValues.includes(n));
      return missing.length === 0
        ? { result: "PASS", reason: `all youtube tags present` }
        : { result: "FAIL", reason: `missing youtube tags: ${missing.join(", ")}` };
    }
    case "required_kick_tags": {
      const normalizedNeedles = rule.tags.map(normalizeTagValue);
      const tagValues = data.tags
        .filter((t) => t.source === "kick" || t.source === "kick_custom")
        .map((t) => normalizeTagValue(t.value));
      const missing = normalizedNeedles.filter((n) => !tagValues.includes(n));
      return missing.length === 0
        ? { result: "PASS", reason: `all kick tags present` }
        : { result: "FAIL", reason: `missing kick tags: ${missing.join(", ")}` };
    }
    case "minimum_duration": {
      // Only videos have duration
      if (observation.kind !== "video") {
        return { result: "NOT_VERIFIABLE", reason: "duration only available on video observations" };
      }
      const video = data as CanonicalVideo;
      if (video.durationSeconds === null || video.durationSeconds === undefined) {
        return { result: "NOT_VERIFIABLE", reason: "duration missing in observation" };
      }
      const minutes = durationSecondsToMinutes(video.durationSeconds);
      return minutes >= rule.minutes
        ? { result: "PASS", reason: `duration ${String(minutes)}m >= ${String(rule.minutes)}m` }
        : { result: "FAIL", reason: `duration ${String(minutes)}m < ${String(rule.minutes)}m` };
    }
    case "required_vod_exists": {
      if (observation.kind !== "video") {
        return { result: "NOT_VERIFIABLE", reason: "vod existence requires video observation" };
      }
      // If we have video data, existence is PASS
      return { result: "PASS", reason: "vod exists" };
    }
    case "required_description_contains": {
      const desc = data.description;
      if (desc === null || desc === undefined || desc.trim().length === 0) {
        return { result: "NOT_VERIFIABLE", reason: "description missing" };
      }
      const normalizedDesc = normalizeText(desc);
      const normalizedNeedle = normalizeText(rule.value);
      return normalizedDesc.includes(normalizedNeedle)
        ? { result: "PASS", reason: `description contains "${rule.value}"` }
        : { result: "FAIL", reason: `description missing "${rule.value}"` };
    }
    default: {
      const _exhaustive: never = rule;
      return { result: "NOT_VERIFIABLE", reason: `unknown rule ${( _exhaustive as { type: string }).type}` };
    }
  }
}
