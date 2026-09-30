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
  // Discord — optional
  DISCORD_WEBHOOK_URL: z.string().url().optional(),
  // Node env
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
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
