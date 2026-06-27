import { openDB, type DBSchema } from "idb";
import { MARKER_TYPES } from "./types";
import type { CoreNote, MarkerType, Paper, PaperStatus, ReadingMarker, SectionNote, VocabularyItem } from "./types";

const PAPERS_KEY = "kaper:v1:papers";
const THEME_KEY = "kaper:v1:theme";
const DB_NAME = "kaper-v1";
const PDF_STORE = "pdfFiles";

type Theme = "light" | "dark";

interface KaperDb extends DBSchema {
  pdfFiles: {
    key: string;
    value: Blob;
  };
}

const emptyPapers: Paper[] = [];
const PAPER_STATUSES: PaperStatus[] = ["not-started", "reading", "done"];

const isBrowser = () => typeof window !== "undefined";

const uid = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

async function getDb() {
  return openDB<KaperDb>(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(PDF_STORE)) {
        db.createObjectStore(PDF_STORE);
      }
    }
  });
}

const nowIso = () => new Date().toISOString();

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const asString = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const asNumber = (value: unknown, fallback = 0) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
const asOptionalNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

const asMarkerType = (value: unknown): MarkerType => (typeof value === "string" && MARKER_TYPES.includes(value as MarkerType) ? (value as MarkerType) : "중요");
const asPaperStatus = (value: unknown): PaperStatus | undefined => (typeof value === "string" && PAPER_STATUSES.includes(value as PaperStatus) ? (value as PaperStatus) : undefined);

function normalizeMarker(value: unknown, paperId: string): ReadingMarker {
  const marker = isRecord(value) ? value : {};
  const createdAt = asString(marker.createdAt, nowIso());
  return {
    id: asString(marker.id, uid()),
    paperId: asString(marker.paperId, paperId),
    pageNumber: Math.max(1, Math.round(asNumber(marker.pageNumber, 1))),
    xRatio: Math.min(1, Math.max(0, asNumber(marker.xRatio, 0))),
    yRatio: Math.min(1, Math.max(0, asNumber(marker.yRatio, 0))),
    widthRatio: asOptionalNumber(marker.widthRatio),
    heightRatio: asOptionalNumber(marker.heightRatio),
    markerType: asMarkerType(marker.markerType),
    memo: asString(marker.memo),
    createdAt,
    updatedAt: asString(marker.updatedAt, createdAt),
    selectedText: typeof marker.selectedText === "string" ? marker.selectedText : undefined
  };
}

function normalizeList<T>(value: unknown, normalize: (item: unknown) => T): T[] {
  return Array.isArray(value) ? value.map(normalize) : [];
}

export function normalizePaper(value: unknown): Paper {
  const paper = isRecord(value) ? value : {};
  const id = asString(paper.id, uid());
  const uploadedAt = asString(paper.uploadedAt, nowIso());
  return {
    id,
    title: asString(paper.title, "제목 없는 논문"),
    authors: typeof paper.authors === "string" ? paper.authors : undefined,
    tags: Array.isArray(paper.tags) ? paper.tags.filter((tag): tag is string => typeof tag === "string") : [],
    status: asPaperStatus(paper.status),
    progress: asOptionalNumber(paper.progress),
    fileName: asString(paper.fileName, "paper.pdf"),
    fileSize: asNumber(paper.fileSize, 0),
    uploadedAt,
    createdAt: asString(paper.createdAt, uploadedAt),
    updatedAt: asString(paper.updatedAt, uploadedAt),
    lastOpenedAt: typeof paper.lastOpenedAt === "string" ? paper.lastOpenedAt : undefined,
    lastReadPage: asOptionalNumber(paper.lastReadPage),
    lastReadMarkerId: typeof paper.lastReadMarkerId === "string" ? paper.lastReadMarkerId : undefined,
    currentPage: Math.max(1, Math.round(asNumber(paper.currentPage, 1))),
    totalPages: asOptionalNumber(paper.totalPages),
    markers: normalizeList(paper.markers, (marker) => normalizeMarker(marker, id)),
    sectionNotes: normalizeList(paper.sectionNotes, (note) => {
      const item = isRecord(note) ? note : {};
      return {
        id: asString(item.id, uid()),
        sectionName: asString(item.sectionName, "Section"),
        note: asString(item.note),
        updatedAt: asString(item.updatedAt, uploadedAt)
      };
    }),
    vocabulary: normalizeList(paper.vocabulary, (entry) => {
      const item = isRecord(entry) ? entry : {};
      return {
        id: asString(item.id, uid()),
        term: asString(item.term),
        meaning: asString(item.meaning),
        context: asString(item.context),
        updatedAt: asString(item.updatedAt, uploadedAt)
      };
    }),
    coreNotes: normalizeList(paper.coreNotes, (note) => {
      const item = isRecord(note) ? note : {};
      return {
        id: asString(item.id, uid()),
        title: asString(item.title, "핵심 노트"),
        body: asString(item.body),
        updatedAt: asString(item.updatedAt, uploadedAt)
      };
    })
  };
}

export function getStoredTheme(): Theme {
  if (!isBrowser()) return "light";
  return (window.localStorage.getItem(THEME_KEY) as Theme | null) ?? "light";
}

export function setStoredTheme(theme: Theme) {
  if (!isBrowser()) return;
  window.localStorage.setItem(THEME_KEY, theme);
}

export function getPapers(): Paper[] {
  if (!isBrowser()) return emptyPapers;
  const raw = window.localStorage.getItem(PAPERS_KEY);
  if (!raw) return emptyPapers;

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizePaper) : emptyPapers;
  } catch {
    return emptyPapers;
  }
}

export function savePapers(papers: Paper[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(PAPERS_KEY, JSON.stringify(papers.map(normalizePaper)));
  window.dispatchEvent(new CustomEvent("kaper:papers-updated"));
}

export function getPaper(id: string) {
  return getPapers().find((paper) => paper.id === id) ?? null;
}

export async function createPaperFromFile(file: File) {
  const id = uid();
  const now = nowIso();
  const title = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() || "제목 없는 논문";
  const paper: Paper = {
    id,
    title,
    fileName: file.name,
    fileSize: file.size,
    uploadedAt: now,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    currentPage: 1,
    tags: [],
    status: "not-started",
    markers: [],
    sectionNotes: [],
    vocabulary: [],
    coreNotes: []
  };

  const db = await getDb();
  await db.put(PDF_STORE, file, id);
  savePapers([paper, ...getPapers()]);
  return paper;
}

export async function getPdfBlob(id: string) {
  const db = await getDb();
  return (await db.get(PDF_STORE, id)) ?? null;
}

export async function deletePaper(id: string) {
  const db = await getDb();
  await db.delete(PDF_STORE, id);
  savePapers(getPapers().filter((paper) => paper.id !== id));
}

export function updatePaper(id: string, updater: (paper: Paper) => Paper) {
  const next = getPapers().map((paper) => (paper.id === id ? normalizePaper({ ...updater(paper), updatedAt: nowIso() }) : paper));
  savePapers(next);
  return next.find((paper) => paper.id === id) ?? null;
}

export function touchPaper(id: string) {
  return updatePaper(id, (paper) => ({ ...paper, lastOpenedAt: nowIso(), status: paper.status === "done" ? "done" : "reading" }));
}

export function setCurrentPage(paperId: string, pageNumber: number) {
  return updatePaper(paperId, (paper) => ({ ...paper, currentPage: pageNumber, lastReadPage: pageNumber }));
}

export function addMarker(paperId: string, marker: Omit<ReadingMarker, "id" | "createdAt" | "updatedAt">) {
  const timestamp = nowIso();
  const id = uid();
  return updatePaper(paperId, (paper) => ({
    ...paper,
    currentPage: marker.pageNumber,
    lastReadPage: marker.pageNumber,
    lastReadMarkerId: marker.markerType === "여기까지 읽음" ? id : paper.lastReadMarkerId,
    markers: [
      normalizeMarker({
        ...marker,
        id,
        paperId,
        createdAt: timestamp,
        updatedAt: timestamp
      }, paperId),
      ...paper.markers
    ]
  }));
}

export function deleteMarker(paperId: string, markerId: string) {
  return updatePaper(paperId, (paper) => ({
    ...paper,
    lastReadMarkerId: paper.lastReadMarkerId === markerId ? undefined : paper.lastReadMarkerId,
    markers: paper.markers.filter((marker) => marker.id !== markerId)
  }));
}

export function updateMarker(paperId: string, markerId: string, updates: Pick<ReadingMarker, "markerType" | "memo">) {
  const timestamp = nowIso();
  return updatePaper(paperId, (paper) => ({
    ...paper,
    lastReadMarkerId: updates.markerType === "여기까지 읽음" ? markerId : paper.lastReadMarkerId,
    markers: paper.markers.map((marker) => (marker.id === markerId ? normalizeMarker({ ...marker, ...updates, updatedAt: timestamp }, paperId) : marker))
  }));
}

export function updatePaperMetadata(paperId: string, metadata: Pick<Paper, "title"> & Partial<Pick<Paper, "authors" | "tags" | "status">>) {
  return updatePaper(paperId, (paper) => ({
    ...paper,
    title: metadata.title.trim() || paper.title,
    authors: metadata.authors?.trim() || undefined,
    tags: metadata.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [],
    status: metadata.status ?? paper.status
  }));
}

export function upsertSectionNote(paperId: string, note: Omit<SectionNote, "id" | "updatedAt"> & { id?: string }) {
  return updatePaper(paperId, (paper) => {
    const updated: SectionNote = { ...note, id: note.id ?? uid(), updatedAt: nowIso() };
    const exists = paper.sectionNotes.some((item) => item.id === updated.id);
    return { ...paper, sectionNotes: exists ? paper.sectionNotes.map((item) => (item.id === updated.id ? updated : item)) : [updated, ...paper.sectionNotes] };
  });
}

export function upsertVocabulary(paperId: string, item: Omit<VocabularyItem, "id" | "updatedAt"> & { id?: string }) {
  return updatePaper(paperId, (paper) => {
    const updated: VocabularyItem = { ...item, id: item.id ?? uid(), updatedAt: nowIso() };
    const exists = paper.vocabulary.some((entry) => entry.id === updated.id);
    return { ...paper, vocabulary: exists ? paper.vocabulary.map((entry) => (entry.id === updated.id ? updated : entry)) : [updated, ...paper.vocabulary] };
  });
}

export function upsertCoreNote(paperId: string, note: Omit<CoreNote, "id" | "updatedAt"> & { id?: string }) {
  return updatePaper(paperId, (paper) => {
    const updated: CoreNote = { ...note, id: note.id ?? uid(), updatedAt: nowIso() };
    const exists = paper.coreNotes.some((item) => item.id === updated.id);
    return { ...paper, coreNotes: exists ? paper.coreNotes.map((item) => (item.id === updated.id ? updated : item)) : [updated, ...paper.coreNotes] };
  });
}

export function getResumeTarget(paper: Paper) {
  const lastReadMarker = [...paper.markers]
    .filter((marker) => marker.markerType === "여기까지 읽음")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const savedMarker = paper.lastReadMarkerId ? paper.markers.find((marker) => marker.id === paper.lastReadMarkerId) : null;
  const marker = lastReadMarker ?? savedMarker;

  if (marker) {
    return { pageNumber: marker.pageNumber, markerId: marker.id, xRatio: marker.xRatio, yRatio: marker.yRatio };
  }

  return { pageNumber: paper.lastReadPage ?? paper.currentPage ?? 1 };
}

export function downloadBackup() {
  if (!isBrowser()) return;
  const date = new Date().toISOString().slice(0, 10);
  const payload = {
    app: "Kaper",
    version: "2.0",
    exportedAt: nowIso(),
    includesPdfFiles: false,
    papers: getPapers()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kaper-backup-${date}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export const formatFileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
};
