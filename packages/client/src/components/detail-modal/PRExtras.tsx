import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Loader2, ArrowUpDown, ShieldCheck, ShieldX, MessageSquare } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { trpc } from "@/trpc";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatUsername, isBot } from "@/lib/bot-users";
import type { Review, ReviewState } from "../../../../server/src/types/pr";

const COLLAPSE_HEIGHT = 200;

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const markdownComponents = {
  a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 dark:text-blue-400 hover:underline"
      {...props}
    >
      {children}
    </a>
  ),
};

const markdownClassName = "space-y-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:rounded [&_pre]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground [&_blockquote]:pl-3 [&_blockquote]:italic [&_img]:max-w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1";

function reviewStateLabel(state: ReviewState): { text: string; className: string } {
  switch (state) {
    case "APPROVED":
      return { text: "Approved", className: "text-green-600 dark:text-green-400" };
    case "CHANGES_REQUESTED":
      return { text: "Changes requested", className: "text-red-600 dark:text-red-400" };
    case "COMMENTED":
      return { text: "Commented", className: "text-muted-foreground" };
    case "DISMISSED":
      return { text: "Dismissed", className: "text-muted-foreground" };
    case "PENDING":
      return { text: "Pending", className: "text-muted-foreground" };
  }
}

function ReviewStateIcon({ state }: { state: ReviewState }) {
  switch (state) {
    case "APPROVED":
      return <ShieldCheck className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />;
    case "CHANGES_REQUESTED":
      return <ShieldX className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />;
    default:
      return <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function useCollapsible(children: React.ReactNode) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const measure = useCallback(() => {
    if (contentRef.current) {
      setNeedsCollapse(contentRef.current.scrollHeight > COLLAPSE_HEIGHT);
    }
  }, []);

  useEffect(() => {
    measure();
  }, [measure, children]);

  const toggle = useCallback(() => setExpanded((prev) => !prev), []);

  return { contentRef, needsCollapse, expanded, toggle };
}

function CollapsibleBody({ children, renderHeader }: {
  children: React.ReactNode;
  renderHeader?: (showLessButton: React.ReactNode | null) => React.ReactNode;
}) {
  const { contentRef, needsCollapse, expanded, toggle } = useCollapsible(children);

  const showLessButton = needsCollapse && expanded ? (
    <Button
      variant="ghost"
      size="sm"
      className="h-5 px-1.5 text-xs text-muted-foreground"
      onClick={toggle}
    >
      Show less
    </Button>
  ) : null;

  return (
    <div>
      {renderHeader?.(showLessButton)}
      <div
        ref={contentRef}
        className="relative overflow-hidden transition-[max-height] duration-200"
        style={needsCollapse && !expanded ? { maxHeight: COLLAPSE_HEIGHT } : undefined}
      >
        {children}
        {needsCollapse && !expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-muted/80 to-transparent pointer-events-none" />
        )}
      </div>
      {needsCollapse && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-xs text-muted-foreground mt-1"
          onClick={toggle}
        >
          {expanded ? "Show less" : "Show more"}
        </Button>
      )}
    </div>
  );
}

type TimelineEntry =
  | { type: "comment"; timestamp: string; id: string; author: string; createdAt: string; updatedAt: string; body: string }
  | { type: "review"; timestamp: string; review: Review; reviewUrl: string };

interface PRExtrasProps {
  owner: string;
  repo: string;
  pullNumber: number;
  reviews: Review[];
}

export function PRExtras({ owner, repo, pullNumber, reviews }: PRExtrasProps) {
  const extrasQuery = trpc.github.getPRExtras.useQuery({ owner, repo, pullNumber });
  const [newestFirst, setNewestFirst] = useState(false);
  const [humanOnly, setHumanOnly] = useState(false);

  const prUrl = `https://github.com/${owner}/${repo}/pull/${pullNumber}`;

  const timeline = useMemo(() => {
    if (!extrasQuery.data) return [];

    const entries: TimelineEntry[] = [];

    // Add comments
    for (const c of extrasQuery.data.comments) {
      if (humanOnly && isBot(c.author)) continue;
      entries.push({
        type: "comment",
        timestamp: c.createdAt,
        id: c.id,
        author: c.author,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        body: c.body,
      });
    }

    // Add reviews with content
    for (const r of reviews) {
      if (r.state === "PENDING") continue;
      if (!r.body.trim() && r.commentCount === 0) continue;
      if (humanOnly && isBot(r.author)) continue;
      const reviewUrl = r.databaseId
        ? `${prUrl}#pullrequestreview-${r.databaseId}`
        : `${prUrl}/files`;
      entries.push({
        type: "review",
        timestamp: r.submittedAt,
        review: r,
        reviewUrl,
      });
    }

    entries.sort((a, b) => {
      const diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      return newestFirst ? -diff : diff;
    });

    return entries;
  }, [extrasQuery.data, reviews, newestFirst, humanOnly, prUrl]);

  if (extrasQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading description and comments...
      </div>
    );
  }

  if (extrasQuery.error || !extrasQuery.data) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Failed to load description and comments.
      </p>
    );
  }

  const { body } = extrasQuery.data;

  return (
    <div className="space-y-5">
      {/* Description */}
      {body && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">Description</h3>
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm prose-sm max-w-none">
            <CollapsibleBody>
              <div className={markdownClassName}>
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSanitize]}
                  components={markdownComponents}
                >
                  {body}
                </Markdown>
              </div>
            </CollapsibleBody>
          </div>
        </div>
      )}

      {/* Human only toggle + sort */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <Switch checked={humanOnly} onCheckedChange={setHumanOnly} className="scale-75" />
          Human comments only
        </label>
        {timeline.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-xs text-muted-foreground"
            onClick={() => setNewestFirst((prev) => !prev)}
          >
            <ArrowUpDown className="h-3 w-3 mr-1" />
            {newestFirst ? "Newest first" : "Oldest first"}
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {timeline.length} item{timeline.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Unified timeline */}
      {timeline.length === 0 && (
        <p className="text-sm text-muted-foreground italic">No comments or reviews.</p>
      )}

      {timeline.length > 0 && (
        <div className="space-y-3">
          {timeline.map((entry) => {
            if (entry.type === "comment") {
              return (
                <div key={entry.id} className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                  <CollapsibleBody
                    renderHeader={(showLess) => (
                      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{formatUsername(entry.author)}</span>
                        <span>·</span>
                        <span>{formatTimestamp(entry.createdAt)}</span>
                        {entry.updatedAt !== entry.createdAt && (
                          <>
                            <span>·</span>
                            <span>edited {formatTimestamp(entry.updatedAt)}</span>
                          </>
                        )}
                        {showLess}
                      </div>
                    )}
                  >
                    <div className="text-sm">
                      <div className={markdownClassName}>
                        <Markdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeSanitize]}
                          components={markdownComponents}
                        >
                          {entry.body}
                        </Markdown>
                      </div>
                    </div>
                  </CollapsibleBody>
                </div>
              );
            }

            const { review, reviewUrl } = entry;
            const stateInfo = reviewStateLabel(review.state);
            return (
              <div key={`review-${review.author}-${review.submittedAt}`} className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                <CollapsibleBody
                  renderHeader={(showLess) => (
                    <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                      <ReviewStateIcon state={review.state} />
                      <span className="font-medium text-foreground">{formatUsername(review.author)}</span>
                      <span className={`font-medium ${stateInfo.className}`}>{stateInfo.text}</span>
                      <span>·</span>
                      <span>{formatTimestamp(review.submittedAt)}</span>
                      {showLess}
                    </div>
                  )}
                >
                  {review.body.trim() && (
                    <div className="text-sm mt-2">
                      <div className={markdownClassName}>
                        <Markdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeSanitize]}
                          components={markdownComponents}
                        >
                          {review.body}
                        </Markdown>
                      </div>
                    </div>
                  )}
                  {review.commentCount > 0 && (
                    <div className="mt-2">
                      <a
                        href={reviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {review.commentCount} inline comment{review.commentCount !== 1 ? "s" : ""}
                      </a>
                    </div>
                  )}
                </CollapsibleBody>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
