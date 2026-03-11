import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Theme } from "@/hooks/useTheme";

interface ThemeToggleProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

const options: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "system", icon: Monitor, label: "System" },
  { value: "dark", icon: Moon, label: "Dark" },
];

export function ThemeToggle({ theme, onThemeChange }: ThemeToggleProps) {
  return (
    <div className="flex items-center rounded-md border border-border">
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = theme === opt.value;
        return (
          <Button
            key={opt.value}
            variant="ghost"
            size="sm"
            onClick={() => onThemeChange(opt.value)}
            className={`h-7 w-7 rounded-none p-0 first:rounded-l-md last:rounded-r-md ${
              isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
            }`}
            title={opt.label}
          >
            <Icon className="h-3.5 w-3.5" />
          </Button>
        );
      })}
    </div>
  );
}
