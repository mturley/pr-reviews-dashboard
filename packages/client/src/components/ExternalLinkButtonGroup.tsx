import { useState, useCallback } from "react";
import { ExternalLink, Link, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExternalLinkButtonGroupProps {
  href: string;
  label: string;
  size?: "sm" | "default";
  className?: string;
}

export function ExternalLinkButtonGroup({ href, label, size = "sm", className }: ExternalLinkButtonGroupProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [href]);

  return (
    <div className={cn("inline-flex items-center", className)}>
      <Button variant="outline" size={size} asChild className="rounded-r-none border-r-0">
        <a href={href} target="_blank" rel="noopener noreferrer" className="gap-1.5">
          <ExternalLink className="h-3.5 w-3.5" />
          {label}
        </a>
      </Button>
      <Button
        variant="outline"
        size={size}
        className="rounded-l-none gap-1.5"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Link className="h-3.5 w-3.5" />}
        {copied ? "Copied!" : "Copy link"}
      </Button>
    </div>
  );
}
