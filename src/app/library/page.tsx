"use client";

import Link from "next/link";
import AppShell from "@/components/app-shell";
import EmptyLibrary from "@/components/empty-library";
import { usePapers } from "@/lib/hooks";
import { deletePaper, formatFileSize } from "@/lib/storage";

export default function LibraryPage() {
  const { papers, ready } = usePapers();

  return (
    <AppShell title="논문 라이브러리">
      {!ready ? null : papers.length === 0 ? (
        <EmptyLibrary />
      ) : (
        <section className="h-[calc(100vh-64px)] w-full overflow-y-auto px-6 py-6 transition-all duration-200">
          <div className="mb-7 flex h-[70px] items-end justify-between">
            <div>
              <h1 className="text-[32px] font-bold leading-10 tracking-tight">논문 라이브러리</h1>
              <p className="mt-2 text-muted">업로드한 PDF 논문 {papers.length}편을 보관 중입니다.</p>
            </div>
            <div className="rounded-xl border border-line bg-panel px-4 py-3 text-sm text-muted">초기 데이터 없음 · 사용자 업로드만 표시</div>
          </div>
          <div className="grid w-full grid-cols-3 gap-4 transition-all duration-200">
            {papers.map((paper) => (
              <article key={paper.id} className="rounded-2xl border border-line bg-panel p-5 shadow-soft">
                <Link href={`/papers/${paper.id}`}>
                  <div className="mb-4 h-36 rounded-xl bg-gradient-to-br from-brand/20 via-accent/10 to-canvas p-4">
                    <span className="rounded-full bg-panel px-3 py-1 text-xs font-semibold text-brand">PDF</span>
                  </div>
                  <h2 className="line-clamp-2 min-h-12 text-lg font-bold">{paper.title}</h2>
                </Link>
                <p className="mt-2 text-sm text-muted">{paper.fileName} · {formatFileSize(paper.fileSize)}</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                  <Mini label="마커" value={paper.markers.length} />
                  <Mini label="노트" value={paper.coreNotes.length + paper.sectionNotes.length} />
                  <Mini label="단어" value={paper.vocabulary.length} />
                </div>
                <div className="mt-5 flex gap-2">
                  <Link href={`/papers/${paper.id}`} className="flex-1 rounded-xl bg-brand px-4 py-2 text-center text-sm font-semibold text-white">열기</Link>
                  <button type="button" onClick={() => deletePaper(paper.id)} className="rounded-xl border border-line px-4 py-2 text-sm text-muted hover:text-ink">삭제</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-canvas py-3"><strong className="block text-ink">{value}</strong><span className="text-xs text-muted">{label}</span></div>;
}
