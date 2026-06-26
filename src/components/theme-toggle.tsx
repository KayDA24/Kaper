"use client";

import { useEffect, useState } from "react";
import { getStoredTheme, setStoredTheme } from "@/lib/storage";

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = getStoredTheme();
    setTheme(stored);
    document.documentElement.classList.toggle("dark", stored === "dark");
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setStoredTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`${compact ? "h-9 w-9 justify-center" : "h-10 w-full justify-between px-4"} flex items-center rounded-xl border border-line bg-panel text-sm text-ink transition hover:bg-canvas`}
      aria-label="테마 전환"
      title={theme === "dark" ? "다크 모드" : "라이트 모드"}
    >
      {!compact && <span>테마</span>}
      <span>{compact ? (theme === "dark" ? "D" : "L") : theme === "dark" ? "다크" : "라이트"}</span>
    </button>
  );
}
