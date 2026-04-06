import { useState, useCallback } from "react";
import { Link2, Check } from "lucide-react";

interface CopyLinkButtonProps {
  url: string;
  className?: string;
}

export function CopyLinkButton({ url, className = "" }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    },
    [url],
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center shrink-0 opacity-0 group-hover/link:opacity-60 hover:!opacity-100 transition-opacity ${className}`}
      title="Copy link"
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
      ) : (
        <Link2 className="h-3 w-3" />
      )}
    </button>
  );
}
