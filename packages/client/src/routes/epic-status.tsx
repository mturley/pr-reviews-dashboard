// T067: Epic Status route view

import { useState, useMemo } from "react";
import { trpc } from "../trpc";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingIndicator } from "@/components/shared/LoadingIndicator";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { JiraIssue } from "../../../server/src/types/jira";

export default function EpicStatus() {
  const [epicKey, setEpicKey] = useState("");
  const [submittedKey, setSubmittedKey] = useState("");

  const epicQuery = trpc.jira.getEpicIssues.useQuery(
    { epicKey: submittedKey, includeClosedResolved: true },
    { enabled: !!submittedKey },
  );

  // Phase 2: Fetch linked PRs
  const linkedPRUrls = useMemo(() => {
    if (!epicQuery.data) return [];
    const urls = new Set<string>();
    for (const issue of epicQuery.data.issues) {
      for (const url of issue.linkedPRUrls) {
        urls.add(url);
      }
    }
    return [...urls];
  }, [epicQuery.data]);

  const linkedPRs = trpc.github.getPRsByUrls.useQuery(
    { prUrls: linkedPRUrls },
    { enabled: linkedPRUrls.length > 0 },
  );

  // Group issues by Jira status
  const groupedByStatus = useMemo(() => {
    if (!epicQuery.data) return [];
    const groups = new Map<string, JiraIssue[]>();
    for (const issue of epicQuery.data.issues) {
      const list = groups.get(issue.state) ?? [];
      list.push(issue);
      groups.set(issue.state, list);
    }
    return [...groups.entries()];
  }, [epicQuery.data]);

  // Map PR URLs to PR data
  const prByUrl = useMemo(() => {
    const map = new Map<string, { title: string; url: string; author: string }>();
    for (const pr of linkedPRs.data?.prs ?? []) {
      map.set(pr.url.replace(/\/$/, ""), { title: pr.title, url: pr.url, author: pr.author });
    }
    return map;
  }, [linkedPRs.data]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Epic Status
          {epicQuery.data && (
            <span className="ml-2 text-base font-normal text-muted-foreground">
              {submittedKey}: {epicQuery.data.epicSummary}
            </span>
          )}
        </h1>
        {epicQuery.data && (
          <span className="text-xs text-muted-foreground">
            Jira: {new Date(epicQuery.data.fetchedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmittedKey(epicKey.trim().toUpperCase());
        }}
      >
        <input
          type="text"
          placeholder="Enter epic key (e.g. PROJ-123)"
          value={epicKey}
          onChange={(e) => setEpicKey(e.target.value)}
          aria-label="Epic key"
          className="h-8 rounded-md border border-input bg-background px-3 text-sm"
        />
        <Button type="submit" size="sm" disabled={!epicKey.trim()}>
          Load Epic
        </Button>
      </form>

      {epicQuery.error && <ErrorBanner message={epicQuery.error.message} />}
      {epicQuery.isLoading && <LoadingIndicator message="Loading epic issues..." />}

      {groupedByStatus.map(([status, issues]) => (
        <div key={status} className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            {status}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {issues.length}
            </span>
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>SP</TableHead>
                <TableHead>Linked PRs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map((issue) => (
                <TableRow key={issue.key}>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs">
                      {issue.typeIconUrl && (
                        <img src={issue.typeIconUrl} alt={issue.type} className="h-4 w-4" />
                      )}
                      {issue.type}
                    </div>
                  </TableCell>
                  <TableCell>
                    <a
                      href={issue.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {issue.key}
                    </a>
                  </TableCell>
                  <TableCell className="max-w-md truncate text-sm">
                    {issue.blocked && (
                      <StatusBadge label="Blocked" variant="danger" className="mr-2" />
                    )}
                    {issue.summary}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs">
                      {issue.priority.iconUrl && (
                        <img src={issue.priority.iconUrl} alt="" className="h-3 w-3" />
                      )}
                      {issue.priority.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{issue.assignee ?? "-"}</TableCell>
                  <TableCell className="text-xs">
                    {issue.storyPoints ?? "-"}
                    {issue.originalStoryPoints != null &&
                      issue.originalStoryPoints !== issue.storyPoints && (
                        <span className="text-muted-foreground">
                          {" "}
                          ({issue.originalStoryPoints})
                        </span>
                      )}
                  </TableCell>
                  <TableCell>
                    {issue.linkedPRUrls.length === 0 ? (
                      <span className="text-xs text-muted-foreground">-</span>
                    ) : (
                      <div className="space-y-0.5">
                        {issue.linkedPRUrls.map((url) => {
                          const pr = prByUrl.get(url.replace(/\/$/, ""));
                          return (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {pr ? pr.title : url.split("/").pop()}
                            </a>
                          );
                        })}
                        {linkedPRs.isLoading && (
                          <span className="text-xs text-muted-foreground animate-pulse">
                            Loading...
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}

      {!epicQuery.isLoading && submittedKey && epicQuery.data?.issues.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">No issues found in this epic</p>
      )}
    </div>
  );
}
