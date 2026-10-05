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
export type WebhookProvider = "stripe" | "razorpay" | "twitch" | "discord" | "youtube" | "kick";

export type Platform = "twitch" | "youtube" | "kick";
export type ConnectionMode = "discovered" | "authorized";
export type ConnectionStatus = "connected" | "disconnected" | "expired" | "revoked";
export type EvidenceType = "live_stream" | "video";
export type EvidenceSource =
  | "get_streams"
  | "get_channel_info"
  | "get_videos"
  | "get_stream_tags"
  | "get_games"
  | "youtube_channels_list"
  | "youtube_videos_list"
  | "youtube_search_list"
  | "youtube_video_categories"
  | "kick_livestreams"
  | "kick_channels"
  | "event";
export type EvaluationResult = "PASS" | "FAIL" | "NOT_VERIFIABLE" | "PENDING" | "NOT_SUPPORTED";
export type ScanStatus = "pending" | "running" | "success" | "failed" | "partial";
export type CampaignStatus = "draft" | "active" | "completed" | "archived";
export type DeliverableStatus = "active" | "paused" | "completed" | "archived";
export type WebhookEventStatus = "pending" | "processing" | "succeeded" | "failed";

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
  organization_id?: string | null;
  platform?: Platform | null;
  external_event_id?: string | null;
  event_type?: string | null;
  received_at?: string | null;
  processed_at?: string | null;
  status?: WebhookEventStatus | null;
}

export interface ConnectedChannel {
  id: string;
  organization_id: string;
  platform: Platform;
  external_channel_id: string;
  external_handle: string;
  display_name: string | null;
  canonical_url: string;
  connection_mode: ConnectionMode;
  connection_status: ConnectionStatus;
  authorized_at: string | null;
  metadata: unknown | null;
  created_at: string;
  updated_at: string;
}

export interface SponsorCampaign {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
}

export interface Deliverable {
  id: string;
  organization_id: string;
  campaign_id: string;
  name: string;
  description: string | null;
  rule: unknown;
  status: DeliverableStatus;
  created_at: string;
  updated_at: string;
}

export interface Evidence {
  id: string;
  organization_id: string;
  campaign_id: string;
  deliverable_id: string;
  platform: Platform;
  external_channel_id: string;
  external_content_id: string | null;
  evidence_type: EvidenceType;
  source: EvidenceSource;
  source_id: string;
  source_url: string | null;
  observed_at: string;
  observed_value: string;
  normalized_value: string;
  raw_ref: unknown | null;
  scanner_version: string;
  scan_id?: string | null;
  created_at: string;
}

export interface Evaluation {
  id: string;
  organization_id: string;
  evidence_id: string;
  deliverable_id: string;
  result: EvaluationResult;
  reason: string;
  evaluated_at: string;
  evaluator_version: string;
  scan_id?: string | null;
  created_at: string;
}

export interface Scan {
  id: string;
  organization_id: string;
  campaign_id: string;
  platform: Platform;
  status: ScanStatus;
  started_at: string;
  completed_at: string | null;
  scanner_version: string;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
}

export interface OrganizationProviderCredential {
  id: string;
  organization_id: string;
  provider: Platform;
  encrypted_client_id: string | null;
  encrypted_client_secret: string | null;
  encrypted_api_key: string | null;
  client_id_masked: string | null;
  api_key_masked: string | null;
  last_tested_at: string | null;
  last_test_status: "success" | "failed" | null;
  created_at: string;
  updated_at: string;
}

export type BillingPeriod = "monthly" | "yearly";
export type PlanCurrency = "INR";
export type OrderStatus = "created" | "paid" | "failed" | "expired";
export type PaymentStatus = "created" | "authorized" | "captured" | "failed";

export interface Plan {
  id: string;
  tool_id: string | null;
  name: string;
  slug: string;
  billing_period: BillingPeriod;
  amount_minor: number;
  currency: PlanCurrency;
  is_active: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  organization_id: string;
  plan_id: string;
  tool_id: string | null;
  is_all_access: boolean;
  amount_minor: number;
  currency: PlanCurrency;
  status: OrderStatus;
  razorpay_order_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  organization_id: string;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  amount_minor: number;
  currency: PlanCurrency;
  status: PaymentStatus;
  verified_at: string | null;
  created_at: string;
}

// Joined helpers
export type OrganizationWithRole = Organization & { role: OrganizationRole };
export type EntitlementWithTool = ToolEntitlement & { tool: Tool | null };
