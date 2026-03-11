import { useState, useEffect, useCallback } from "react";

export type FontSize = "small" | "medium" | "large";

const FONT_SIZE_PX: Record<FontSize, string> = {
  small: "18px",
  medium: "20px",
  large: "22px",
};

function applyFontSize(size: FontSize) {
  document.documentElement.style.fontSize = FONT_SIZE_PX[size];
}

export function useFontSize() {
  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    return (localStorage.getItem("fontSize") as FontSize) ?? "medium";
  });

  const setFontSize = useCallback((newSize: FontSize) => {
    setFontSizeState(newSize);
    localStorage.setItem("fontSize", newSize);
    applyFontSize(newSize);
  }, []);

  useEffect(() => {
    applyFontSize(fontSize);
  }, [fontSize]);

  return { fontSize, setFontSize };
}
