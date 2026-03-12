import { useMemo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
// @ts-expect-error jira2md has no type declarations
import J2M from "jira2md";

/**
 * Pre-process Jira wiki markup to fix patterns that jira2md doesn't handle:
 * - [TEXT]URL patterns (Jira link syntax without pipe separator)
 * - Bare JIRA issue keys like RHOAIENG-12345
 */
function preprocessJiraMarkup(text: string): string {
  // Convert [TEXT]URL → [TEXT|URL] so jira2md can handle it
  let result = text.replace(
    /\[([^\]|]+)\](https?:\/\/[^\s\]]+)/g,
    "[$1|$2]",
  );

  // Convert bare Jira issue keys to links (only when not already inside a link)
  // Match PROJECT-12345 patterns that aren't preceded by [ or |
  result = result.replace(
    /(?<![[\w|/])([A-Z][A-Z0-9]+-\d+)(?![|\]])/g,
    "[$1|https://issues.redhat.com/browse/$1]",
  );

  return result;
}

const linkComponents = {
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

interface JiraMarkupProps {
  text: string;
  className?: string;
}

export function JiraMarkup({ text, className }: JiraMarkupProps) {
  const markdown = useMemo(() => {
    const preprocessed = preprocessJiraMarkup(text);
    return J2M.to_markdown(preprocessed) as string;
  }, [text]);

  return (
    <div className={className}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={linkComponents}
      >
        {markdown}
      </Markdown>
    </div>
  );
}

/**
 * Inline variant — renders without block-level wrapping (no <p> tags).
 * Useful for single-line content like blocked reasons.
 */
export function JiraMarkupInline({ text, className }: JiraMarkupProps) {
  const markdown = useMemo(() => {
    const preprocessed = preprocessJiraMarkup(text);
    return J2M.to_markdown(preprocessed) as string;
  }, [text]);

  return (
    <span className={className}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          ...linkComponents,
          p: ({ children }) => <>{children}</>,
        }}
      >
        {markdown}
      </Markdown>
    </span>
  );
}
