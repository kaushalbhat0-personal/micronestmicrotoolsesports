export interface KickCategory {
  readonly id: number;
  readonly name: string;
  readonly thumbnail?: string;
}

export interface KickLivestream {
  readonly id: string;
  readonly title: string;
  readonly category: KickCategory;
  readonly tags: readonly string[];
  readonly custom_tags?: readonly string[];
  readonly started_at: string;
  readonly viewer_count: number;
  readonly broadcaster_user: { readonly id: number; readonly username: string };
  readonly channel: { readonly slug: string };
}

export interface KickChannel {
  readonly id: number;
  readonly slug: string;
  readonly broadcaster_user_id: number;
  readonly stream_title: string;
  readonly category: KickCategory;
  readonly tags?: readonly string[];
  readonly custom_tags?: readonly string[];
}
