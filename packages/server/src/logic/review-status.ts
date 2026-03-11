// T027: Review status computation (FR-041 Author Status, FR-042 Reviewer Status)

import type {
  PullRequest,
  ReviewStatusResult,
  AuthorStatus,
  ReviewerStatus,
  ReviewerBreakdownEntry,
  Review,
} from "../types/pr.js";

function getLatestReviewPerUser(reviews: Review[]): Map<string, Review> {
  const latest = new Map<string, Review>();
  // Reviews are returned chronologically; later ones override earlier
  for (const review of reviews) {
    if (review.state === "PENDING") continue;
    latest.set(review.author, review);
  }
  return latest;
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
      });
    }
  }

  return entries;
}

function countReviewsSinceLastPush(pr: PullRequest): number {
  return pr.reviews.filter(
    (r) => r.state !== "PENDING" && r.submittedAt > pr.pushedAt,
  ).length;
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
  const breakdown = buildReviewerBreakdown(pr, latestReviews);

  // P0: New feedback from reviewers — highest priority
  const newReviewCount = countReviewsSinceLastPush(pr);
  if (newReviewCount > 0) {
    return {
      status: "New Feedback" as AuthorStatus,
      priority: 0,
      parenthetical: `${newReviewCount} new review${newReviewCount > 1 ? "s" : ""} since last push`,
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
        parenthetical: `${pr.checkStatus.failureCount} check${pr.checkStatus.failureCount !== 1 ? "s" : ""} failed`,
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
  const reviewedCount = latestReviews.size;
  return {
    status: "Awaiting Review" as AuthorStatus,
    priority: null,
    parenthetical:
      reviewedCount > 0
        ? `${reviewedCount} reviewed`
        : requestedCount > 0
          ? `${requestedCount} reviewer${requestedCount > 1 ? "s" : ""} requested`
          : "No reviewers assigned",
    action: null,
    reviewerBreakdown: breakdown,
  };
}

function computeReviewerStatus(
  pr: PullRequest,
  viewer: string,
): ReviewStatusResult {
  const latestReviews = getLatestReviewPerUser(pr.reviews);
  const breakdown = buildReviewerBreakdown(pr, latestReviews);
  const viewerReview = latestReviews.get(viewer);

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

  // P2: Viewer has reviewed and new commits exist since
  if (viewerReview && viewerReview.commitOid !== pr.headRefOid) {
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
      status: "My Changes Requested" as ReviewerStatus,
      priority: null,
      parenthetical: "Waiting for author to address",
      action: null,
      reviewerBreakdown: breakdown,
    };
  }

  // P3: No reviews from anyone
  if (latestReviews.size === 0) {
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

  // Check if other reviewers have reviewed
  const othersReviewed = [...latestReviews.entries()].filter(([u]) => u !== viewer);

  // P3: Others reviewed and new commits since their review
  const othersWithNewCommits = othersReviewed.filter(
    ([, r]) => r.commitOid !== pr.headRefOid,
  );
  if (othersWithNewCommits.length > 0 && !viewerReview) {
    return {
      status: "Team Re-review Needed" as ReviewerStatus,
      priority: 3,
      parenthetical: `${othersWithNewCommits.length} reviewer${othersWithNewCommits.length > 1 ? "s" : ""} need re-review`,
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
      status: "Changes Requested (by others)" as ReviewerStatus,
      priority: null,
      parenthetical: `${othersRequestedChanges.length} change request${othersRequestedChanges.length > 1 ? "s" : ""}`,
      action: null,
      reviewerBreakdown: breakdown,
    };
  }

  // P3: Others reviewed (no viewer review), no new commits, no change requests
  if (othersReviewed.length > 0 && !viewerReview) {
    return {
      status: "Needs Additional Review" as ReviewerStatus,
      priority: 3,
      parenthetical: `${othersReviewed.length} review${othersReviewed.length > 1 ? "s" : ""} so far`,
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
  if (pr.author === viewerGithubUsername) {
    return computeAuthorStatus(pr);
  }
  return computeReviewerStatus(pr, viewerGithubUsername);
}
