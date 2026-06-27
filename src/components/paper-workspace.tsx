"use client";

import { MouseEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import type { MarkerType, Paper, ReadingMarker } from "@/lib/types";
import { MARKER_TYPES } from "@/lib/types";
import { ensurePdfJsPolyfills } from "@/lib/pdf-polyfills";
import {
  addMarker,
  deleteMarker,
  getPdfBlob,
  getResumeTarget,
  setCurrentPage,
  touchPaper,
  updateMarker,
  upsertCoreNote,
  upsertSectionNote,
  upsertVocabulary
} from "@/lib/storage";

type Tab = "reading" | "sections" | "vocabulary" | "notes";
type MarkerFilter = "전체" | MarkerType;

type DragRect = {
  pageNumber: number;
  startX: number;
  startY: number;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
};

type PdfViewport = {
  width: number;
  height: number;
};

type PdfRenderTask = {
  promise: Promise<void>;
  cancel?: () => void;
};

type PdfPage = {
  getViewport: (options: { scale: number }) => PdfViewport;
  render: (options: { canvas: HTMLCanvasElement | null; canvasContext?: CanvasRenderingContext2D; viewport: PdfViewport }) => PdfRenderTask;
};

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
  destroy?: () => Promise<void> | void;
};

type SearchResult = {
  id: string;
  label: string;
  snippet: string;
  pageNumber?: number;
  markerId?: string;
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

const quickMarkerTypes: MarkerType[] = ["여기까지 읽음", "중요", "이해 안 됨", "다시 보기"];
const markerFilters: MarkerFilter[] = ["전체", ...MARKER_TYPES];
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

ensurePdfJsPolyfills();

export default function PaperWorkspace({
  paper,
  initialPage,
  initialMarkerId
}: {
  paper: Paper;
  initialPage?: number;
  initialMarkerId?: string;
}) {
  const [pdfDocument, setPdfDocument] = useState<PdfDocument | null>(null);
  const [pdfStatus, setPdfStatus] = useState("저장된 PDF 파일을 불러오는 중입니다.");
  const [totalPages, setTotalPages] = useState(paper.totalPages ?? 0);
  const [pageNumber, setPageNumber] = useState(paper.currentPage || 1);
  const [activeTab, setActiveTab] = useState<Tab>("reading");
  const [markerType, setMarkerType] = useState<MarkerType>("중요");
  const [markerMemo, setMarkerMemo] = useState("");
  const [markerMode, setMarkerMode] = useState(false);
  const [panelWidth, setPanelWidth] = useState(320);
  const [searchQuery, setSearchQuery] = useState("");
  const [draftRect, setDraftRect] = useState<DragRect | null>(null);
  const [pendingRect, setPendingRect] = useState<DragRect | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const dragStart = useRef<{ x: number; y: number; pageNumber: number } | null>(null);
  const resizePointerId = useRef<number | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(320);
  const initialScrollDone = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let loadedDocument: PdfDocument | null = null;
    touchPaper(paper.id);
    setPdfStatus("저장된 PDF 파일을 불러오는 중입니다.");

    getPdfBlob(paper.id).then(async (blob) => {
      if (!blob || cancelled) {
        if (!cancelled) setPdfStatus("저장된 PDF 파일을 찾을 수 없습니다.");
        return;
      }

      try {
        ensurePdfJsPolyfills();
        const pdfjs = await import("pdfjs-dist");
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
        }

        const data = await blob.arrayBuffer();
        loadedDocument = (await pdfjs.getDocument({ data }).promise) as unknown as PdfDocument;
        if (cancelled) return;
        setPdfDocument(loadedDocument);
        setTotalPages(loadedDocument.numPages);
        setPdfStatus("");
      } catch {
        if (!cancelled) setPdfStatus("PDF를 렌더링할 수 없습니다.");
      }
    });

    return () => {
      cancelled = true;
      loadedDocument?.destroy?.();
      setPdfDocument(null);
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

  useEffect(() => {
    if (!pdfDocument || initialScrollDone.current) return;
    const targetMarker = initialMarkerId ? paper.markers.find((marker) => marker.id === initialMarkerId) : null;
    const resumeTarget = targetMarker ?? getResumeTarget(paper);
    const targetPage = targetMarker?.pageNumber ?? initialPage ?? resumeTarget.pageNumber;
    initialScrollDone.current = true;

    window.setTimeout(() => {
      if (targetMarker) {
        scrollToMarker(targetMarker);
        return;
      }
      scrollToPage(targetPage);
    }, 250);
  }, [pdfDocument, initialMarkerId, initialPage, paper]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || totalPages === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const nextPage = Number((visible?.target as HTMLElement | undefined)?.dataset.pageNumber);
        if (nextPage) setPageNumber(nextPage);
      },
      { root, threshold: [0.35, 0.6, 0.85] }
    );

    Object.values(pageRefs.current).forEach((page) => {
      if (page) observer.observe(page);
    });

    return () => observer.disconnect();
  }, [totalPages, pdfDocument]);

  const pageNumbers = useMemo(() => Array.from({ length: totalPages }, (_, index) => index + 1), [totalPages]);
  const searchResults = useMemo(() => buildSearchResults(paper, searchQuery), [paper, searchQuery]);

  const getPagePoint = (event: MouseEvent<HTMLDivElement>, targetPage: number) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      pageNumber: targetPage,
      x: Math.min(rect.width, Math.max(0, event.clientX - rect.left)),
      y: Math.min(rect.height, Math.max(0, event.clientY - rect.top)),
      width: rect.width,
      height: rect.height
    };
  };

  const startAreaMarker = (event: MouseEvent<HTMLDivElement>, targetPage: number) => {
    if (!markerMode) return;
    event.preventDefault();
    const point = getPagePoint(event, targetPage);
    dragStart.current = { x: point.x, y: point.y, pageNumber: targetPage };
    setPendingRect(null);
    setDraftRect({ pageNumber: targetPage, startX: point.x, startY: point.y, xRatio: point.x / point.width, yRatio: point.y / point.height, widthRatio: 0, heightRatio: 0 });
  };

  const updateAreaMarker = (event: MouseEvent<HTMLDivElement>, targetPage: number) => {
    if (!markerMode || !dragStart.current || dragStart.current.pageNumber !== targetPage) return;
    const point = getPagePoint(event, targetPage);
    const left = Math.min(dragStart.current.x, point.x);
    const top = Math.min(dragStart.current.y, point.y);
    const width = Math.abs(point.x - dragStart.current.x);
    const height = Math.abs(point.y - dragStart.current.y);
    setDraftRect({
      pageNumber: targetPage,
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
    setPendingRect(draftRect);
  };

  const createAreaMarker = (type: MarkerType) => {
    if (!pendingRect) return;
    addMarker(paper.id, {
      pageNumber: pendingRect.pageNumber,
      xRatio: pendingRect.xRatio,
      yRatio: pendingRect.yRatio,
      widthRatio: pendingRect.widthRatio > 0.01 ? pendingRect.widthRatio : undefined,
      heightRatio: pendingRect.heightRatio > 0.01 ? pendingRect.heightRatio : undefined,
      markerType: type,
      memo: markerMemo
    });
    setCurrentPage(paper.id, pendingRect.pageNumber);
    setPendingRect(null);
    setDraftRect(null);
    setMarkerMemo("");
  };

  const scrollToPage = (targetPage: number) => {
    const page = pageRefs.current[targetPage];
    const scroller = scrollRef.current;
    if (!page || !scroller) return;
    scroller.scrollTo({ top: Math.max(0, page.offsetTop - 24), behavior: "smooth" });
    setPageNumber(targetPage);
    setCurrentPage(paper.id, targetPage);
  };

  const scrollToMarker = (marker: ReadingMarker) => {
    const page = pageRefs.current[marker.pageNumber];
    const scroller = scrollRef.current;
    if (!page || !scroller) return;
    scroller.scrollTo({ top: Math.max(0, page.offsetTop + marker.yRatio * page.offsetHeight - 120), behavior: "smooth" });
    setPageNumber(marker.pageNumber);
    setCurrentPage(paper.id, marker.pageNumber);
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
        <div ref={scrollRef} className="pdf-stage min-h-0 flex-1 overflow-auto rounded-2xl border border-line bg-panel p-6 shadow-soft">
          {pdfStatus ? (
            <div className="flex min-h-[640px] items-center justify-center rounded-xl border border-dashed border-line bg-white text-slate-500">{pdfStatus}</div>
          ) : (
            <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6">
              {pageNumbers.map((targetPage) => (
                <PdfPageView
                  key={targetPage}
                  document={pdfDocument}
                  pageNumber={targetPage}
                  setPageRef={(node) => {
                    pageRefs.current[targetPage] = node;
                  }}
                >
                  <div
                    className={`${markerMode ? "pointer-events-auto cursor-crosshair" : "pointer-events-none"} absolute inset-0`}
                    onMouseDown={(event) => startAreaMarker(event, targetPage)}
                    onMouseMove={(event) => updateAreaMarker(event, targetPage)}
                    onMouseUp={finishAreaMarker}
                    onMouseLeave={() => {
                      dragStart.current = null;
                    }}
                    aria-label={`${targetPage}페이지 마커 레이어`}
                  >
                    {paper.markers.filter((marker) => marker.pageNumber === targetPage).map((marker) => (
                      <AreaMarker key={marker.id} marker={marker} onSelect={() => scrollToMarker(marker)} />
                    ))}
                    {draftRect?.pageNumber === targetPage && <DraftMarker rect={draftRect} />}
                  </div>
                  {pendingRect?.pageNumber === targetPage && (
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
                </PdfPageView>
              ))}
            </div>
          )}
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
                <div>
                  <h2 className="font-bold">마커 모드</h2>
                  <p className="mt-1 text-xs text-muted">현재 {pageNumber}페이지</p>
                </div>
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
              <p className="mt-2 text-sm text-muted">마커 모드를 켠 뒤 PDF 페이지 위를 클릭하거나 드래그하면 해당 페이지 좌표에 마커를 저장합니다.</p>
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

            <SearchResults results={searchResults} query={searchQuery} onJump={(marker) => scrollToMarker(marker)} paper={paper} />
            <MarkerList paper={paper} onJump={scrollToMarker} />
          </div>
        )}
        {activeTab === "sections" && <SectionPanel paper={paper} />}
        {activeTab === "vocabulary" && <VocabularyPanel paper={paper} />}
        {activeTab === "notes" && <CoreNotesPanel paper={paper} />}
      </aside>
    </div>
  );
}

function PdfPageView({
  document,
  pageNumber,
  setPageRef,
  children
}: {
  document: PdfDocument | null;
  pageNumber: number;
  setPageRef: (node: HTMLDivElement | null) => void;
  children: React.ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [renderError, setRenderError] = useState("");

  useEffect(() => {
    setPageRef(wrapperRef.current);
    return () => setPageRef(null);
  }, [setPageRef]);

  useEffect(() => {
    if (!document) return;
    let cancelled = false;
    let renderTask: PdfRenderTask | null = null;

    const renderPage = async () => {
      const canvas = canvasRef.current;
      const wrapper = wrapperRef.current;
      if (!canvas || !wrapper) return;

      try {
        ensurePdfJsPolyfills();
        setRenderError("");
        const page = await document.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.min(900, Math.max(620, wrapper.parentElement?.clientWidth ?? 820));
        const scale = availableWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const context = canvas.getContext("2d");
        if (!context || cancelled) return;
        const outputScale = Math.min(window.devicePixelRatio || 1, 3);

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
        setPageSize({ width: viewport.width, height: viewport.height });

        renderTask = page.render({ canvas: null, canvasContext: context, viewport });
        await renderTask.promise;
      } catch (error) {
        if (!cancelled && !(error instanceof Error && error.name === "RenderingCancelledException")) {
          setPageSize({ width: 0, height: 0 });
          const message = error instanceof Error ? error.message : "알 수 없는 오류";
          console.error("PDF page render failed", error);
          setRenderError(`이 페이지를 렌더링하지 못했습니다. ${message}`);
        }
      }
    };

    renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel?.();
    };
  }, [document, pageNumber]);

  return (
    <div
      ref={wrapperRef}
      data-page-number={pageNumber}
      className="relative mx-auto overflow-hidden rounded border border-line bg-white shadow-soft"
      style={pageSize.width && pageSize.height ? { width: pageSize.width, height: pageSize.height } : { minHeight: 640, width: "100%" }}
    >
      <canvas ref={canvasRef} aria-label={`${pageNumber}페이지 PDF`} className="block" />
      {renderError && <div className="absolute inset-0 grid place-items-center bg-white text-sm text-slate-500">{renderError}</div>}
      {pageSize.width > 0 && children}
    </div>
  );
}

function AreaMarker({ marker, onSelect }: { marker: ReadingMarker; onSelect: () => void }) {
  const hasArea = Boolean(marker.widthRatio && marker.heightRatio);
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
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
        borderRadius: 999,
        transform: "translate(-50%, -50%)"
      }}
      aria-label={`${marker.markerType} 마커로 이동`}
    />
  );
}

function DraftMarker({ rect }: { rect: DragRect }) {
  const isArea = rect.widthRatio > 0.01 && rect.heightRatio > 0.01;
  return (
    <div
      className="absolute border border-dashed border-brand bg-brand/20"
      style={isArea ? {
        left: `${rect.xRatio * 100}%`,
        top: `${rect.yRatio * 100}%`,
        width: `${rect.widthRatio * 100}%`,
        height: `${rect.heightRatio * 100}%`
      } : {
        left: `${rect.xRatio * 100}%`,
        top: `${rect.yRatio * 100}%`,
        width: 20,
        height: 20,
        borderRadius: 999,
        transform: "translate(-50%, -50%)"
      }}
    />
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-semibold ${active ? "bg-panel text-brand shadow" : "text-muted"}`}>{children}</button>;
}

function SearchResults({ results, query, paper, onJump }: { results: SearchResult[]; query: string; paper: Paper; onJump: (marker: ReadingMarker) => void }) {
  const trimmed = query.trim();
  return (
    <div className="rounded-2xl border border-line bg-canvas p-4">
      <h2 className="font-bold">검색 결과</h2>
      <p className="mt-2 text-sm text-muted">{trimmed ? `“${trimmed}” ${results.length}개 매칭` : "상단 검색창에서 노트·단어·마커를 검색하세요."}</p>
      <div className="mt-3 space-y-2">
        {results.slice(0, 6).map((item) => {
          const marker = item.markerId ? paper.markers.find((entry) => entry.id === item.markerId) : null;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (marker) onJump(marker);
              }}
              className="w-full rounded-xl border border-line bg-panel p-3 text-left text-xs hover:border-brand"
            >
              <strong>{item.label}</strong>
              <span className="mt-1 block leading-5 text-muted">{item.snippet}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MarkerList({ paper, onJump }: { paper: Paper; onJump: (marker: ReadingMarker) => void }) {
  const [filter, setFilter] = useState<MarkerFilter>("전체");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<MarkerType>("중요");
  const [editMemo, setEditMemo] = useState("");
  const markers = useMemo(() => {
    const filtered = filter === "전체" ? paper.markers : paper.markers.filter((marker) => marker.markerType === filter);
    return [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [filter, paper.markers]);

  const startEdit = (marker: ReadingMarker) => {
    setEditingId(marker.id);
    setEditType(marker.markerType);
    setEditMemo(marker.memo);
  };

  const saveEdit = (marker: ReadingMarker) => {
    updateMarker(paper.id, marker.id, { markerType: editType, memo: editMemo });
    setEditingId(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">저장된 마커</h2>
        <select value={filter} onChange={(event) => setFilter(event.target.value as MarkerFilter)} className="rounded-lg border border-line bg-canvas px-2 py-1 text-xs">
          {markerFilters.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>
      <div className="mt-3 space-y-3">
        {markers.length === 0 ? <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">아직 마커가 없습니다.</p> : markers.map((marker) => (
          <div key={marker.id} className="rounded-xl border border-line bg-canvas p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <strong>{marker.markerType}</strong>
              <span className="text-muted">{marker.pageNumber}p</span>
            </div>
            {editingId === marker.id ? (
              <div className="mt-3 space-y-2">
                <select value={editType} onChange={(event) => setEditType(event.target.value as MarkerType)} className="w-full rounded-lg border border-line bg-panel px-2 py-2 text-xs">
                  {MARKER_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
                <textarea value={editMemo} onChange={(event) => setEditMemo(event.target.value)} className="min-h-20 w-full rounded-lg border border-line bg-panel px-2 py-2 text-xs" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => saveEdit(marker)} className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white">저장</button>
                  <button type="button" onClick={() => setEditingId(null)} className="rounded-md border border-line bg-panel px-3 py-1.5 text-xs">취소</button>
                </div>
              </div>
            ) : (
              <>
                {marker.memo && <p className="mt-2 line-clamp-2 leading-6 text-muted">{marker.memo}</p>}
                <p className="mt-2 text-xs text-muted">{formatDateTime(marker.createdAt)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => onJump(marker)} className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white">이동</button>
                  <button type="button" onClick={() => startEdit(marker)} className="rounded-md border border-line bg-panel px-3 py-1.5 text-xs">수정</button>
                  <button type="button" onClick={() => deleteMarker(paper.id, marker.id)} className="rounded-md border border-line bg-panel px-3 py-1.5 text-xs text-muted transition hover:text-ink">삭제</button>
                </div>
              </>
            )}
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

function buildSearchResults(paper: Paper, query: string): SearchResult[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];
  const regex = new RegExp(escapeRegExp(trimmedQuery), "i");
  const includes = (value: string) => regex.test(value);
  const results: SearchResult[] = [];

  paper.markers.forEach((marker) => {
    if (includes(marker.memo) || includes(marker.markerType)) {
      results.push({ id: `marker-${marker.id}`, label: `마커 · ${marker.markerType} · ${marker.pageNumber}p`, snippet: marker.memo || "메모 없음", pageNumber: marker.pageNumber, markerId: marker.id });
    }
  });

  paper.vocabulary.forEach((item) => {
    const text = `${item.term} ${item.meaning} ${item.context}`;
    if (includes(text)) {
      results.push({ id: `vocabulary-${item.id}`, label: `단어 · ${item.term}`, snippet: item.meaning || item.context || "저장된 단어" });
    }
  });

  paper.coreNotes.forEach((item) => {
    const text = `${item.title} ${item.body}`;
    if (includes(text)) {
      results.push({ id: `note-${item.id}`, label: `핵심 노트 · ${item.title}`, snippet: item.body || "저장된 핵심 노트" });
    }
  });

  paper.sectionNotes.forEach((item) => {
    const text = `${item.sectionName} ${item.note}`;
    if (includes(text)) {
      results.push({ id: `section-${item.id}`, label: `섹션 · ${item.sectionName}`, snippet: item.note || "저장된 섹션 노트" });
    }
  });

  return results;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
