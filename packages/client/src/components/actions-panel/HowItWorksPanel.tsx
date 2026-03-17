import { HelpCircle, MessageSquareWarning, CircleX, Eye, GitMerge, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { StatusVariant } from "@/components/shared/StatusBadge";

type BadgeInfo = { label: string; variant: StatusVariant };

const B = ({ label, variant }: BadgeInfo) => (
  <StatusBadge label={label} variant={variant} className="inline-flex align-baseline" />
);

export function HowItWorksPanel() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <HelpCircle className="h-4 w-4" />
          How does this work?
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[80vw] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>How It Works</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground space-y-4">
          <section>
            <h3 className="font-semibold text-foreground mb-1">Which PRs are included?</h3>
            <p className="mb-1">
              PRs are fetched from all configured GitHub repositories. When{" "}
              <span className="font-medium text-foreground">"Ignore PRs from other scrums"</span> is
              enabled (the default), only PRs authored by configured scrum team members (and
              Dependabot) are shown. PRs are then filtered into four groups — only PRs that fall
              into at least one group appear in the tables and recommended actions:
            </p>
            <ol className="list-decimal list-outside space-y-1 ml-6">
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
            <ul className="list-disc list-outside space-y-1 ml-6">
              <li>
                <B label="New Feedback" variant="danger" /> — Reviewers have
                submitted reviews or comments since your last push that require your attention.
                Positive signals like approvals, <code className="text-xs bg-muted px-1 rounded">/lgtm</code>,
                and <code className="text-xs bg-muted px-1 rounded">/approve</code> commands are not
                counted as feedback. Bot reviews are also excluded.
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
            <ul className="list-disc list-outside space-y-1 ml-6">
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
                <B label="Awaiting Changes" variant="info" /> — You or other
                reviewers requested changes and no new commits have been pushed yet. Waiting on the author.
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
              Hover any review status badge to see a chronological timeline of all reviews and
              comments. A dashed "Commits pushed" divider shows when the author last pushed code.
              Entries above the divider are stale (dimmed) — entries below are current. Multiple
              consecutive comments from the same user are collapsed into one line with a count.
            </p>
            <div className="inline-block ml-12 rounded border border-border bg-popover p-3 space-y-1 text-xs">
              <p className="font-semibold text-foreground mb-2">Reviewer Breakdown</p>
              <div className="flex items-center gap-2 whitespace-nowrap opacity-50">
                <span className="text-muted-foreground min-w-[70px]">Feb 9</span>
                <span className="font-mono font-medium min-w-[100px]">reviewer1</span>
                <B label="Changes requested" variant="danger" />
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap opacity-50">
                <span className="text-muted-foreground min-w-[70px]">Feb 10</span>
                <span className="font-mono font-medium min-w-[100px]">reviewer2</span>
                <B label="Commented" variant="neutral" />
                <span className="text-muted-foreground">&times;3</span>
              </div>
              <div className="flex items-center gap-2 py-1">
                <div className="flex-1 border-t border-dashed border-yellow-500/50" />
                <span className="text-[10px] text-yellow-500 font-medium whitespace-nowrap">
                  Commits pushed (2d ago)
                </span>
                <div className="flex-1 border-t border-dashed border-yellow-500/50" />
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span className="text-muted-foreground min-w-[70px]">yesterday</span>
                <span className="font-mono font-medium min-w-[100px]">reviewer1</span>
                <B label="Approved" variant="success" />
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-foreground mb-1">Action Needed</h3>
            <p className="mb-1">
              Actions are derived from the review status and sorted by priority. Not every PR has an
              action — statuses like <B label="Awaiting Review" variant="info" /> or{" "}
              <B label="Awaiting Changes" variant="info" /> mean no action is needed from you.
            </p>
            <p className="mb-1 font-medium text-foreground">In priority order:</p>
            <ul className="list-disc list-outside space-y-1 ml-6">
              <li>
                <MessageSquareWarning className="inline h-3.5 w-3.5 text-orange-500" />{" "}
                <span className="font-medium text-foreground">Address feedback</span> (your PR) — Reviewers
                left <B label="New Feedback" variant="danger" /> since your last push.
              </li>
              <li>
                <CircleX className="inline h-3.5 w-3.5 text-red-500" />{" "}
                <span className="font-medium text-foreground">Fix CI errors</span> (your PR) — Your PR is{" "}
                <B label="Approved" variant="success" /> but{" "}
                <B label="CI Failed" variant="danger" />.
              </li>
              <li>
                <Eye className="inline h-3.5 w-3.5 text-blue-500" />{" "}
                <span className="font-medium text-foreground">Re-review PR</span> (others' PR) — Author pushed
                new commits since your last review (<B label="My Re-review Needed" variant="danger" />).
              </li>
              <li>
                <Eye className="inline h-3.5 w-3.5 text-blue-500" />{" "}
                <span className="font-medium text-foreground">Review PR</span> (others' PR) — A PR{" "}
                <B label="Needs First Review" variant="danger" />,{" "}
                <B label="Team Re-review Needed" variant="warning" />, or{" "}
                <B label="Needs Additional Review" variant="warning" />.
              </li>
              <li>
                <PenLine className="inline h-3.5 w-3.5 text-muted-foreground" />{" "}
                <span className="font-medium text-foreground">Complete work</span> (your PR) — Your PR is{" "}
                <B label="WIP" variant="warning" />. Finish and mark ready for review.
              </li>
              <li>
                <GitMerge className="inline h-3.5 w-3.5 text-purple-500" />{" "}
                <span className="font-medium text-foreground">Merge PR</span> (any PR) — PR is{" "}
                <B label="Approved" variant="success" /> and CI is passing.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-foreground mb-1">Priority Ordering</h3>
            <p>
              Recommended actions are sorted by four criteria in order: (1) action priority —
              address feedback, fix CI, re-review, review, complete draft, merge; (2) status
              sub-priority within the same action level — e.g. "Needs First Review" ranks above
              "Team Re-review Needed"; (3) Jira priority of the linked issue
              (Blocker &gt; Critical &gt; Major &gt; Normal &gt; Minor); (4) PR age, with older PRs
              first. PRs without a linked Jira issue are treated as Normal priority.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
