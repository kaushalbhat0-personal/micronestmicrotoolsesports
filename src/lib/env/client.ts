import { clientSchema } from "./schema";

/**
 * Validated public (browser-safe) environment.
 * Safe to import in Client Components.
 * Only contains NEXT_PUBLIC_ vars.
 */

function getClientEnv() {
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  });

  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors;
    // Client env is validated at build/runtime; log clearly.
    // Do not throw cryptically in browser bundle — throw with details.
    throw new Error(`Invalid public environment variables: ${JSON.stringify(details, null, 2)}`);
  }

  return parsed.data;
}

export const clientEnv = getClientEnv();
