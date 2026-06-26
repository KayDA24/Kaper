import { openDB, type DBSchema } from "idb";
import type { CoreNote, Paper, ReadingMarker, SectionNote, VocabularyItem } from "./types";

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
    const parsed = JSON.parse(raw) as Paper[];
    return Array.isArray(parsed) ? parsed : emptyPapers;
  } catch {
    return emptyPapers;
  }
}

export function savePapers(papers: Paper[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(PAPERS_KEY, JSON.stringify(papers));
  window.dispatchEvent(new CustomEvent("kaper:papers-updated"));
}

export function getPaper(id: string) {
  return getPapers().find((paper) => paper.id === id) ?? null;
}

export async function createPaperFromFile(file: File) {
  const id = uid();
  const now = new Date().toISOString();
  const title = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() || "제목 없는 논문";
  const paper: Paper = {
    id,
    title,
    fileName: file.name,
    fileSize: file.size,
    uploadedAt: now,
    lastOpenedAt: now,
    currentPage: 1,
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
  const next = getPapers().map((paper) => (paper.id === id ? updater(paper) : paper));
  savePapers(next);
  return next.find((paper) => paper.id === id) ?? null;
}

export function touchPaper(id: string) {
  return updatePaper(id, (paper) => ({ ...paper, lastOpenedAt: new Date().toISOString() }));
}

export function addMarker(paperId: string, marker: Omit<ReadingMarker, "id" | "createdAt">) {
  return updatePaper(paperId, (paper) => ({
    ...paper,
    currentPage: marker.pageNumber,
    markers: [
      {
        ...marker,
        id: uid(),
        createdAt: new Date().toISOString()
      },
      ...paper.markers
    ]
  }));
}

export function deleteMarker(paperId: string, markerId: string) {
  return updatePaper(paperId, (paper) => ({
    ...paper,
    markers: paper.markers.filter((marker) => marker.id !== markerId)
  }));
}

export function upsertSectionNote(paperId: string, note: Omit<SectionNote, "id" | "updatedAt"> & { id?: string }) {
  return updatePaper(paperId, (paper) => {
    const updated: SectionNote = { ...note, id: note.id ?? uid(), updatedAt: new Date().toISOString() };
    const exists = paper.sectionNotes.some((item) => item.id === updated.id);
    return { ...paper, sectionNotes: exists ? paper.sectionNotes.map((item) => (item.id === updated.id ? updated : item)) : [updated, ...paper.sectionNotes] };
  });
}

export function upsertVocabulary(paperId: string, item: Omit<VocabularyItem, "id" | "updatedAt"> & { id?: string }) {
  return updatePaper(paperId, (paper) => {
    const updated: VocabularyItem = { ...item, id: item.id ?? uid(), updatedAt: new Date().toISOString() };
    const exists = paper.vocabulary.some((entry) => entry.id === updated.id);
    return { ...paper, vocabulary: exists ? paper.vocabulary.map((entry) => (entry.id === updated.id ? updated : entry)) : [updated, ...paper.vocabulary] };
  });
}

export function upsertCoreNote(paperId: string, note: Omit<CoreNote, "id" | "updatedAt"> & { id?: string }) {
  return updatePaper(paperId, (paper) => {
    const updated: CoreNote = { ...note, id: note.id ?? uid(), updatedAt: new Date().toISOString() };
    const exists = paper.coreNotes.some((item) => item.id === updated.id);
    return { ...paper, coreNotes: exists ? paper.coreNotes.map((item) => (item.id === updated.id ? updated : item)) : [updated, ...paper.coreNotes] };
  });
}

export const formatFileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
};
