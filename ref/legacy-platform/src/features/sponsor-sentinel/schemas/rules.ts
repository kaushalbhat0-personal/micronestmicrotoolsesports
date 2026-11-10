import { z } from "zod";
import { getCapabilities } from "../services/capabilities";
import type { Platform } from "../types/platform";

export const requiredTitleContainsSchema = z.object({
  type: z.literal("required_title_contains"),
  value: z.string().min(1).max(200),
});

export const requiredHashtagSchema = z.object({
  type: z.literal("required_hashtag"),
  value: z.string().min(1).max(100),
});

export const requiredCategorySchema = z.object({
  type: z.literal("required_category"),
  categoryId: z.string().min(1).max(100),
  platform: z.enum(["twitch", "youtube", "kick"]).optional(),
});

export const requiredStreamingWindowSchema = z.object({
  type: z.literal("required_streaming_window"),
});

export const requiredTwitchTagSchema = z.object({
  type: z.literal("required_twitch_tag"),
  tag_id: z.string().min(1).max(100),
});

export const requiredYouTubeTagsSchema = z.object({
  type: z.literal("required_youtube_tags"),
  tags: z.array(z.string().min(1).max(100)).min(1).max(20),
});

export const requiredKickTagsSchema = z.object({
  type: z.literal("required_kick_tags"),
  tags: z.array(z.string().min(1).max(100)).min(1).max(20),
});

export const minimumDurationSchema = z.object({
  type: z.literal("minimum_duration"),
  minutes: z.number().int().min(1).max(10080),
});

export const requiredVodExistsSchema = z.object({
  type: z.literal("required_vod_exists"),
});

export const requiredDescriptionContainsSchema = z.object({
  type: z.literal("required_description_contains"),
  value: z.string().min(1).max(500),
});

export const deliverableRuleSchema = z.discriminatedUnion("type", [
  requiredTitleContainsSchema,
  requiredHashtagSchema,
  requiredCategorySchema,
  requiredStreamingWindowSchema,
  requiredTwitchTagSchema,
  requiredYouTubeTagsSchema,
  requiredKickTagsSchema,
  minimumDurationSchema,
  requiredVodExistsSchema,
  requiredDescriptionContainsSchema,
]);

export type DeliverableRule = z.infer<typeof deliverableRuleSchema>;

export type RuleValidationError = {
  readonly ruleIndex: number;
  readonly ruleType: string;
  readonly platform: Platform;
  readonly reason: string;
};

export function validateRulesForPlatform(
  platform: Platform,
  rules: readonly DeliverableRule[],
): { readonly valid: boolean; readonly errors: readonly RuleValidationError[] } {
  const caps = getCapabilities(platform);
  const errors: RuleValidationError[] = [];

  rules.forEach((rule, index) => {
    switch (rule.type) {
      case "required_twitch_tag": {
        if (platform !== "twitch") {
          errors.push({
            ruleIndex: index,
            ruleType: rule.type,
            platform,
            reason: `required_twitch_tag is only supported on twitch, got ${platform}`,
          });
        }
        break;
      }
      case "required_youtube_tags": {
        if (platform !== "youtube") {
          errors.push({
            ruleIndex: index,
            ruleType: rule.type,
            platform,
            reason: `required_youtube_tags is only supported on youtube, got ${platform}`,
          });
        }
        break;
      }
      case "required_kick_tags": {
        if (platform !== "kick") {
          errors.push({
            ruleIndex: index,
            ruleType: rule.type,
            platform,
            reason: `required_kick_tags is only supported on kick, got ${platform}`,
          });
        }
        break;
      }
      case "minimum_duration": {
        if (!caps.vodDuration) {
          errors.push({
            ruleIndex: index,
            ruleType: rule.type,
            platform,
            reason: `minimum_duration requires VOD duration which is NOT_SUPPORTED on ${platform}`,
          });
        }
        break;
      }
      case "required_vod_exists": {
        if (!caps.vodExistence) {
          errors.push({
            ruleIndex: index,
            ruleType: rule.type,
            platform,
            reason: `required_vod_exists is NOT_SUPPORTED on ${platform}`,
          });
        }
        break;
      }
      case "required_description_contains": {
        if (!caps.vodDescription && !caps.streamDescription) {
          errors.push({
            ruleIndex: index,
            ruleType: rule.type,
            platform,
            reason: `required_description_contains is NOT_SUPPORTED on ${platform}`,
          });
        } else if (platform === "kick" && !caps.vodDescription) {
          errors.push({
            ruleIndex: index,
            ruleType: rule.type,
            platform,
            reason: `required_description_contains is NOT_SUPPORTED on kick (no VOD description)`,
          });
        }
        break;
      }
      case "required_title_contains":
      case "required_hashtag":
      case "required_category":
      case "required_streaming_window": {
        // platform-neutral but category requires tag support check? category always true per capabilities
        break;
      }
      default: {
        const _exhaustive: never = rule;
        void _exhaustive;
      }
    }
  });

  return { valid: errors.length === 0, errors };
}
