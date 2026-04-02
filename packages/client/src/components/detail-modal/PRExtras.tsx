import { useState, useMemo } from "react";
import { Loader2, ArrowUpDown, ChevronRight, Check, FileCode } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { trpc } from "@/trpc";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { formatUsername } from "@/lib/bot-users";

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

interface PRExtrasProps {
  owner: string;
  repo: string;
  pullNumber: number;
}

export function PRExtras({ owner, repo, pullNumber }: PRExtrasProps) {
  const extrasQuery = trpc.github.getPRExtras.useQuery({ owner, repo, pullNumber });
  const [newestFirst, setNewestFirst] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  const sortedComments = useMemo(() => {
    if (!extrasQuery.data) return [];
    const comments = [...extrasQuery.data.comments];
    comments.sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return newestFirst ? -diff : diff;
    });
    return comments;
  }, [extrasQuery.data, newestFirst]);

  const { unresolvedThreads, resolvedThreads } = useMemo(() => {
    if (!extrasQuery.data?.reviewThreads) return { unresolvedThreads: [], resolvedThreads: [] };
    const unresolved = extrasQuery.data.reviewThreads.filter((t) => !t.isResolved);
    const resolved = extrasQuery.data.reviewThreads.filter((t) => t.isResolved);
    return { unresolvedThreads: unresolved, resolvedThreads: resolved };
  }, [extrasQuery.data]);

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

  const { body, comments } = extrasQuery.data;

  return (
    <div className="space-y-5">
      {/* Description */}
      {body && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">Description</h3>
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm prose-sm max-w-none">
            <div className={markdownClassName}>
              <Markdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
                components={markdownComponents}
              >
                {body}
              </Markdown>
            </div>
          </div>
        </div>
      )}

      {/* Comments */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-xs font-semibold text-muted-foreground">
            Comments
            <span className="font-normal ml-1">({comments.length})</span>
          </h3>
          {sortedComments.length > 1 && (
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
        </div>

        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground italic">No comments.</p>
        )}

        {sortedComments.length > 0 && (
          <div className="space-y-3">
            {sortedComments.map((comment) => (
              <div key={comment.id} className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{formatUsername(comment.author)}</span>
                  <span>·</span>
                  <span>{formatTimestamp(comment.createdAt)}</span>
                  {comment.updatedAt !== comment.createdAt && (
                    <>
                      <span>·</span>
                      <span>edited {formatTimestamp(comment.updatedAt)}</span>
                    </>
                  )}
                </div>
                <div className="text-sm">
                  <div className={markdownClassName}>
                    <Markdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeSanitize]}
                      components={markdownComponents}
                    >
                      {comment.body}
                    </Markdown>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Comments (threaded code review comments) */}
      {(unresolvedThreads.length > 0 || resolvedThreads.length > 0) && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xs font-semibold text-muted-foreground">
              Review Comments
              <span className="font-normal ml-1">
                ({unresolvedThreads.length + resolvedThreads.length})
              </span>
            </h3>
            {unresolvedThreads.length > 0 && resolvedThreads.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {unresolvedThreads.length} unresolved, {resolvedThreads.length} resolved
              </span>
            )}
          </div>

          {/* Unresolved threads */}
          {unresolvedThreads.length > 0 && (
            <div className="space-y-3">
              {unresolvedThreads.map((thread) => (
                <ReviewThreadCard key={thread.id} thread={thread} />
              ))}
            </div>
          )}

          {/* Resolved threads (collapsible) */}
          {resolvedThreads.length > 0 && (
            <Collapsible open={showResolved} onOpenChange={setShowResolved}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-6 px-2 text-xs text-muted-foreground ${unresolvedThreads.length > 0 ? "mt-3" : ""}`}
                >
                  <ChevronRight className={`h-3 w-3 mr-1 transition-transform ${showResolved ? "rotate-90" : ""}`} />
                  {resolvedThreads.length} resolved thread{resolvedThreads.length !== 1 ? "s" : ""}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-3 mt-2">
                  {resolvedThreads.map((thread) => (
                    <ReviewThreadCard key={thread.id} thread={thread} />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}
    </div>
  );
}

interface ReviewThreadProps {
  thread: {
    id: string;
    path: string;
    line: number | null;
    isResolved: boolean;
    isOutdated: boolean;
    comments: Array<{
      id: string;
      author: string;
      createdAt: string;
      updatedAt: string;
      body: string;
    }>;
  };
}

function ReviewThreadCard({ thread }: ReviewThreadProps) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${thread.isResolved ? "border-border bg-muted/10 opacity-75" : "border-border bg-muted/20"}`}>
      {/* Thread header: file path + status */}
      <div className="flex items-center gap-2 mb-2 text-xs">
        <FileCode className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="font-mono text-muted-foreground truncate">
          {thread.path}{thread.line != null ? `:${thread.line}` : ""}
        </span>
        {thread.isResolved && (
          <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400 shrink-0">
            <Check className="h-3 w-3" />
            Resolved
          </span>
        )}
        {thread.isOutdated && (
          <span className="text-yellow-600 dark:text-yellow-400 shrink-0">Outdated</span>
        )}
      </div>

      {/* Thread comments */}
      <div className="space-y-2">
        {thread.comments.map((comment, idx) => (
          <div key={comment.id} className={idx > 0 ? "border-t border-border/50 pt-2" : ""}>
            <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{formatUsername(comment.author)}</span>
              <span>·</span>
              <span>{formatTimestamp(comment.createdAt)}</span>
              {comment.updatedAt !== comment.createdAt && (
                <>
                  <span>·</span>
                  <span>edited {formatTimestamp(comment.updatedAt)}</span>
                </>
              )}
            </div>
            <div className="text-sm">
              <div className={markdownClassName}>
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSanitize]}
                  components={markdownComponents}
                >
                  {comment.body}
                </Markdown>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
