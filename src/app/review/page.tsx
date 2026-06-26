"use client";

import AppShell from "@/components/app-shell";
import { usePapers } from "@/lib/hooks";

export default function ReviewPage() {
  const { papers } = usePapers();
  const reviewItems = papers.flatMap((paper) => paper.markers.filter((marker) => marker.markerType === "이해 안 됨" || marker.markerType === "다시 보기").map((marker) => ({ paper, marker })));

  return (
    <AppShell title="복습">
      <section className="h-[calc(100vh-64px)] w-full overflow-y-auto px-6 py-6 transition-all duration-200">
        <h1 className="text-[32px] font-bold leading-10 tracking-tight">복습</h1>
        <p className="mt-2 text-muted">이해 안 됨, 다시 보기 마커를 중심으로 복습 항목을 모읍니다.</p>
        <div className="mt-8 space-y-3">
          {reviewItems.length === 0 ? <Empty text="복습할 마커가 아직 없습니다." /> : reviewItems.map(({ paper, marker }) => (
            <div key={marker.id} className="rounded-2xl border border-line bg-panel p-5 shadow-soft">
              <p className="text-sm font-semibold text-brand">{marker.markerType} · {paper.title}</p>
              <p className="mt-2 text-sm text-muted">{marker.pageNumber}페이지 · x {marker.xRatio.toFixed(2)}, y {marker.yRatio.toFixed(2)}</p>
              {marker.memo && <p className="mt-3 text-ink">{marker.memo}</p>}
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-line bg-panel p-10 text-center text-muted">{text}</div>;
}
