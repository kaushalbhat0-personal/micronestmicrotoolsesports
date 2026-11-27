export interface YouTubeSnippet {
  readonly title: string;
  readonly description: string;
  readonly tags?: readonly string[] | undefined;
  readonly categoryId: string;
  readonly publishedAt: string;
  readonly channelId: string;
  readonly liveBroadcastContent: string;
}

export interface YouTubeContentDetails {
  readonly duration: string;
}

export interface YouTubeLiveStreamingDetails {
  readonly actualStartTime?: string | undefined;
  readonly actualEndTime?: string | undefined;
  readonly scheduledStartTime?: string | undefined;
}

export interface YouTubeVideo {
  readonly id: string;
  readonly snippet: YouTubeSnippet;
  readonly contentDetails: YouTubeContentDetails;
  readonly liveStreamingDetails?: YouTubeLiveStreamingDetails | undefined;
}

export interface YouTubeChannelSnippet {
  readonly title: string;
  readonly description: string;
  readonly customUrl?: string | undefined;
}

export interface YouTubeChannel {
  readonly id: string;
  readonly snippet: YouTubeChannelSnippet;
}
