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
              PRs are fetched from all configured GitHub repositories and filtered into four groups.
              Only PRs that fall into at least one group appear in the tables and recommended actions:
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>
                <span className="font-medium text-foreground">My PRs</span> — PRs you authored.
              </li>
              <li>
                <span className="font-medium text-foreground">PRs I'm Reviewing</span> — PRs where
                you've been requested as a reviewer or have submitted a review.
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
                submitted reviews since your last push. Address their feedback.
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
              <li>
                <B label="Draft" variant="neutral" /> — PR is marked as a draft.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-foreground mb-1">Review Status (for others' PRs)</h3>
            <p className="mb-1">When you are reviewing someone else's PR, ordered by priority:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <B label="My Re-review Needed" variant="danger" /> — You
                previously reviewed, but the author has pushed new commits since. You should re-review.
              </li>
              <li>
                <B label="Needs First Review" variant="danger" /> — No one
                has reviewed this PR yet. It needs your attention.
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
                <B label="Draft" variant="neutral" /> — PR is marked as a draft.
                No action needed until the author marks it ready for review.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-foreground mb-1">Action Needed</h3>
            <p className="mb-1">
              Actions are derived from the review status and sorted by priority. Not every PR has an
              action — statuses like <B label="Awaiting Review" variant="info" />,{" "}
              <B label="My Changes Requested" variant="neutral" />, or{" "}
              <B label="Draft" variant="neutral" /> mean no action is needed from you.
            </p>
            <p className="mb-1 font-medium text-foreground">Your PRs (highest priority):</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mb-2">
              <li>
                <span className="font-medium text-foreground">Address feedback</span> — Reviewers
                left <B label="New Feedback" variant="danger" /> on your PR since your last push.
              </li>
              <li>
                <span className="font-medium text-foreground">Fix CI errors</span> — Your PR is{" "}
                <B label="Approved" variant="success" /> but{" "}
                <B label="CI Failed" variant="danger" />.
              </li>
              <li>
                <span className="font-medium text-foreground">Merge PR</span> — Your PR is{" "}
                <B label="Approved" variant="success" /> and CI is passing.
              </li>
            </ul>
            <p className="mb-1 font-medium text-foreground">Others' PRs:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <span className="font-medium text-foreground">Re-review PR</span> — Author pushed
                new commits since your last review (<B label="My Re-review Needed" variant="danger" />).
              </li>
              <li>
                <span className="font-medium text-foreground">Review PR</span> — A PR{" "}
                <B label="Needs First Review" variant="danger" />,{" "}
                <B label="Team Re-review Needed" variant="warning" />, or{" "}
                <B label="Needs Additional Review" variant="warning" />.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-foreground mb-1">Priority Ordering</h3>
            <p>
              Recommended actions are sorted by three criteria in order: (1) action priority — your
              own PRs needing attention (address feedback, fix CI, merge) come first, then reviewer
              actions ordered by urgency (re-review, first review, team re-review, additional
              review); (2) Jira priority of the linked issue (Blocker &gt; Critical &gt; Major &gt;
              Normal &gt; Minor); (3) PR age, with older PRs first.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
