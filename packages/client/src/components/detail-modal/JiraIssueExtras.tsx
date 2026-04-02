import { useState, useMemo } from "react";
import { Loader2, ArrowUpDown } from "lucide-react";
import { trpc } from "@/trpc";
import { JiraMarkup } from "../shared/JiraMarkup";
import { Button } from "@/components/ui/button";
import { CollapsibleBody } from "./CollapsibleBody";

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

interface JiraIssueExtrasProps {
  issueKey: string;
  description: string | null;
}

export function JiraIssueExtras({ issueKey, description }: JiraIssueExtrasProps) {
  const commentsQuery = trpc.jira.getIssueComments.useQuery({ key: issueKey });
  const [newestFirst, setNewestFirst] = useState(true);

  const sortedComments = useMemo(() => {
    if (!commentsQuery.data) return [];
    const comments = [...commentsQuery.data.comments];
    comments.sort((a, b) => {
      const diff = new Date(a.created).getTime() - new Date(b.created).getTime();
      return newestFirst ? -diff : diff;
    });
    return comments;
  }, [commentsQuery.data, newestFirst]);

  return (
    <div className="space-y-5">
      {/* Description */}
      {description && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">Description</h3>
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm prose-sm max-w-none">
            <CollapsibleBody>
              <JiraMarkup text={description} className="space-y-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:text-sm [&_h3]:font-bold [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:rounded [&_pre]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground [&_blockquote]:pl-3 [&_blockquote]:italic" />
            </CollapsibleBody>
          </div>
        </div>
      )}

      {/* Comments */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-xs font-semibold text-muted-foreground">
            Comments
            {commentsQuery.data && (
              <span className="font-normal ml-1">({commentsQuery.data.comments.length})</span>
            )}
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

        {commentsQuery.isLoading && (
          <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading comments...
          </div>
        )}

        {commentsQuery.error && (
          <p className="text-sm text-muted-foreground italic">
            Failed to load comments.
          </p>
        )}

        {commentsQuery.data && commentsQuery.data.comments.length === 0 && (
          <p className="text-sm text-muted-foreground italic">No comments.</p>
        )}

        {sortedComments.length > 0 && (
          <div className="space-y-3">
            {sortedComments.map((comment) => (
              <div key={comment.id} className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                <CollapsibleBody
                  renderHeader={(showLess) => (
                    <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{comment.authorDisplayName}</span>
                      <span>·</span>
                      <span>{formatTimestamp(comment.created)}</span>
                      {comment.updated !== comment.created && (
                        <>
                          <span>·</span>
                          <span>edited {formatTimestamp(comment.updated)}</span>
                        </>
                      )}
                      {showLess}
                    </div>
                  )}
                >
                  <div className="text-sm">
                    <JiraMarkup text={comment.body} className="space-y-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:rounded [&_pre]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground [&_blockquote]:pl-3 [&_blockquote]:italic" />
                  </div>
                </CollapsibleBody>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
