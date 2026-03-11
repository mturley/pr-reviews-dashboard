// T024: GraphQL queries for team PR search

const PR_FRAGMENT = `
  fragment PRFields on PullRequest {
    id
    number
    title
    url
    isDraft
    state
    createdAt
    updatedAt
    mergeable
    headRefOid
    repository {
      owner { login }
      name
    }
    author { login }
    labels(first: 10) {
      nodes { name }
    }
    reviewRequests(first: 20) {
      nodes {
        requestedReviewer {
          ... on User { login }
          ... on Team { name }
        }
      }
    }
    reviews(first: 50) {
      nodes {
        author { login }
        state
        submittedAt
        commit { oid }
        comments { totalCount }
      }
    }
    comments(first: 100) {
      nodes {
        author { login }
        createdAt
        body
      }
    }
    commits(last: 1) {
      nodes {
        commit {
          pushedDate
          statusCheckRollup {
            state
            contexts(first: 100) {
              totalCount
              nodes {
                ... on StatusContext {
                  state
                }
                ... on CheckRun {
                  conclusion
                  status
                }
              }
            }
          }
        }
      }
    }
  }
`;

export function buildTeamPRsQuery(members: string[], orgs: string[]): string {
  const orgFilter = orgs.map((o) => `org:${o}`).join(" ");

  const aliases = members.map((member, i) => {
    const searchQuery = `is:pr is:open author:${member} ${orgFilter}`;
    return `
      author_${i}: search(query: "${searchQuery}", type: ISSUE, first: 50) {
        nodes {
          ... on PullRequest { ...PRFields }
        }
      }
    `;
  });

  // Also search for PRs where team members are requested reviewers
  const reviewAliases = members.map((member, i) => {
    const searchQuery = `is:pr is:open review-requested:${member} ${orgFilter}`;
    return `
      reviewer_${i}: search(query: "${searchQuery}", type: ISSUE, first: 50) {
        nodes {
          ... on PullRequest { ...PRFields }
        }
      }
    `;
  });

  return `
    ${PR_FRAGMENT}
    query TeamPRs {
      ${aliases.join("\n")}
      ${reviewAliases.join("\n")}
      rateLimit {
        remaining
        resetAt
      }
    }
  `;
}

export function buildPRsByUrlsQuery(
  prs: Array<{ owner: string; repo: string; number: number }>,
): string {
  if (prs.length === 0) {
    return `query EmptyPRs { rateLimit { remaining resetAt } }`;
  }

  const aliases = prs.map(
    (pr, i) => `
    pr_${i}: repository(owner: "${pr.owner}", name: "${pr.repo}") {
      pullRequest(number: ${pr.number}) {
        ...PRFields
      }
    }
  `,
  );

  return `
    ${PR_FRAGMENT}
    query PRsByUrls {
      ${aliases.join("\n")}
      rateLimit {
        remaining
        resetAt
      }
    }
  `;
}
