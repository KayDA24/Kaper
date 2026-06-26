"use client";

import Link from "next/link";
import AppShell from "@/components/app-shell";
import EmptyLibrary from "@/components/empty-library";
import { usePapers } from "@/lib/hooks";
import { formatFileSize } from "@/lib/storage";

export default function DashboardPage() {
  const { papers, ready } = usePapers();
  const markers = papers.flatMap((paper) => paper.markers);
  const vocabularyCount = papers.reduce((sum, paper) => sum + paper.vocabulary.length, 0);
  const recent = [...papers].sort((a, b) => (b.lastOpenedAt ?? b.uploadedAt).localeCompare(a.lastOpenedAt ?? a.uploadedAt)).slice(0, 4);

  return (
    <AppShell title="대시보드">
      {!ready ? null : papers.length === 0 ? (
        <EmptyLibrary />
      ) : (
        <section className="h-[calc(100vh-64px)] w-full overflow-y-auto px-6 py-6 transition-all duration-200">
          <div className="mb-8 h-[70px]">
            <h1 className="text-[32px] font-bold leading-10 tracking-tight">대시보드</h1>
            <p className="mt-2 text-muted">오늘 연구 진행 상황을 확인하세요.</p>
          </div>
          <div className="grid w-full grid-cols-[301px_minmax(0,1fr)] gap-6 transition-all duration-200">
            <div className="space-y-6">
              <div className="h-[168px] rounded-2xl border border-line bg-panel p-6 shadow-soft">
                <p className="text-sm font-semibold text-muted">오늘의 읽기 진행</p>
                <div className="mt-4 flex items-end gap-2"><span className="text-5xl font-bold">{papers.length}</span><span className="pb-2 text-muted">편 보관 중</span></div>
                <div className="mt-5 h-2 rounded-full bg-canvas"><div className="h-2 w-2/3 rounded-full bg-brand" /></div>
              </div>
              <div className="h-[188px] rounded-2xl border border-line bg-panel p-6 shadow-soft">
                <p className="text-sm font-semibold text-muted">마커 통계</p>
                <div className="mt-5 space-y-3 text-sm">
                  <Stat label="중요" value={markers.filter((item) => item.markerType === "중요").length} />
                  <Stat label="이해 안 됨" value={markers.filter((item) => item.markerType === "이해 안 됨").length} />
                  <Stat label="다시 보기" value={markers.filter((item) => item.markerType === "다시 보기").length} />
                </div>
              </div>
              <div className="h-[162px] rounded-2xl border border-line bg-panel p-6 shadow-soft">
                <p className="text-sm font-semibold text-muted">빠른 접근</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/library" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">라이브러리</Link>
                  <Link href="/review" className="rounded-lg border border-line px-4 py-2 text-sm">복습</Link>
                  <Link href="/vocabulary" className="rounded-lg border border-line px-4 py-2 text-sm">단어장 {vocabularyCount}</Link>
                </div>
              </div>
            </div>
            <div className="min-h-[565px] rounded-2xl border border-line bg-panel p-6 shadow-soft">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-bold">최근 읽은 논문</h2>
                <Link href="/library" className="text-sm font-semibold text-brand">전체 보기</Link>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {recent.map((paper) => (
                  <Link key={paper.id} href={`/papers/${paper.id}`} className="group overflow-hidden rounded-2xl border border-line bg-canvas transition hover:-translate-y-0.5 hover:shadow-soft">
                    <div className="h-32 bg-gradient-to-br from-brand/20 via-accent/10 to-panel p-4"><span className="rounded-full bg-panel px-3 py-1 text-xs text-muted">PDF</span></div>
                    <div className="p-4">
                      <h3 className="line-clamp-2 min-h-12 font-bold group-hover:text-brand">{paper.title}</h3>
                      <p className="mt-2 text-sm text-muted">{formatFileSize(paper.fileSize)} · 마커 {paper.markers.length}개</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="flex items-center justify-between rounded-xl bg-canvas px-4 py-3"><span>{label}</span><strong>{value}</strong></div>;
}
