import { z } from "zod";

/**
 * Server-only environment variables.
 * Never prefixed with NEXT_PUBLIC_.
 * Validated at startup / first import.
 */
const serverSchema = z.object({
  // Supabase — required
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  // App
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 chars").optional(),
  // Stripe — optional until billing is implemented
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  // Razorpay — optional
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  // Twitch — optional
  TWITCH_CLIENT_ID: z.string().optional(),
  TWITCH_CLIENT_SECRET: z.string().optional(),
  // YouTube — optional (API key for public Data API v3, OAuth for YouTube)
  YOUTUBE_API_KEY: z.string().min(1).optional(),
  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),
  // Kick — optional (OAuth client credentials)
  KICK_CLIENT_ID: z.string().optional(),
  KICK_CLIENT_SECRET: z.string().optional(),
  // Webhook verification — server-only, never client
  TWITCH_EVENTSUB_SECRET: z.string().min(10).max(100).optional(),
  YOUTUBE_WEBSUB_VERIFY_TOKEN: z.string().optional(),
  // Discord — optional
  DISCORD_WEBHOOK_URL: z.string().url().optional(),
  // Credential encryption — server-only, never DB, 32-byte base64 or hex
  CREDENTIALS_ENCRYPTION_KEY: z.string().min(32).optional(),
  // Node env
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === "production" && !data.CREDENTIALS_ENCRYPTION_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "CREDENTIALS_ENCRYPTION_KEY is required in production — generate with: openssl rand -base64 32",
      path: ["CREDENTIALS_ENCRYPTION_KEY"],
    });
  }
  if (data.CREDENTIALS_ENCRYPTION_KEY) {
    const raw = data.CREDENTIALS_ENCRYPTION_KEY;
    let lenOk = false;
    if (/^[A-Za-z0-9+/=]{44}$/.test(raw)) lenOk = Buffer.from(raw, "base64").length === 32;
    else if (/^[0-9a-fA-F]{64}$/.test(raw)) lenOk = true;
    else lenOk = raw.length >= 32; // will be hashed to 32, still acceptable for dev but warn
    if (!lenOk && data.NODE_ENV === "production") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CREDENTIALS_ENCRYPTION_KEY must be 32-byte base64 (44 chars) or 64-char hex in production",
        path: ["CREDENTIALS_ENCRYPTION_KEY"],
      });
    }
  }
});

/**
 * Public (browser-exposed) environment variables.
 * Only NEXT_PUBLIC_ prefixed vars are allowed here.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

export { serverSchema, clientSchema };
