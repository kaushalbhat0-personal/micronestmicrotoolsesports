import { forbiddenError } from "@/lib/errors";

/**
 * Authenticate cron requests via bearer secret.
 * Vercel Cron sends Authorization: Bearer <CRON_SECRET>
 */
export function assertCronAuth(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw forbiddenError("CRON_SECRET not configured");

  const auth = request.headers.get("authorization");
  if (!auth || auth !== `Bearer ${secret}`) {
    throw forbiddenError("Invalid cron secret");
  }
}
