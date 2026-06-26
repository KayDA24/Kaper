"use client";

import { useRouter } from "next/navigation";
import { DragEvent, useState } from "react";
import { createPaperFromFile } from "@/lib/storage";

export default function EmptyLibrary() {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File | null) => {
    if (!file || file.type !== "application/pdf") return;
    setBusy(true);
    try {
      const paper = await createPaperFromFile(file);
      router.push(`/papers/${paper.id}`);
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    upload(event.dataTransfer.files?.[0] ?? null);
  };

  return (
    <div
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`flex h-[calc(100vh-64px)] w-full items-center justify-center text-center transition-all duration-200 ${dragging ? "opacity-80" : ""}`}
    >
      <div className="flex w-[448px] flex-col items-center">
        <div className="mb-8 grid h-64 w-64 place-items-center rounded-[32px] border border-dashed border-brand/40 bg-brand/5">
          <div className="rounded-3xl bg-panel p-8 shadow-soft">
            <div className="mx-auto h-20 w-16 rounded-lg border-2 border-brand bg-canvas" />
            <div className="mt-4 h-3 w-24 rounded bg-brand/30" />
            <div className="mt-2 h-3 w-16 rounded bg-accent/30" />
          </div>
        </div>
        <h1 className="text-[32px] font-bold leading-10 tracking-tight">아직 업로드된 논문이 없습니다</h1>
        <p className="mt-4 w-96 text-base leading-7 text-muted">PDF 논문을 직접 업로드하면 라이브러리에 저장되고, 새로고침 후에도 다시 열 수 있습니다.</p>
        <div className="mt-8 flex justify-center gap-4">
          <label className="flex h-[54px] cursor-pointer items-center justify-center rounded bg-brand px-8 text-base font-semibold text-white shadow-soft transition hover:opacity-90">
            {busy ? "저장 중..." : "PDF 논문 업로드"}
            <input type="file" accept="application/pdf" className="hidden" onChange={(event) => upload(event.target.files?.[0] ?? null)} />
          </label>
          <button type="button" className="h-[54px] rounded border border-line bg-panel px-8 text-base font-semibold text-ink">가이드 보기</button>
        </div>
        <p className="mt-8 text-sm text-muted">또는 PDF 파일을 이 영역으로 끌어다 놓으세요.</p>
      </div>
    </div>
  );
}
