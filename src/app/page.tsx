"use client";

import Link from "next/link";
import AppShell from "@/components/app-shell";
import EmptyLibrary from "@/components/empty-library";
import { usePapers } from "@/lib/hooks";
import { formatFileSize, getResumeTarget } from "@/lib/storage";

export default function DashboardPage() {
  const { papers, ready } = usePapers();
  const recent = [...papers].sort((a, b) => (b.lastOpenedAt ?? b.uploadedAt).localeCompare(a.lastOpenedAt ?? a.uploadedAt)).slice(0, 4);

  return (
    <AppShell title="대시보드">
      {!ready ? null : papers.length === 0 ? (
        <EmptyLibrary title="아직 업로드한 논문이 없습니다" description="첫 PDF를 업로드하고 Kaper에서 읽기 기록을 시작해보세요." />
      ) : (
        <section className="h-[calc(100vh-64px)] w-full overflow-y-auto px-6 py-6 transition-all duration-200">
          <div className="mb-8 flex min-h-[70px] items-end justify-between gap-4">
            <div>
              <h1 className="text-[32px] font-bold leading-10 tracking-tight">대시보드</h1>
              <p className="mt-2 text-muted">최근 읽은 논문을 이어서 확인하세요.</p>
            </div>
            <Link href="/library" className="rounded-xl border border-line bg-panel px-4 py-3 text-sm font-semibold text-brand shadow-soft transition hover:bg-canvas">
              전체 논문 보기
            </Link>
          </div>
          <div className="min-h-[565px] rounded-2xl border border-line bg-panel p-6 shadow-soft">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">최근 읽은 논문</h2>
              <span className="text-sm text-muted">{papers.length}편 보관 중</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {recent.map((paper) => (
                <article key={paper.id} className="overflow-hidden rounded-2xl border border-line bg-canvas transition hover:-translate-y-0.5 hover:shadow-soft">
                  <Link href={`/papers/${paper.id}`} className="group block">
                    <div className="h-32 bg-gradient-to-br from-brand/20 via-accent/10 to-panel p-4"><span className="rounded-full bg-panel px-3 py-1 text-xs text-muted">PDF</span></div>
                    <div className="p-4">
                      <h3 className="line-clamp-2 min-h-12 font-bold group-hover:text-brand">{paper.title}</h3>
                      <p className="mt-2 text-sm text-muted">{formatFileSize(paper.fileSize)} · 마커 {paper.markers.length}개</p>
                      <p className="mt-1 text-xs text-muted">마지막 열람 {formatDate(paper.lastOpenedAt ?? paper.uploadedAt)}</p>
                    </div>
                  </Link>
                  <div className="border-t border-line px-4 py-3">
                    <Link href={getResumeHref(paper)} className="inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
                      이어 읽기
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </AppShell>
  );
}

function getResumeHref(paper: Parameters<typeof getResumeTarget>[0]) {
  const target = getResumeTarget(paper);
  if (target.markerId) return `/papers/${paper.id}?marker=${target.markerId}`;
  return `/papers/${paper.id}?page=${target.pageNumber}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(value));
}
