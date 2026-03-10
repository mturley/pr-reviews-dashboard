// T025: GitHub GraphQL response to typed PullRequest transforms

import type { PullRequest, Review, CheckStatus, ReviewState } from "../../types/pr.js";

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

  const contexts = rollup.contexts?.nodes ?? [];
  let successCount = 0;
  let failureCount = 0;
  let pendingCount = 0;

  for (const ctx of contexts) {
    if (ctx.state) {
      // StatusContext
      if (ctx.state === "SUCCESS") successCount++;
      else if (ctx.state === "FAILURE" || ctx.state === "ERROR") failureCount++;
      else if (ctx.state === "PENDING") pendingCount++;
    } else if (ctx.conclusion !== undefined) {
      // CheckRun
      if (ctx.conclusion === "SUCCESS" || ctx.conclusion === "NEUTRAL") successCount++;
      else if (
        ctx.conclusion === "FAILURE" ||
        ctx.conclusion === "TIMED_OUT" ||
        ctx.conclusion === "CANCELLED"
      )
        failureCount++;
      else if (ctx.status === "IN_PROGRESS" || ctx.status === "QUEUED") pendingCount++;
    }
  }

  return {
    state: rollup.state as CheckStatus["state"],
    totalCount: rollup.contexts?.totalCount ?? contexts.length,
    successCount,
    failureCount,
    pendingCount,
  };
}

export function transformPullRequest(node: GraphQLNode): PullRequest {
  const lastCommit = node.commits?.nodes?.[0];

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
    pushedAt: lastCommit?.commit?.pushedDate ?? node.updatedAt,
    headRefOid: node.headRefOid,
    labels: (node.labels?.nodes ?? []).map((l: GraphQLNode) => l.name),
    reviews: (node.reviews?.nodes ?? [])
      .filter((r: GraphQLNode) => r.author?.login)
      .map(transformReview),
    reviewRequests: (node.reviewRequests?.nodes ?? [])
      .map((r: GraphQLNode) => r.requestedReviewer?.login ?? r.requestedReviewer?.name)
      .filter(Boolean),
    checkStatus: transformCheckStatus(lastCommit),
    linkedJiraIssues: [],
  };
}

export function extractPRsFromTeamQuery(data: Record<string, unknown>): PullRequest[] {
  const seen = new Set<string>();
  const prs: PullRequest[] = [];

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

  return prs;
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
