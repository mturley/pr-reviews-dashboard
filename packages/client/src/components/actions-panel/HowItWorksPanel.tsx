import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { StatusVariant } from "@/components/shared/StatusBadge";

type BadgeInfo = { label: string; variant: StatusVariant };

const B = ({ label, variant }: BadgeInfo) => (
  <StatusBadge label={label} variant={variant} className="inline-flex align-baseline" />
);

export function HowItWorksPanel() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card">
      <Button
        variant="ghost"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-start gap-2 px-4 py-3 text-left"
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="font-semibold">How It Works</span>
      </Button>
      {expanded && (
        <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground space-y-4">
          <section>
            <h3 className="font-semibold text-foreground mb-1">Which PRs are included?</h3>
            <p className="mb-1">
              PRs are fetched from all configured GitHub repositories. When{" "}
              <span className="font-medium text-foreground">"Ignore PRs from other scrums"</span> is
              enabled (the default), only PRs authored by configured scrum team members (and
              Dependabot) are shown. PRs are then filtered into four groups — only PRs that fall
              into at least one group appear in the tables and recommended actions:
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>
                <span className="font-medium text-foreground">My PRs</span> — PRs you authored.
              </li>
              <li>
                <span className="font-medium text-foreground">PRs I'm Reviewing</span> — PRs where
                you have submitted a review or are mentioned in a comment. PRs where you've only
                been requested as a reviewer (but haven't reviewed yet) appear in the other groups below.
              </li>
              <li>
                <span className="font-medium text-foreground">Sprint Review PRs</span> — PRs by
                anyone that are linked to a Jira issue in a "Review" state for the current sprint.
              </li>
              <li>
                <span className="font-medium text-foreground">Team PRs with No Jira</span> — PRs by
                scrum team members that have no linked Jira issue (these may need attention).
              </li>
            </ol>
          </section>

          <section>
            <h3 className="font-semibold text-foreground mb-1">Review Status (for your PRs)</h3>
            <p className="mb-1">When you are the author of a PR, ordered by priority:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <B label="New Feedback" variant="danger" /> — Reviewers have
                submitted reviews or comments since your last push. Address their feedback.
              </li>
              <li>
                <B label="WIP" variant="warning" /> — PR is marked as a draft or has the{" "}
                <code className="text-xs bg-muted px-1 rounded">do-not-merge/work-in-progress</code>{" "}
                label. Complete the work and mark ready for review.
              </li>
              <li>
                <B label="Approved" variant="success" /> — PR has both{" "}
                <code className="text-xs bg-muted px-1 rounded">approved</code> and{" "}
                <code className="text-xs bg-muted px-1 rounded">lgtm</code> labels.
                If CI is failing, fix it; otherwise merge.
              </li>
              <li>
                <B label="Has LGTM" variant="success" /> — PR has the{" "}
                <code className="text-xs bg-muted px-1 rounded">lgtm</code> label but not yet{" "}
                <code className="text-xs bg-muted px-1 rounded">approved</code>. Waiting for approval.
              </li>
              <li>
                <B label="Awaiting Review" variant="info" /> — No new
                feedback; waiting for reviewers.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-foreground mb-1">Review Status (for others' PRs)</h3>
            <p className="mb-1">When you are reviewing someone else's PR, ordered by priority:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <B label="My Re-review Needed" variant="danger" /> — You
                previously reviewed, but the author has pushed new commits since and you haven't
                commented or reviewed again. You should re-review.
              </li>
              <li>
                <B label="Needs First Review" variant="danger" /> — No one
                has reviewed this PR yet. It needs your attention.
              </li>
              <li>
                <B label="I'm mentioned" variant="danger" /> — You were tagged
                in a comment on this PR. You should take a look.
              </li>
              <li>
                <B label="Team Re-review Needed" variant="warning" /> — Other
                reviewers need to re-review after new commits, and you haven't reviewed yet.
              </li>
              <li>
                <B label="Needs Additional Review" variant="warning" /> —
                Others have reviewed but you haven't yet.
              </li>
              <li>
                <B label="Approved" variant="success" /> — PR has both{" "}
                <code className="text-xs bg-muted px-1 rounded">approved</code> and{" "}
                <code className="text-xs bg-muted px-1 rounded">lgtm</code> labels. Ready to merge.
              </li>
              <li>
                <B label="Has LGTM" variant="success" /> — Awaiting approval.
              </li>
              <li>
                <B label="My Changes Requested" variant="neutral" /> — You
                requested changes and no new commits have been pushed yet. Waiting on the author.
              </li>
              <li>
                <B label="Changes Requested (by others)" variant="neutral" />{" "}
                — Other reviewers requested changes (no new commits since). Waiting on the author.
              </li>
              <li>
                <B label="WIP" variant="neutral" /> — PR is marked as a draft or
                has the{" "}
                <code className="text-xs bg-muted px-1 rounded">do-not-merge/work-in-progress</code>{" "}
                label. No action needed until the author marks it ready for review.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-foreground mb-1">Reviewer Breakdown Tooltip</h3>
            <p className="mb-2">
              Hover any review status badge to see a breakdown of individual reviewers. The tooltip
              shows each reviewer who has submitted a review (pending reviewers are excluded), along
              with their review state and when they reviewed. If new commits have been pushed since
              a reviewer's review, a warning indicator is shown.
            </p>
            <div className="inline-block ml-12 rounded border border-border bg-popover p-3 space-y-2 text-xs">
              <p className="font-semibold text-foreground">Reviewer Breakdown</p>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span className="text-muted-foreground min-w-[70px]">yesterday</span>
                <span className="font-mono font-medium min-w-[100px]">reviewer1</span>
                <B label="APPROVED" variant="success" />
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span className="text-muted-foreground min-w-[70px]">3d ago</span>
                <span className="font-mono font-medium min-w-[100px]">reviewer2</span>
                <B label="CHANGES REQUESTED" variant="danger" />
                <span className="text-yellow-500">⚠ commits since review</span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-foreground mb-1">Action Needed</h3>
            <p className="mb-1">
              Actions are derived from the review status and sorted by priority. Not every PR has an
              action — statuses like <B label="Awaiting Review" variant="info" /> or{" "}
              <B label="My Changes Requested" variant="neutral" /> mean no action is needed from you.
            </p>
            <p className="mb-1 font-medium text-foreground">In priority order:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <span className="font-medium text-foreground">Address feedback</span> (your PR) — Reviewers
                left <B label="New Feedback" variant="danger" /> since your last push.
              </li>
              <li>
                <span className="font-medium text-foreground">Fix CI errors</span> (your PR) — Your PR is{" "}
                <B label="Approved" variant="success" /> but{" "}
                <B label="CI Failed" variant="danger" />.
              </li>
              <li>
                <span className="font-medium text-foreground">Re-review PR</span> (others' PR) — Author pushed
                new commits since your last review (<B label="My Re-review Needed" variant="danger" />).
              </li>
              <li>
                <span className="font-medium text-foreground">Review PR</span> (others' PR) — A PR{" "}
                <B label="Needs First Review" variant="danger" />,{" "}
                <B label="Team Re-review Needed" variant="warning" />, or{" "}
                <B label="Needs Additional Review" variant="warning" />.
              </li>
              <li>
                <span className="font-medium text-foreground">Complete work</span> (your PR) — Your PR is{" "}
                <B label="WIP" variant="warning" />. Finish and mark ready for review.
              </li>
              <li>
                <span className="font-medium text-foreground">Merge PR</span> (any PR) — PR is{" "}
                <B label="Approved" variant="success" /> and CI is passing.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-foreground mb-1">Priority Ordering</h3>
            <p>
              Recommended actions are sorted by three criteria in order: (1) action priority —
              address feedback, fix CI, re-review, review, complete draft, merge; (2) Jira priority
              of the linked issue (Blocker &gt; Critical &gt; Major &gt; Normal &gt; Minor); (3) PR
              age, with older PRs first.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
