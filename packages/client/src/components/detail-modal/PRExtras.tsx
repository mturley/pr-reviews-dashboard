import { useState, useMemo } from "react";
import { Loader2, ArrowUpDown } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { trpc } from "@/trpc";
import { Button } from "@/components/ui/button";
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

  const sortedComments = useMemo(() => {
    if (!extrasQuery.data) return [];
    const comments = [...extrasQuery.data.comments];
    comments.sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return newestFirst ? -diff : diff;
    });
    return comments;
  }, [extrasQuery.data, newestFirst]);

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
    </div>
  );
}
