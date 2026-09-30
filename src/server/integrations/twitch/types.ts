export interface TwitchStream {
  readonly id: string;
  readonly user_id: string;
  readonly user_login: string;
  readonly title: string;
  readonly game_name: string;
  readonly game_id: string;
  readonly tags: readonly string[];
  readonly started_at: string;
  readonly type: string;
}

export interface TwitchVideo {
  readonly id: string;
  readonly user_id: string;
  readonly title: string;
  readonly description: string;
  readonly duration: string;
  readonly created_at: string;
  readonly published_at: string;
  readonly viewable: string;
  readonly thumbnail_url: string;
  readonly url: string;
}

export interface TwitchChannelInfo {
  readonly broadcaster_id: string;
  readonly broadcaster_login: string;
  readonly broadcaster_name: string;
  readonly title: string;
  readonly game_name: string;
  readonly game_id: string;
  readonly tags: readonly string[];
}
