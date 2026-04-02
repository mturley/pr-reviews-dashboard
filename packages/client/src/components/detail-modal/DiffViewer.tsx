import { useState, useMemo, useCallback } from "react";
import { ChevronDown, ChevronRight, ChevronsUpDown, FileText, FilePlus, FileMinus, FileEdit, ArrowRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "../../trpc";
import type { PullRequest } from "../../../../server/src/types/pr";

// --- Types ---

interface DiffLine {
  type: "add" | "remove" | "context" | "hunk-header" | "no-newline";
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
  whitespaceOnly?: boolean;
}

interface SideBySidePair {
  left: DiffLine | null;
  right: DiffLine | null;
}

// --- Diff parsing ---

function parsePatch(patch: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const raw of patch.split("\n")) {
    if (raw.startsWith("@@")) {
      const match = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      lines.push({ type: "hunk-header", content: raw });
    } else if (raw.startsWith("\\ ")) {
      lines.push({ type: "no-newline", content: raw });
    } else if (raw.startsWith("+")) {
      lines.push({ type: "add", content: raw.slice(1), newLineNum: newLine });
      newLine++;
    } else if (raw.startsWith("-")) {
      lines.push({ type: "remove", content: raw.slice(1), oldLineNum: oldLine });
      oldLine++;
    } else {
      // Context line (may have leading space or be empty)
      const content = raw.startsWith(" ") ? raw.slice(1) : raw;
      lines.push({ type: "context", content, oldLineNum: oldLine, newLineNum: newLine });
      oldLine++;
      newLine++;
    }
  }

  return lines;
}

function markWhitespaceOnly(lines: DiffLine[]): void {
  let i = 0;
  while (i < lines.length) {
    // Collect consecutive remove lines
    const removeStart = i;
    while (i < lines.length && lines[i].type === "remove") i++;
    const removes = lines.slice(removeStart, i);

    // Collect consecutive add lines
    const addStart = i;
    while (i < lines.length && lines[i].type === "add") i++;
    const adds = lines.slice(addStart, i);

    // Pair them and check for whitespace-only differences
    const pairCount = Math.min(removes.length, adds.length);
    for (let j = 0; j < pairCount; j++) {
      if (removes[j].content.replace(/\s/g, "") === adds[j].content.replace(/\s/g, "")) {
        removes[j].whitespaceOnly = true;
        adds[j].whitespaceOnly = true;
      }
    }

    // If we didn't advance (context/hunk-header/no-newline), skip one
    if (i === removeStart) i++;
  }
}

function buildSideBySidePairs(lines: DiffLine[]): SideBySidePair[] {
  const pairs: SideBySidePair[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.type === "hunk-header" || line.type === "no-newline") {
      pairs.push({ left: line, right: line });
      i++;
    } else if (line.type === "context") {
      pairs.push({ left: line, right: line });
      i++;
    } else {
      // Collect consecutive remove then add lines
      const removes: DiffLine[] = [];
      while (i < lines.length && lines[i].type === "remove") {
        removes.push(lines[i]);
        i++;
      }
      const adds: DiffLine[] = [];
      while (i < lines.length && lines[i].type === "add") {
        adds.push(lines[i]);
        i++;
      }

      const maxLen = Math.max(removes.length, adds.length);
      for (let j = 0; j < maxLen; j++) {
        pairs.push({
          left: j < removes.length ? removes[j] : null,
          right: j < adds.length ? adds[j] : null,
        });
      }
    }
  }

  return pairs;
}

// --- Line styling ---

function lineClassName(line: DiffLine | null, hideWhitespace: boolean): string {
  if (!line) return "";
  if (hideWhitespace && line.whitespaceOnly) return "";
  switch (line.type) {
    case "add":
      return "bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300";
    case "remove":
      return "bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300";
    case "hunk-header":
      return "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400";
    case "no-newline":
      return "text-muted-foreground italic";
    default:
      return "";
  }
}

// --- Props ---

interface DiffViewerProps {
  pr: PullRequest;
  splitView: boolean;
  onSplitViewChange: (v: boolean) => void;
  hideWhitespace: boolean;
  onHideWhitespaceChange: (v: boolean) => void;
}

export function DiffViewer({ pr, splitView, onSplitViewChange, hideWhitespace, onHideWhitespaceChange }: DiffViewerProps) {
  const filesQuery = trpc.github.getPRFiles.useQuery({
    owner: pr.repoOwner,
    repo: pr.repoName,
    pullNumber: pr.number,
  });

  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());

  const toggleFile = useCallback((filename: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  }, []);

  if (filesQuery.isLoading) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">
        Loading files...
      </div>
    );
  }

  if (filesQuery.error) {
    return (
      <div className="py-8 text-center text-sm text-red-600 dark:text-red-400">
        Failed to load files: {filesQuery.error.message}
      </div>
    );
  }

  const files = filesQuery.data?.files ?? [];
  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

  const allExpanded = files.length > 0 && collapsedFiles.size === 0;
  const noneExpanded = files.length > 0 && files.every((f) => collapsedFiles.has(f.filename));

  const expandAll = () => setCollapsedFiles(new Set());
  const collapseAll = () => setCollapsedFiles(new Set(files.map((f) => f.filename)));

  return (
    <div className="space-y-3">
      <div className="sticky -top-4 z-10 flex items-center justify-between bg-background pb-3 border-b border-border -mx-6 px-6 -mt-4 pt-4">
        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground">
            {files.length} file{files.length !== 1 ? "s" : ""} changed
            <span className="text-green-600 dark:text-green-400 ml-2">+{totalAdditions}</span>
            <span className="text-red-600 dark:text-red-400 ml-1">-{totalDeletions}</span>
          </div>
          {files.length > 1 && (
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground"
                onClick={allExpanded ? collapseAll : expandAll}
                title={allExpanded ? "Collapse all files" : "Expand all files"}
              >
                <ChevronsUpDown className="h-3.5 w-3.5 mr-1" />
                {allExpanded ? "Collapse all" : noneExpanded ? "Expand all" : "Expand all"}
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={splitView} onCheckedChange={onSplitViewChange} />
            <span className="text-xs text-muted-foreground">Split view</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={hideWhitespace} onCheckedChange={onHideWhitespaceChange} />
            <span className="text-xs text-muted-foreground">Hide whitespace</span>
          </label>
        </div>
      </div>

      <div className="space-y-1">
        {files.map((file) => (
          <FileEntry
            key={file.filename}
            file={file}
            splitView={splitView}
            hideWhitespace={hideWhitespace}
            expanded={!collapsedFiles.has(file.filename)}
            onToggle={() => toggleFile(file.filename)}
          />
        ))}
      </div>
    </div>
  );
}

// --- File entry ---

interface FileData {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch: string | null;
  previousFilename: string | null;
}

function FileStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "added": return <FilePlus className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />;
    case "removed": return <FileMinus className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />;
    case "modified": return <FileEdit className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400 shrink-0" />;
    case "renamed": return <ArrowRight className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />;
    default: return <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  }
}

interface FileEntryProps {
  file: FileData;
  splitView: boolean;
  hideWhitespace: boolean;
  expanded: boolean;
  onToggle: () => void;
}

function FileEntry({ file, splitView, hideWhitespace, expanded, onToggle }: FileEntryProps) {

  const parsed = useMemo(() => {
    if (!file.patch) return null;
    const lines = parsePatch(file.patch);
    markWhitespaceOnly(lines);
    return lines;
  }, [file.patch]);

  const sideBySidePairs = useMemo(() => {
    if (!parsed) return null;
    return buildSideBySidePairs(parsed);
  }, [parsed]);

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        onClick={onToggle}
        className="cursor-pointer flex items-center gap-2 w-full text-left px-3 py-1.5 hover:bg-muted/50 transition-colors text-sm"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <FileStatusIcon status={file.status} />
        <span className="font-mono text-xs truncate">
          {file.previousFilename ? (
            <>
              <span className="text-muted-foreground">{file.previousFilename}</span>
              {" → "}
              {file.filename}
            </>
          ) : (
            file.filename
          )}
        </span>
        <span className="ml-auto shrink-0 text-xs">
          <span className="text-green-600 dark:text-green-400">+{file.additions}</span>
          {" "}
          <span className="text-red-600 dark:text-red-400">-{file.deletions}</span>
        </span>
      </button>

      {expanded && parsed && splitView && sideBySidePairs && (
        <div className="border-t border-border overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <tbody>
              {sideBySidePairs.map((pair, i) => {
                if (pair.left?.type === "hunk-header") {
                  return (
                    <tr key={i}>
                      <td colSpan={4} className={cn("px-3 leading-5", lineClassName(pair.left, hideWhitespace))}>
                        {pair.left.content}
                      </td>
                    </tr>
                  );
                }
                if (pair.left?.type === "no-newline") {
                  return (
                    <tr key={i}>
                      <td colSpan={4} className={cn("px-3 leading-5", lineClassName(pair.left, hideWhitespace))}>
                        {pair.left.content}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={i}>
                    <td className="w-10 text-right pr-2 text-muted-foreground select-none border-r border-border leading-5 align-top">
                      {pair.left?.oldLineNum}
                    </td>
                    <td className={cn("px-2 whitespace-pre w-1/2 leading-5", lineClassName(pair.left, hideWhitespace))}>
                      {pair.left?.content ?? ""}
                    </td>
                    <td className="w-10 text-right pr-2 text-muted-foreground select-none border-x border-border leading-5 align-top">
                      {pair.right?.newLineNum}
                    </td>
                    <td className={cn("px-2 whitespace-pre w-1/2 leading-5", lineClassName(pair.right, hideWhitespace))}>
                      {pair.right?.content ?? ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {expanded && parsed && !splitView && (
        <div className="border-t border-border overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <tbody>
              {parsed.map((line, i) => {
                if (line.type === "hunk-header" || line.type === "no-newline") {
                  return (
                    <tr key={i}>
                      <td colSpan={3} className={cn("px-3 leading-5", lineClassName(line, hideWhitespace))}>
                        {line.content}
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={i}>
                    <td className="w-10 text-right pr-1 text-muted-foreground select-none leading-5 align-top">
                      {line.type !== "add" ? line.oldLineNum : ""}
                    </td>
                    <td className="w-10 text-right pr-2 text-muted-foreground select-none border-r border-border leading-5 align-top">
                      {line.type !== "remove" ? line.newLineNum : ""}
                    </td>
                    <td className={cn("px-2 whitespace-pre leading-5", lineClassName(line, hideWhitespace))}>
                      {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}{line.content}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {expanded && !file.patch && (
        <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground italic">
          Binary file or diff too large to display
        </div>
      )}
    </div>
  );
}
