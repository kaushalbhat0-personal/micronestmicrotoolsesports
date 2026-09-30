/**
 * Database types — minimal hand-written until `supabase gen types` is run.
 * Regenerate via: npm run db:types
 */

export type OrganizationRole = "owner" | "admin" | "member";
export type SubscriptionProvider = "stripe" | "razorpay";
export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "trialing"
  | "unpaid"
  | "paused";
export type EntitlementSource = "subscription" | "manual" | "promo";
export type WebhookProvider = "stripe" | "razorpay" | "twitch" | "discord";

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  created_at: string;
}

export interface Tool {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  organization_id: string;
  provider: SubscriptionProvider;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  status: SubscriptionStatus;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface ToolEntitlement {
  id: string;
  organization_id: string;
  tool_id: string | null;
  subscription_id: string | null;
  is_all_access: boolean;
  source: EntitlementSource;
  expires_at: string | null;
  created_at: string;
}

export interface WebhookEvent {
  id: string;
  provider: WebhookProvider;
  provider_event_id: string;
  payload: unknown | null;
  processed: boolean;
  created_at: string;
}

// Joined helpers
export type OrganizationWithRole = Organization & { role: OrganizationRole };
export type EntitlementWithTool = ToolEntitlement & { tool: Tool | null };
