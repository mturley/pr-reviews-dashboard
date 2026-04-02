import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";

const COLLAPSE_HEIGHT = 200;

export function CollapsibleBody({ children, renderHeader }: {
  children: React.ReactNode;
  renderHeader?: (showLessButton: React.ReactNode | null) => React.ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const measure = useCallback(() => {
    if (contentRef.current) {
      setNeedsCollapse(contentRef.current.scrollHeight > COLLAPSE_HEIGHT);
    }
  }, []);

  useEffect(() => {
    measure();
  }, [measure, children]);

  const toggle = useCallback(() => setExpanded((prev) => !prev), []);

  const showLessButton = needsCollapse && expanded ? (
    <Button
      variant="ghost"
      size="sm"
      className="h-5 px-1.5 text-xs text-muted-foreground"
      onClick={toggle}
    >
      Show less
    </Button>
  ) : null;

  return (
    <div>
      {renderHeader?.(showLessButton)}
      <div
        ref={contentRef}
        className="relative overflow-hidden transition-[max-height] duration-200"
        style={needsCollapse && !expanded ? { maxHeight: COLLAPSE_HEIGHT } : undefined}
      >
        {children}
        {needsCollapse && !expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-muted/80 to-transparent pointer-events-none" />
        )}
      </div>
      {needsCollapse && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-xs text-muted-foreground mt-1"
          onClick={toggle}
        >
          {expanded ? "Show less" : "Show more"}
        </Button>
      )}
    </div>
  );
}
