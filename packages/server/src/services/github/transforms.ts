// T025: GitHub GraphQL response to typed PullRequest transforms

import type { PullRequest, PRComment, Review, CheckStatus, ReviewState, CommitInfo } from "../../types/pr.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GraphQLNode = any;

function transformReview(node: GraphQLNode): Review {
  return {
    author: node.author?.login ?? "unknown",
    state: node.state as ReviewState,
    submittedAt: node.submittedAt ?? "",
    commitOid: node.commit?.oid ?? "",
    commentCount: node.comments?.totalCount ?? 0,
  };
}

function transformCheckStatus(commitNode: GraphQLNode): CheckStatus {
  const rollup = commitNode?.commit?.statusCheckRollup;
  if (!rollup) {
    return { state: null, totalCount: 0, successCount: 0, failureCount: 0, pendingCount: 0 };
  }

  const totalCount = rollup.contexts?.totalCount ?? 0;
  const state = rollup.state as CheckStatus["state"];

  // Derive approximate counts from the rollup state (individual contexts are not fetched)
  return {
    state,
    totalCount,
    successCount: state === "SUCCESS" ? totalCount : 0,
    failureCount: state === "FAILURE" || state === "ERROR" ? totalCount : 0,
    pendingCount: state === "PENDING" ? totalCount : 0,
  };
}

function extractMentionedUsers(commentNodes: GraphQLNode[]): string[] {
  const mentions = new Set<string>();
  for (const node of commentNodes) {
    const body: string = node.body ?? "";
    const matches = body.matchAll(/@([a-zA-Z0-9-]+)/g);
    for (const match of matches) {
      mentions.add(match[1]);
    }
  }
  return [...mentions];
}

function transformComments(commentNodes: GraphQLNode[]): PRComment[] {
  return commentNodes
    .filter((n: GraphQLNode) => n.author?.login)
    .map((n: GraphQLNode) => ({
      author: n.author.login,
      createdAt: n.createdAt ?? "",
      body: n.body ?? "",
    }));
}

function extractPushDates(commitNodes: GraphQLNode[]): string[] {
  const dates = new Set<string>();
  for (const node of commitNodes) {
    const date = node?.commit?.pushedDate ?? node?.commit?.committedDate;
    if (date) dates.add(date);
  }
  return [...dates].sort();
}

function extractCommits(commitNodes: GraphQLNode[]): CommitInfo[] {
  return commitNodes
    .filter((n: GraphQLNode) => n?.commit?.oid)
    .map((n: GraphQLNode) => ({
      oid: n.commit.oid,
      message: n.commit.messageHeadline ?? "",
      pushedDate: n.commit.pushedDate ?? n.commit.committedDate ?? "",
    }));
}

export function transformPullRequest(node: GraphQLNode): PullRequest {
  // lastCommit uses the aliased field (with statusCheckRollup), falling back to commits
  const lastCommit = node.lastCommit?.nodes?.[0] ?? node.commits?.nodes?.[(node.commits?.nodes?.length ?? 1) - 1];
  const allCommitNodes = node.commits?.nodes ?? [];
  const commentNodes = node.comments?.nodes ?? [];

  return {
    id: node.id,
    number: node.number,
    title: node.title,
    url: node.url,
    repoOwner: node.repository?.owner?.login ?? "",
    repoName: node.repository?.name ?? "",
    author: node.author?.login ?? "unknown",
    state: node.state,
    isDraft: node.isDraft ?? false,
    isMergeable: node.mergeable === "MERGEABLE" ? true : node.mergeable === "CONFLICTING" ? false : null,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    pushedAt: lastCommit?.commit?.pushedDate ?? lastCommit?.commit?.committedDate ?? node.updatedAt,
    pushDates: extractPushDates(allCommitNodes),
    commits: extractCommits(allCommitNodes),
    headRefOid: node.headRefOid,
    labels: (node.labels?.nodes ?? []).map((l: GraphQLNode) => l.name),
    reviews: (node.reviews?.nodes ?? [])
      .filter((r: GraphQLNode) => r.author?.login)
      .map(transformReview),
    comments: transformComments(commentNodes),
    reviewRequests: (node.reviewRequests?.nodes ?? [])
      .map((r: GraphQLNode) => r.requestedReviewer?.login ?? r.requestedReviewer?.name)
      .filter(Boolean),
    mentionedUsers: extractMentionedUsers(commentNodes),
    checkStatus: transformCheckStatus(lastCommit),
    linkedJiraIssues: [],
  };
}

export interface GraphQLRateLimit {
  remaining: number;
  resetAt: string;
}

export function extractPRsFromTeamQuery(data: Record<string, unknown>): {
  prs: PullRequest[];
  rateLimit: GraphQLRateLimit | null;
} {
  const seen = new Set<string>();
  const prs: PullRequest[] = [];
  const rateLimit = (data.rateLimit as GraphQLRateLimit) ?? null;

  for (const [key, value] of Object.entries(data)) {
    if (key === "rateLimit") continue;
    const searchResult = value as { nodes?: GraphQLNode[] };
    for (const node of searchResult.nodes ?? []) {
      if (!node.id) continue;
      if (seen.has(node.id)) continue;
      seen.add(node.id);
      prs.push(transformPullRequest(node));
    }
  }

  return { prs, rateLimit };
}

export function extractPRsFromUrlsQuery(data: Record<string, unknown>): {
  prs: PullRequest[];
  notFound: string[];
} {
  const prs: PullRequest[] = [];
  const notFound: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (key === "rateLimit") continue;
    const repoResult = value as { pullRequest?: GraphQLNode } | null;
    if (repoResult?.pullRequest) {
      prs.push(transformPullRequest(repoResult.pullRequest));
    } else {
      notFound.push(key);
    }
  }

  return { prs, notFound };
}
