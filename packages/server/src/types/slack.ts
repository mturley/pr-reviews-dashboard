export interface SlackThread {
  channelName: string;
  channelId: string;
  permalink: string;
  snippet: string;
  author: string;
  replyCount: number;
  latestReplyTs: string | null;
  matchedUrl: string;
  messageTs: string;
}

export interface SlackSearchResult {
  threads: SlackThread[];
  searchedUrls: string[];
  fetchedAt: string;
}
