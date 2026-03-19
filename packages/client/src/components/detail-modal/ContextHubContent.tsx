import { useSlackThreads } from "@/hooks/useSlackThreads";
import type { SlackThread } from "../../../../server/src/types/slack";
import { Loader2 } from "lucide-react";

interface ContextHubContentProps {
  targetUrls: string[];
  targetType: "pr" | "jira";
}

export function ContextHubContent({ targetUrls }: ContextHubContentProps) {
  const { threadsByUrl, isLoading, slackEnabled } = useSlackThreads(targetUrls);

  // Collect all threads across all target URLs, deduplicated by permalink
  const allThreads: SlackThread[] = [];
  const seen = new Set<string>();
  for (const url of targetUrls) {
    for (const thread of threadsByUrl[url] ?? []) {
      if (!seen.has(thread.permalink)) {
        seen.add(thread.permalink);
        allThreads.push(thread);
      }
    }
  }

  const hasAnyContent = allThreads.length > 0;
  const hasAnyIntegration = slackEnabled; // Will expand when Google/Email are added

  if (!hasAnyIntegration) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No integrations configured.</p>
        <p className="text-xs mt-1">
          Add a Slack token or Google account to see contextual information here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Slack Threads */}
      {slackEnabled && (
        <section>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            Slack Threads
            {allThreads.length > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {allThreads.length}
              </span>
            )}
          </h3>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching Slack...
            </div>
          ) : allThreads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Slack threads found mentioning this item.</p>
          ) : (
            <div className="space-y-2">
              {allThreads.map((thread) => (
                <a
                  key={thread.permalink}
                  href={thread.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-blue-600 dark:text-blue-400">#{thread.channelName}</span>
                    <span className="text-muted-foreground">by {thread.author}</span>
                    {thread.replyCount > 0 && (
                      <span className="text-muted-foreground">· {thread.replyCount} replies</span>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {thread.matchedUrl.includes("github.com") ? "PR link" : "Issue link"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{thread.snippet}</p>
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Calendar Events — placeholder for Step 4 */}
      {/* Will be added when Google Calendar service is implemented */}

      {/* Emails — placeholder for future phase */}
      {/* Will be added when Gmail integration is implemented */}

      {!hasAnyContent && !isLoading && (
        <p className="text-center text-sm text-muted-foreground py-4">
          No external context found for this item.
        </p>
      )}
    </div>
  );
}
