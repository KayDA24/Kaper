"use client";

import { MouseEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import type { MarkerType, Paper, ReadingMarker } from "@/lib/types";
import { MARKER_TYPES } from "@/lib/types";
import { addMarker, deleteMarker, getPdfBlob, touchPaper, upsertCoreNote, upsertSectionNote, upsertVocabulary } from "@/lib/storage";
import { extractPdfPages } from "@/lib/pdf-text";

type Tab = "reading" | "sections" | "vocabulary" | "notes";

type DragRect = {
  startX: number;
  startY: number;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
};

const markerStyles: Record<MarkerType, string> = {
  "여기까지 읽음": "bg-blue-400/30 border-blue-500/50",
  "중요": "bg-amber-300/45 border-amber-500/50",
  "모름": "bg-rose-300/45 border-rose-500/50",
  "단어": "bg-emerald-300/45 border-emerald-500/50",
  "이해 안 됨": "bg-rose-300/45 border-rose-500/50",
  "다시 보기": "bg-violet-300/45 border-violet-500/50",
  "자유 메모": "bg-sky-300/40 border-sky-500/50"
};

const quickMarkerTypes: MarkerType[] = ["중요", "모름", "단어"];
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default function PaperWorkspace({ paper }: { paper: Paper }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [textStatus, setTextStatus] = useState("PDF 텍스트를 분석하는 중입니다...");
  const [pageNumber, setPageNumber] = useState(paper.currentPage || 1);
  const [activeTab, setActiveTab] = useState<Tab>("reading");
  const [markerType, setMarkerType] = useState<MarkerType>("중요");
  const [markerMemo, setMarkerMemo] = useState("");
  const [markerMode, setMarkerMode] = useState(false);
  const [panelWidth, setPanelWidth] = useState(320);
  const [searchQuery, setSearchQuery] = useState("");
  const [draftRect, setDraftRect] = useState<DragRect | null>(null);
  const [pendingRect, setPendingRect] = useState<DragRect | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const resizePointerId = useRef<number | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(320);

  useEffect(() => {
    let objectUrl: string | null = null;
    touchPaper(paper.id);

    getPdfBlob(paper.id).then(async (blob) => {
      if (!blob) return;
      objectUrl = URL.createObjectURL(blob);
      setPdfUrl(objectUrl);

      try {
        const extractedPages = await extractPdfPages(blob);
        setPages(extractedPages);
        setTextStatus("");
      } catch {
        setTextStatus("PDF 텍스트 검색을 사용할 수 없습니다.");
      }
    });

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [paper.id]);

  useEffect(() => {
    const onSearch = (event: Event) => {
      const value = (event as CustomEvent<string>).detail ?? "";
      setSearchQuery(value);
    };

    window.addEventListener("kaper:search-query", onSearch);
    return () => window.removeEventListener("kaper:search-query", onSearch);
  }, []);

  const visibleMarkers = useMemo(() => paper.markers.filter((marker) => marker.pageNumber === pageNumber), [paper.markers, pageNumber]);
  const searchResults = useMemo(() => buildSearchResults(pages, searchQuery), [pages, searchQuery]);

  const getStagePoint = (event: MouseEvent<HTMLDivElement>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.min(rect.width, Math.max(0, event.clientX - rect.left)),
      y: Math.min(rect.height, Math.max(0, event.clientY - rect.top)),
      width: rect.width,
      height: rect.height
    };
  };

  const startAreaMarker = (event: MouseEvent<HTMLDivElement>) => {
    if (!markerMode) return;
    const point = getStagePoint(event);
    if (!point) return;
    dragStart.current = { x: point.x, y: point.y };
    setPendingRect(null);
    setDraftRect({ startX: point.x, startY: point.y, xRatio: point.x / point.width, yRatio: point.y / point.height, widthRatio: 0, heightRatio: 0 });
  };

  const updateAreaMarker = (event: MouseEvent<HTMLDivElement>) => {
    if (!markerMode || !dragStart.current) return;
    const point = getStagePoint(event);
    if (!point) return;
    const left = Math.min(dragStart.current.x, point.x);
    const top = Math.min(dragStart.current.y, point.y);
    const width = Math.abs(point.x - dragStart.current.x);
    const height = Math.abs(point.y - dragStart.current.y);
    setDraftRect({
      startX: dragStart.current.x,
      startY: dragStart.current.y,
      xRatio: left / point.width,
      yRatio: top / point.height,
      widthRatio: width / point.width,
      heightRatio: height / point.height
    });
  };

  const finishAreaMarker = () => {
    if (!markerMode || !draftRect) return;
    dragStart.current = null;
    if (draftRect.widthRatio < 0.01 || draftRect.heightRatio < 0.01) {
      setDraftRect(null);
      return;
    }
    setPendingRect(draftRect);
  };

  const createAreaMarker = (type: MarkerType) => {
    if (!pendingRect) return;
    addMarker(paper.id, {
      pageNumber,
      xRatio: pendingRect.xRatio,
      yRatio: pendingRect.yRatio,
      widthRatio: pendingRect.widthRatio,
      heightRatio: pendingRect.heightRatio,
      markerType: type,
      memo: markerMemo
    });
    setPendingRect(null);
    setDraftRect(null);
    setMarkerMemo("");
  };

  const startPanelResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizePointerId.current = event.pointerId;
    resizeStartX.current = event.clientX;
    resizeStartWidth.current = panelWidth;
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const resizePanel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (resizePointerId.current !== event.pointerId) return;
    const nextWidth = resizeStartWidth.current - (event.clientX - resizeStartX.current);
    setPanelWidth(Math.min(520, Math.max(280, nextWidth)));
  };

  const finishPanelResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (resizePointerId.current !== event.pointerId) return;
    resizePointerId.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  return (
    <div
      className="grid h-[calc(100vh-64px)] w-full overflow-hidden transition-all duration-200"
      style={{ gridTemplateColumns: `minmax(0, 1fr) ${panelWidth}px` }}
    >
      <section className="flex min-h-0 flex-col bg-canvas p-4">
        <div className="pdf-stage min-h-0 flex-1 overflow-auto rounded-2xl border border-line bg-panel p-6 shadow-soft">
          <div
            ref={stageRef}
            className="relative mx-auto min-h-[814px] w-full max-w-[960px] overflow-hidden rounded border border-line bg-white transition-all duration-200"
          >
            {pdfUrl ? (
              <object data={pdfUrl} type="application/pdf" className="h-[814px] w-full" aria-label={`${paper.title} PDF`}>
                <div className="p-8 text-center text-slate-700">브라우저가 내장 PDF 보기를 지원하지 않습니다.</div>
              </object>
            ) : (
              <div className="flex h-[814px] items-center justify-center text-slate-500">저장된 PDF 파일을 불러오는 중입니다.</div>
            )}

            <div
              className={`${markerMode ? "pointer-events-auto cursor-crosshair" : "pointer-events-none"} absolute inset-0`}
              onMouseDown={startAreaMarker}
              onMouseMove={updateAreaMarker}
              onMouseUp={finishAreaMarker}
              onMouseLeave={() => {
                dragStart.current = null;
              }}
              aria-label="PDF 마커 레이어"
            >
              {visibleMarkers.map((marker) => <AreaMarker key={marker.id} marker={marker} onDelete={() => deleteMarker(paper.id, marker.id)} />)}
              {draftRect && <DraftMarker rect={draftRect} />}
            </div>

            {pendingRect && (
              <div
                className="absolute z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-line bg-panel p-1 shadow-soft"
                style={{ left: `${(pendingRect.xRatio + pendingRect.widthRatio / 2) * 100}%`, top: `${Math.max(2, pendingRect.yRatio * 100 - 6)}%` }}
              >
                {quickMarkerTypes.map((type) => (
                  <button key={type} type="button" onClick={() => createAreaMarker(type)} className="rounded-full px-3 py-1.5 text-xs font-semibold text-ink hover:bg-canvas">
                    {type}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <aside className="relative min-h-0 overflow-y-auto border-l border-line bg-panel p-4">
        <div
          role="separator"
          aria-orientation="vertical"
          title="패널 폭 조절"
          onPointerDown={startPanelResize}
          onPointerMove={resizePanel}
          onPointerUp={finishPanelResize}
          onPointerCancel={finishPanelResize}
          className="absolute left-0 top-0 h-full w-2 -translate-x-1 cursor-col-resize hover:bg-brand/20"
        />
        <div className="flex gap-1 rounded-xl bg-canvas p-1 text-sm">
          <TabButton active={activeTab === "reading"} onClick={() => setActiveTab("reading")}>읽기 위치</TabButton>
          <TabButton active={activeTab === "sections"} onClick={() => setActiveTab("sections")}>섹션 관리</TabButton>
          <TabButton active={activeTab === "vocabulary"} onClick={() => setActiveTab("vocabulary")}>단어장</TabButton>
          <TabButton active={activeTab === "notes"} onClick={() => setActiveTab("notes")}>핵심 노트</TabButton>
        </div>

        {activeTab === "reading" && (
          <div className="mt-5 space-y-5">
            <div className="rounded-2xl border border-line bg-canvas p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold">마커 모드</h2>
                <button
                  type="button"
                  onClick={() => {
                    setMarkerMode((value) => !value);
                    setPendingRect(null);
                    setDraftRect(null);
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${markerMode ? "bg-brand text-white" : "border border-line bg-panel text-ink"}`}
                >
                  {markerMode ? "켜짐" : "꺼짐"}
                </button>
              </div>
              <p className="mt-2 text-sm text-muted">마커 모드를 켠 뒤 PDF 위 영역을 드래그하면 반투명 마크를 만들 수 있습니다.</p>
              <select value={markerType} onChange={(event) => setMarkerType(event.target.value as MarkerType)} className="mt-4 w-full rounded-xl border border-line bg-panel px-3 py-3 text-sm">
                {MARKER_TYPES.map((type) => <option key={type}>{type}</option>)}
              </select>
              <textarea value={markerMemo} onChange={(event) => setMarkerMemo(event.target.value)} placeholder="메모를 함께 남기기" className="mt-3 min-h-20 w-full rounded-xl border border-line bg-panel px-3 py-3 text-sm" />
              {pendingRect && (
                <button type="button" onClick={() => createAreaMarker(markerType)} className="mt-3 w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white">
                  선택 영역을 {markerType}(으)로 마크
                </button>
              )}
            </div>

            <div className="rounded-2xl border border-line bg-canvas p-4">
              <h2 className="font-bold">검색 결과</h2>
              <p className="mt-2 text-sm text-muted">{searchQuery.trim() ? `“${searchQuery}” ${searchResults.count}개 매칭` : "상단 검색창에서 논문 단어를 검색하세요."}</p>
              {textStatus && <p className="mt-2 text-xs text-muted">{textStatus}</p>}
              <div className="mt-3 space-y-2">
                {searchResults.items.slice(0, 5).map((item) => (
                  <button key={`${item.page}-${item.index}`} type="button" onClick={() => setPageNumber(item.page)} className="w-full rounded-xl border border-line bg-panel p-3 text-left text-xs hover:border-brand">
                    <strong>{item.page}페이지</strong>
                    <span className="mt-1 block leading-5 text-muted">{item.snippet}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-canvas p-4">
              <h2 className="font-bold">페이지 이동</h2>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <button type="button" onClick={() => setPageNumber((page) => Math.max(1, page - 1))} className="rounded-lg border border-line bg-panel px-3 py-2">이전</button>
                <input value={pageNumber} onChange={(event) => setPageNumber(Math.min(Math.max(1, Number(event.target.value) || 1), Math.max(1, pages.length || 1)))} className="w-16 rounded-lg border border-line bg-panel px-2 py-2 text-center" />
                <button type="button" onClick={() => setPageNumber((page) => Math.min(Math.max(1, pages.length || 1), page + 1))} className="rounded-lg border border-line bg-panel px-3 py-2">다음</button>
              </div>
            </div>

            <MarkerList paper={paper} />
          </div>
        )}
        {activeTab === "sections" && <SectionPanel paper={paper} />}
        {activeTab === "vocabulary" && <VocabularyPanel paper={paper} />}
        {activeTab === "notes" && <CoreNotesPanel paper={paper} />}
      </aside>
    </div>
  );
}

function AreaMarker({ marker, onDelete }: { marker: ReadingMarker; onDelete: () => void }) {
  const hasArea = marker.widthRatio && marker.heightRatio;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onDelete();
      }}
      title={`${marker.markerType}${marker.memo ? `: ${marker.memo}` : ""}`}
      className={`pointer-events-auto absolute border ${markerStyles[marker.markerType]} transition hover:ring-2 hover:ring-brand`}
      style={hasArea ? {
        left: `${marker.xRatio * 100}%`,
        top: `${marker.yRatio * 100}%`,
        width: `${(marker.widthRatio ?? 0) * 100}%`,
        height: `${(marker.heightRatio ?? 0) * 100}%`
      } : {
        left: `${marker.xRatio * 100}%`,
        top: `${marker.yRatio * 100}%`,
        width: 20,
        height: 20,
        borderRadius: 999
      }}
      aria-label={`${marker.markerType} 마커 삭제`}
    />
  );
}

function DraftMarker({ rect }: { rect: DragRect }) {
  return <div className="absolute border border-dashed border-brand bg-brand/20" style={{ left: `${rect.xRatio * 100}%`, top: `${rect.yRatio * 100}%`, width: `${rect.widthRatio * 100}%`, height: `${rect.heightRatio * 100}%` }} />;
}

function buildSearchResults(pages: string[], query: string) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return { count: 0, items: [] as { page: number; index: number; snippet: string }[] };
  const regex = new RegExp(escapeRegExp(trimmedQuery), "gi");
  const items: { page: number; index: number; snippet: string }[] = [];
  let count = 0;

  pages.forEach((page, pageIndex) => {
    for (const match of page.matchAll(regex)) {
      if (match.index === undefined) continue;
      count += 1;
      const start = Math.max(0, match.index - 42);
      const end = Math.min(page.length, match.index + match[0].length + 42);
      items.push({ page: pageIndex + 1, index: match.index, snippet: `${start > 0 ? "..." : ""}${page.slice(start, end)}${end < page.length ? "..." : ""}` });
    }
  });

  return { count, items };
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-semibold ${active ? "bg-panel text-brand shadow" : "text-muted"}`}>{children}</button>;
}

function MarkerList({ paper }: { paper: Paper }) {
  return (
    <div>
      <h2 className="font-bold">저장된 마커</h2>
      <div className="mt-3 space-y-3">
        {paper.markers.length === 0 ? <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">아직 마커가 없습니다.</p> : paper.markers.map((marker) => (
          <div key={marker.id} className="rounded-xl border border-line bg-canvas p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <strong>{marker.markerType}</strong>
              <div className="flex items-center gap-2">
                <span className="text-muted">{marker.pageNumber}p</span>
                <button type="button" onClick={() => deleteMarker(paper.id, marker.id)} className="rounded-md border border-line bg-panel px-2 py-1 text-xs text-muted transition hover:text-ink">삭제</button>
              </div>
            </div>
            {marker.memo && <p className="mt-2 leading-6 text-muted">{marker.memo}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionPanel({ paper }: { paper: Paper }) {
  const [sectionName, setSectionName] = useState("Abstract");
  const [note, setNote] = useState("");
  return (
    <FormSection title="섹션 관리" onSubmit={() => { if (!note.trim()) return; upsertSectionNote(paper.id, { sectionName, note }); setNote(""); }}>
      <input value={sectionName} onChange={(event) => setSectionName(event.target.value)} className="w-full rounded-xl border border-line bg-canvas px-3 py-3 text-sm" placeholder="Abstract, Introduction, Method..." />
      <textarea value={note} onChange={(event) => setNote(event.target.value)} className="min-h-28 w-full rounded-xl border border-line bg-canvas px-3 py-3 text-sm" placeholder="섹션별 이해 내용이나 질문" />
      <SavedList empty="저장된 섹션 노트가 없습니다." items={paper.sectionNotes.map((item) => ({ id: item.id, title: item.sectionName, body: item.note }))} />
    </FormSection>
  );
}

function VocabularyPanel({ paper }: { paper: Paper }) {
  const [term, setTerm] = useState("");
  const [meaning, setMeaning] = useState("");
  const [context, setContext] = useState("");
  return (
    <FormSection title="단어장" onSubmit={() => { if (!term.trim()) return; upsertVocabulary(paper.id, { term, meaning, context }); setTerm(""); setMeaning(""); setContext(""); }}>
      <input value={term} onChange={(event) => setTerm(event.target.value)} className="w-full rounded-xl border border-line bg-canvas px-3 py-3 text-sm" placeholder="용어" />
      <input value={meaning} onChange={(event) => setMeaning(event.target.value)} className="w-full rounded-xl border border-line bg-canvas px-3 py-3 text-sm" placeholder="뜻" />
      <textarea value={context} onChange={(event) => setContext(event.target.value)} className="min-h-24 w-full rounded-xl border border-line bg-canvas px-3 py-3 text-sm" placeholder="논문 속 문맥" />
      <SavedList empty="저장된 단어가 없습니다." items={paper.vocabulary.map((item) => ({ id: item.id, title: item.term, body: `${item.meaning}${item.context ? ` · ${item.context}` : ""}` }))} />
    </FormSection>
  );
}

function CoreNotesPanel({ paper }: { paper: Paper }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  return (
    <FormSection title="핵심 노트" onSubmit={() => { if (!title.trim() && !body.trim()) return; upsertCoreNote(paper.id, { title: title || "핵심 노트", body }); setTitle(""); setBody(""); }}>
      <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-xl border border-line bg-canvas px-3 py-3 text-sm" placeholder="노트 제목" />
      <textarea value={body} onChange={(event) => setBody(event.target.value)} className="min-h-32 w-full rounded-xl border border-line bg-canvas px-3 py-3 text-sm" placeholder="핵심 주장, 방법, 한계, 내 생각" />
      <SavedList empty="저장된 핵심 노트가 없습니다." items={paper.coreNotes.map((item) => ({ id: item.id, title: item.title, body: item.body }))} />
    </FormSection>
  );
}

function FormSection({ title, onSubmit, children }: { title: string; onSubmit: () => void; children: React.ReactNode }) {
  return (
    <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className="mt-5 space-y-3">
      <h2 className="font-bold">{title}</h2>
      {children}
      <button type="submit" className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white">저장</button>
    </form>
  );
}

function SavedList({ items, empty }: { items: { id: string; title: string; body: string }[]; empty: string }) {
  return (
    <div className="space-y-3 pt-3">
      {items.length === 0 ? <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">{empty}</p> : items.map((item) => (
        <article key={item.id} className="rounded-xl border border-line bg-canvas p-4 text-sm">
          <strong>{item.title}</strong>
          {item.body && <p className="mt-2 leading-6 text-muted">{item.body}</p>}
        </article>
      ))}
    </div>
  );
}