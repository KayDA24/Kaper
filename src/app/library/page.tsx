"use client";

import Link from "next/link";
import { useState } from "react";
import AppShell from "@/components/app-shell";
import EmptyLibrary from "@/components/empty-library";
import { usePapers } from "@/lib/hooks";
import { deletePaper, downloadBackup, formatFileSize, getResumeTarget, updatePaperMetadata } from "@/lib/storage";
import type { Paper } from "@/lib/types";

export default function LibraryPage() {
  const { papers, ready } = usePapers();

  return (
    <AppShell title="논문 라이브러리">
      {!ready ? null : papers.length === 0 ? (
        <EmptyLibrary />
      ) : (
        <section className="h-[calc(100vh-64px)] w-full overflow-y-auto px-6 py-6 transition-all duration-200">
          <div className="mb-7 flex min-h-[70px] items-end justify-between gap-4">
            <div>
              <h1 className="text-[32px] font-bold leading-10 tracking-tight">논문 라이브러리</h1>
              <p className="mt-2 text-muted">업로드한 PDF 논문 {papers.length}편을 보관 중입니다.</p>
            </div>
            <button type="button" onClick={downloadBackup} className="rounded-xl border border-line bg-panel px-4 py-3 text-sm font-semibold text-brand shadow-soft transition hover:bg-canvas">
              JSON 백업 내보내기
            </button>
          </div>
          <div className="grid w-full grid-cols-3 gap-4 transition-all duration-200">
            {papers.map((paper) => <PaperCard key={paper.id} paper={paper} />)}
          </div>
        </section>
      )}
    </AppShell>
  );
}

function PaperCard({ paper }: { paper: Paper }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(paper.title);
  const [authors, setAuthors] = useState(paper.authors ?? "");
  const [tags, setTags] = useState((paper.tags ?? []).join(", "));
  const resumeHref = getResumeHref(paper);

  const save = () => {
    updatePaperMetadata(paper.id, {
      title,
      authors,
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean)
    });
    setEditing(false);
  };

  return (
    <article className="rounded-2xl border border-line bg-panel p-5 shadow-soft">
      <Link href={`/papers/${paper.id}`}>
        <div className="mb-4 h-36 rounded-xl bg-gradient-to-br from-brand/20 via-accent/10 to-canvas p-4">
          <span className="rounded-full bg-panel px-3 py-1 text-xs font-semibold text-brand">PDF</span>
        </div>
      </Link>

      {editing ? (
        <div className="space-y-2">
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm font-semibold" placeholder="논문 제목" />
          <input value={authors} onChange={(event) => setAuthors(event.target.value)} className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm" placeholder="저자" />
          <input value={tags} onChange={(event) => setTags(event.target.value)} className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm" placeholder="태그, 쉼표로 구분" />
          <div className="flex gap-2">
            <button type="button" onClick={save} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white">저장</button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-line px-3 py-2 text-sm">취소</button>
          </div>
        </div>
      ) : (
        <>
          <Link href={`/papers/${paper.id}`}>
            <h2 className="line-clamp-2 min-h-12 text-lg font-bold">{paper.title}</h2>
          </Link>
          {paper.authors && <p className="mt-1 text-sm text-muted">{paper.authors}</p>}
          {(paper.tags ?? []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {(paper.tags ?? []).map((tag) => <span key={tag} className="rounded-full bg-canvas px-2 py-1 text-xs text-muted">{tag}</span>)}
            </div>
          )}
        </>
      )}

      <p className="mt-3 text-sm text-muted">{paper.fileName} · {formatFileSize(paper.fileSize)}</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
        <Mini label="마커" value={paper.markers.length} />
        <Mini label="노트" value={paper.coreNotes.length + paper.sectionNotes.length} />
        <Mini label="단어" value={paper.vocabulary.length} />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`/papers/${paper.id}`} className="flex-1 rounded-xl bg-brand px-4 py-2 text-center text-sm font-semibold text-white">열기</Link>
        <Link href={resumeHref} className="flex-1 rounded-xl border border-line px-4 py-2 text-center text-sm font-semibold">이어 읽기</Link>
        <button type="button" onClick={() => setEditing((value) => !value)} className="rounded-xl border border-line px-4 py-2 text-sm text-muted hover:text-ink">수정</button>
        <button type="button" onClick={() => deletePaper(paper.id)} className="rounded-xl border border-line px-4 py-2 text-sm text-muted hover:text-ink">삭제</button>
      </div>
    </article>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-canvas py-3"><strong className="block text-ink">{value}</strong><span className="text-xs text-muted">{label}</span></div>;
}

function getResumeHref(paper: Paper) {
  const target = getResumeTarget(paper);
  if (target.markerId) return `/papers/${paper.id}?marker=${target.markerId}`;
  return `/papers/${paper.id}?page=${target.pageNumber}`;
}
