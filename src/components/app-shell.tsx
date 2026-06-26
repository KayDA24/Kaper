"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { createPaperFromFile } from "@/lib/storage";
import ThemeToggle from "./theme-toggle";

const navItems = [
  { href: "/", label: "대시보드", icon: "◇" },
  { href: "/library", label: "라이브러리", icon: "▣" },
  { href: "/review", label: "복습", icon: "↺" },
  { href: "/vocabulary", label: "단어장", icon: "Aa" }
];

export default function AppShell({ children, title = "Kaper" }: { children: ReactNode; title?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", localStorage.getItem("kaper:v1:theme") === "dark");
    setSidebarCollapsed(localStorage.getItem("kaper:v1:sidebar") === "collapsed");
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      localStorage.setItem("kaper:v1:sidebar", next ? "collapsed" : "expanded");
      return next;
    });
  };

  const upload = async (file: File | null) => {
    if (!file || file.type !== "application/pdf") return;
    setUploading(true);
    try {
      const paper = await createPaperFromFile(file);
      router.push(`/papers/${paper.id}`);
    } finally {
      setUploading(false);
    }
  };

  const updateSearchQuery = (value: string) => {
    setSearchQuery(value);
    window.dispatchEvent(new CustomEvent("kaper:search-query", { detail: value }));
  };

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-canvas text-ink">
      <aside className={`sticky top-0 z-20 h-screen shrink-0 border-r border-line bg-panel py-5 transition-all duration-200 ${sidebarCollapsed ? "w-[72px] px-3" : "w-[280px] px-6"}`}>
        <div className={`mb-9 flex items-start ${sidebarCollapsed ? "justify-center" : "justify-between gap-3"}`}>
          <div className={sidebarCollapsed ? "hidden" : "block"}>
            <Link href="/" className="text-3xl font-bold tracking-tight text-ink">Kaper</Link>
            <p className="mt-1 text-sm text-muted">Primary Workspace</p>
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            className="grid h-9 w-9 place-items-center text-lg text-muted transition hover:text-ink"
            aria-label={sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
            title={sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
          >
            {sidebarCollapsed ? "☰" : "◫"}
          </button>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex h-[42px] items-center gap-3 rounded-none text-sm transition ${sidebarCollapsed ? "justify-center px-0" : "px-4"} ${active ? "border-l-4 border-brand bg-brand/10 text-ink" : "text-muted hover:bg-canvas hover:text-ink"}`}
              >
                <span className="grid h-6 w-6 place-items-center text-xs font-semibold">{item.icon}</span>
                {!sidebarCollapsed && item.label}
              </Link>
            );
          })}
        </nav>
        <label className={`absolute bottom-[317px] flex h-[34px] cursor-pointer items-center justify-center rounded bg-brand text-sm font-semibold text-white shadow-soft transition hover:opacity-90 ${sidebarCollapsed ? "left-3 right-3" : "left-6 right-6"}`} title="PDF 업로드">
          {sidebarCollapsed ? "+" : uploading ? "업로드 중..." : "+ PDF 업로드"}
          <input type="file" accept="application/pdf" className="hidden" onChange={(event) => upload(event.target.files?.[0] ?? null)} />
        </label>
        <div className={`absolute bottom-0 left-0 right-0 border-t border-line py-5 ${sidebarCollapsed ? "px-3" : "px-6"}`}>
          <ThemeToggle compact={sidebarCollapsed} />
          {!sidebarCollapsed && <p className="mt-3 text-xs leading-5 text-muted">이 브라우저에 논문과 메모를 저장합니다.</p>}
        </div>
      </aside>

      <main className="min-w-0 flex-1 transition-all duration-200">
        <header className="sticky top-0 z-10 flex h-16 w-full items-center justify-between border-b border-line bg-panel/95 px-6 backdrop-blur transition-all duration-200">
          <label className="relative block h-10 w-96">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">⌕</span>
            <input
              value={searchQuery}
              onChange={(event) => updateSearchQuery(event.target.value)}
              className="h-10 w-full rounded border border-line bg-canvas pl-9 pr-4 text-sm text-ink outline-none transition focus:border-brand"
              placeholder="논문 내용에서 단어 검색..."
            />
          </label>
          <div className="ml-auto flex items-center gap-4">
            <button type="button" aria-label="알림" className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-canvas">•</button>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-ink text-xs font-bold text-panel">K</div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
