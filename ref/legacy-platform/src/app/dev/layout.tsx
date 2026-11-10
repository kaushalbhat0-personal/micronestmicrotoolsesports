import * as React from "react";
import { notFound } from "next/navigation";

/**
 * Internal design-preview surfaces (mock workspaces, spec docs).
 * Available in development only — production requests 404.
 * robots.txt is not access control, so the boundary lives here.
 */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}
