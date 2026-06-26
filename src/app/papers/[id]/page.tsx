"use client";

import { useParams } from "next/navigation";
import AppShell from "@/components/app-shell";
import PaperWorkspace from "@/components/paper-workspace";
import { usePaper } from "@/lib/hooks";

export default function PaperPage() {
  const params = useParams<{ id: string }>();
  const { paper, ready } = usePaper(params.id);

  return (
    <AppShell title="논문 읽기">
      {!ready ? null : paper ? (
        <PaperWorkspace paper={paper} />
      ) : (
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center p-8 text-center">
          <div className="rounded-2xl border border-line bg-panel p-10 shadow-soft">
            <h1 className="text-2xl font-bold">논문을 찾을 수 없습니다</h1>
            <p className="mt-3 text-muted">브라우저 저장소에서 해당 논문 메타데이터를 찾지 못했습니다.</p>
          </div>
        </div>
      )}
    </AppShell>
  );
}
