import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

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

/**
 * Renders markdown content from Jira.
 * The server converts ADF (Jira Cloud API v3) to markdown before sending.
 */
export function JiraMarkup({ text, className }: JiraMarkupProps) {
  return (
    <div className={className}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={linkComponents}
      >
        {text}
      </Markdown>
    </div>
  );
}

/**
 * Inline variant — renders without block-level wrapping (no <p> tags).
 * Useful for single-line content like blocked reasons.
 */
export function JiraMarkupInline({ text, className }: JiraMarkupProps) {
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
        {text}
      </Markdown>
    </span>
  );
}
