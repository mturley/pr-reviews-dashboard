// T027: Review status computation (FR-041 Author Status, FR-042 Reviewer Status)

import type {
  PullRequest,
  ReviewStatusResult,
  AuthorStatus,
  ReviewerStatus,
  ReviewerBreakdownEntry,
  CommentAction,
  Review,
} from "../types/pr.js";

const BOT_USERNAMES = new Set([
  "dependabot[bot]", "dependabot",
  "coderabbitai[bot]", "coderabbitai",
  "openshift-ci[bot]", "openshift-ci",
  "openshift-merge[bot]", "openshift-merge-robot", "openshift-merge-bot",
  "codecov[bot]", "codecov",
  "google-oss-prow",
]);

function isBot(username: string): boolean {
  return BOT_USERNAMES.has(username.toLowerCase());
}

function getLatestReviewPerUser(reviews: Review[]): Map<string, Review> {
  const latest = new Map<string, Review>();
  // Reviews are returned chronologically; later ones override earlier
  for (const review of reviews) {
    if (review.state === "PENDING") continue;
    latest.set(review.author, review);
  }
  return latest;
}

/** Latest reviews from humans only (excludes bots) — used for status computation */
function getLatestHumanReviewPerUser(reviews: Review[]): Map<string, Review> {
  const latest = new Map<string, Review>();
  for (const review of reviews) {
    if (review.state === "PENDING") continue;
    if (isBot(review.author)) continue;
    latest.set(review.author, review);
  }
  return latest;
}

function detectCommentAction(body: string): CommentAction {
  const lower = body.toLowerCase();
  if (lower.includes("/lgtm")) return "LGTM";
  if (lower.includes("/approve")) return "APPROVE";
  return "COMMENT";
}

function buildReviewerBreakdown(
  pr: PullRequest,
  latestReviews: Map<string, Review>,
): ReviewerBreakdownEntry[] {
  const entries: ReviewerBreakdownEntry[] = [];

  for (const [username, review] of latestReviews) {
    entries.push({
      username,
      state: review.state,
      submittedAt: review.submittedAt,
      hasNewCommitsSince: review.commitOid !== pr.headRefOid,
      source: "review",
    });
  }

  // Add requested reviewers who haven't reviewed yet
  for (const requested of pr.reviewRequests) {
    if (!latestReviews.has(requested)) {
      entries.push({
        username: requested,
        state: "PENDING",
        submittedAt: null,
        hasNewCommitsSince: false,
        source: "review",
      });
    }
  }

  // Add non-review comments (exclude PR author's own comments and bots)
  for (const comment of pr.comments) {
    if (comment.author === pr.author) continue;
    if (isBot(comment.author)) continue;
    const action = detectCommentAction(comment.body);
    entries.push({
      username: comment.author,
      state: "COMMENTED",
      submittedAt: comment.createdAt,
      hasNewCommitsSince: comment.createdAt < pr.pushedAt,
      source: "comment",
      commentAction: action,
    });
  }

  return entries;
}

function countFeedbackSinceLastPush(pr: PullRequest): number {
  const reviews = pr.reviews.filter(
    (r) => r.state !== "PENDING" && !isBot(r.author) && r.submittedAt > pr.pushedAt,
  ).length;
  const comments = pr.comments.filter(
    (c) => c.author !== pr.author && !isBot(c.author) && c.createdAt > pr.pushedAt,
  ).length;
  return reviews + comments;
}

function hasCommentedSinceLastPush(pr: PullRequest, username: string): boolean {
  return pr.comments.some(
    (c) => c.author === username && c.createdAt > pr.pushedAt,
  );
}

function hasLabel(pr: PullRequest, label: string): boolean {
  return pr.labels.some((l) => l.toLowerCase() === label.toLowerCase());
}

function hasCIFailure(pr: PullRequest): boolean {
  const ciState = pr.checkStatus.state;
  return ciState === "FAILURE" || ciState === "ERROR";
}

function isDraftOrWIP(pr: PullRequest): boolean {
  return pr.isDraft || hasLabel(pr, "do-not-merge/work-in-progress");
}

function computeAuthorStatus(pr: PullRequest): ReviewStatusResult {
  const latestReviews = getLatestReviewPerUser(pr.reviews);
  const humanReviews = getLatestHumanReviewPerUser(pr.reviews);
  const breakdown = buildReviewerBreakdown(pr, latestReviews);

  // P0: New feedback from reviewers — highest priority
  const newFeedbackCount = countFeedbackSinceLastPush(pr);
  if (newFeedbackCount > 0) {
    return {
      status: "New Feedback" as AuthorStatus,
      priority: 0,
      parenthetical: `${newFeedbackCount} new response${newFeedbackCount > 1 ? "s" : ""} since last push`,
      action: "Address feedback",
      reviewerBreakdown: breakdown,
    };
  }

  // P4: Draft or WIP — author needs to complete work
  if (isDraftOrWIP(pr)) {
    return {
      status: "WIP" as AuthorStatus,
      priority: 4,
      parenthetical: pr.isDraft ? "" : "has do-not-merge/work-in-progress label",
      action: "Complete work",
      reviewerBreakdown: breakdown,
    };
  }

  if (hasLabel(pr, "approved") && hasLabel(pr, "lgtm")) {
    // P1: Approved but CI failing
    if (hasCIFailure(pr)) {
      return {
        status: "Approved" as AuthorStatus,
        priority: 1,
        parenthetical: "CI failing",
        action: "Fix CI errors",
        reviewerBreakdown: breakdown,
      };
    }
    // P5: Approved and ready to merge
    return {
      status: "Approved" as AuthorStatus,
      priority: 5,
      parenthetical: "Ready to merge",
      action: "Merge PR",
      reviewerBreakdown: breakdown,
    };
  }

  if (hasLabel(pr, "lgtm")) {
    return {
      status: "Has LGTM" as AuthorStatus,
      priority: null,
      parenthetical: "Awaiting approval",
      action: null,
      reviewerBreakdown: breakdown,
    };
  }

  const requestedCount = pr.reviewRequests.length;
  const freshReviews = [...humanReviews.values()].filter(
    (r) => r.commitOid === pr.headRefOid,
  );
  const staleReviews = [...humanReviews.values()].filter(
    (r) => r.commitOid !== pr.headRefOid,
  );
  const pendingRequests = pr.reviewRequests.filter((r) => !humanReviews.has(r));

  let parenthetical: string;
  if (staleReviews.length > 0 && freshReviews.length === 0) {
    parenthetical = `${staleReviews.length} review${staleReviews.length > 1 ? "s" : ""} before latest push`;
  } else if (freshReviews.length > 0 && pendingRequests.length > 0) {
    parenthetical = `${freshReviews.length} of ${freshReviews.length + pendingRequests.length} reviewers responded`;
  } else if (requestedCount > 0) {
    parenthetical = `${requestedCount} reviewer${requestedCount > 1 ? "s" : ""} requested`;
  } else {
    parenthetical = "No reviewers assigned";
  }

  return {
    status: "Awaiting Review" as AuthorStatus,
    priority: null,
    parenthetical,
    action: null,
    reviewerBreakdown: breakdown,
  };
}

function computeReviewerStatus(
  pr: PullRequest,
  viewer: string,
): ReviewStatusResult {
  const latestReviews = getLatestReviewPerUser(pr.reviews);
  const humanReviews = getLatestHumanReviewPerUser(pr.reviews);
  const breakdown = buildReviewerBreakdown(pr, latestReviews);
  const viewerReview = humanReviews.get(viewer);

  if (isDraftOrWIP(pr)) {
    return {
      status: "WIP" as ReviewerStatus,
      priority: null,
      parenthetical: pr.isDraft ? "" : "has do-not-merge/work-in-progress label",
      action: null,
      reviewerBreakdown: breakdown,
    };
  }

  // P5: Approved and ready to merge
  if (hasLabel(pr, "approved") && hasLabel(pr, "lgtm")) {
    return {
      status: "Approved" as ReviewerStatus,
      priority: 5,
      parenthetical: "Ready to merge",
      action: "Merge PR",
      reviewerBreakdown: breakdown,
    };
  }

  if (hasLabel(pr, "lgtm")) {
    return {
      status: "Has LGTM" as ReviewerStatus,
      priority: null,
      parenthetical: "Awaiting approval",
      action: null,
      reviewerBreakdown: breakdown,
    };
  }

  // P2: Viewer has reviewed and new commits exist since (unless they commented after latest push)
  if (viewerReview && viewerReview.commitOid !== pr.headRefOid
      && !hasCommentedSinceLastPush(pr, viewer)) {
    return {
      status: "My Re-review Needed" as ReviewerStatus,
      priority: 2,
      parenthetical: "New commits since your review",
      action: "Re-review PR",
      reviewerBreakdown: breakdown,
    };
  }

  // Viewer requested changes and no new push since
  if (viewerReview?.state === "CHANGES_REQUESTED" && viewerReview.commitOid === pr.headRefOid) {
    return {
      status: "Awaiting Changes" as ReviewerStatus,
      priority: null,
      parenthetical: "Waiting for author to address",
      action: null,
      reviewerBreakdown: breakdown,
    };
  }

  // P3: No human reviews from anyone
  if (humanReviews.size === 0) {
    return {
      status: "Needs First Review" as ReviewerStatus,
      priority: 3,
      parenthetical: "No reviews yet",
      action: "Review PR",
      reviewerBreakdown: breakdown,
    };
  }

  // P3: Viewer is mentioned in PR comments (after Needs First Review)
  if (!viewerReview && pr.mentionedUsers.includes(viewer)) {
    return {
      status: "I'm mentioned" as ReviewerStatus,
      priority: 3,
      parenthetical: "You were tagged in a comment",
      action: "Review PR",
      reviewerBreakdown: breakdown,
    };
  }

  // Check if other human reviewers have reviewed
  const othersReviewed = [...humanReviews.entries()].filter(([u]) => u !== viewer);

  // P3: Others reviewed and new commits since their review
  const othersWithNewCommits = othersReviewed.filter(
    ([, r]) => r.commitOid !== pr.headRefOid,
  );
  if (othersWithNewCommits.length > 0 && !viewerReview) {
    return {
      status: "Team Re-review Needed" as ReviewerStatus,
      priority: 3,
      parenthetical: `${othersWithNewCommits.length} reviewer${othersWithNewCommits.length > 1 ? "s need" : " needs"} re-review`,
      action: "Review PR",
      reviewerBreakdown: breakdown,
    };
  }

  // Others requested changes (no new push) — no action needed
  const othersRequestedChanges = othersReviewed.filter(
    ([, r]) => r.state === "CHANGES_REQUESTED" && r.commitOid === pr.headRefOid,
  );
  if (othersRequestedChanges.length > 0) {
    return {
      status: "Awaiting Changes" as ReviewerStatus,
      priority: null,
      parenthetical: `${othersRequestedChanges.length} change request${othersRequestedChanges.length > 1 ? "s" : ""}`,
      action: null,
      reviewerBreakdown: breakdown,
    };
  }

  // P3: Others reviewed (no viewer review), no new commits, no change requests
  if (othersReviewed.length > 0 && !viewerReview) {
    const pendingRequests = pr.reviewRequests.filter((r) => !humanReviews.has(r));
    const summary = pendingRequests.length > 0
      ? `${othersReviewed.length} of ${othersReviewed.length + pendingRequests.length} reviewers responded`
      : `${othersReviewed.length} review${othersReviewed.length > 1 ? "s" : ""}, yours pending`;
    return {
      status: "Needs Additional Review" as ReviewerStatus,
      priority: 3,
      parenthetical: summary,
      action: "Review PR",
      reviewerBreakdown: breakdown,
    };
  }

  // Fallback — viewer has reviewed, no new commits, no issues
  return {
    status: "Approved" as ReviewerStatus,
    priority: null,
    parenthetical: "",
    action: null,
    reviewerBreakdown: breakdown,
  };
}

export function computeReviewStatus(
  pr: PullRequest,
  viewerGithubUsername: string,
): ReviewStatusResult {
  if (pr.state === "MERGED") {
    const latestReviews = getLatestReviewPerUser(pr.reviews);
    const breakdown = buildReviewerBreakdown(pr, latestReviews);
    return {
      status: "Merged",
      priority: null,
      parenthetical: "",
      action: null,
      reviewerBreakdown: breakdown,
      pushedAt: pr.pushedAt,
      pushDates: pr.pushDates,
    };
  }
  const result = pr.author === viewerGithubUsername
    ? computeAuthorStatus(pr)
    : computeReviewerStatus(pr, viewerGithubUsername);
  return { ...result, pushedAt: pr.pushedAt, pushDates: pr.pushDates };
}
