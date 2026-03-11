import { Button } from "@/components/ui/button";
import type { FontSize } from "@/hooks/useFontSize";

interface FontSizeToggleProps {
  fontSize: FontSize;
  onFontSizeChange: (size: FontSize) => void;
}

const options: { value: FontSize; label: string; sizeClass: string }[] = [
  { value: "small", label: "Small", sizeClass: "text-sm" },
  { value: "medium", label: "Medium", sizeClass: "text-base" },
  { value: "large", label: "Large", sizeClass: "text-lg" },
];

export function FontSizeToggle({ fontSize, onFontSizeChange }: FontSizeToggleProps) {
  return (
    <div className="flex items-center rounded-md border border-border">
      {options.map((opt) => {
        const isActive = fontSize === opt.value;
        return (
          <Button
            key={opt.value}
            variant="ghost"
            size="sm"
            onClick={() => onFontSizeChange(opt.value)}
            className={`h-7 w-7 rounded-none p-0 first:rounded-l-md last:rounded-r-md ${
              isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
            }`}
            title={opt.label}
          >
            <span className={`${opt.sizeClass} font-semibold leading-none`}>A</span>
          </Button>
        );
      })}
    </div>
  );
}
