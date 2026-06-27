export type MarkerType = "여기까지 읽음" | "중요" | "모름" | "단어" | "이해 안 됨" | "다시 보기" | "자유 메모";
export type PaperStatus = "not-started" | "reading" | "done";

export type ReadingMarker = {
  id: string;
  paperId?: string;
  pageNumber: number;
  xRatio: number;
  yRatio: number;
  widthRatio?: number;
  heightRatio?: number;
  markerType: MarkerType;
  memo: string;
  createdAt: string;
  updatedAt?: string;
  selectedText?: string;
};

export type SectionNote = {
  id: string;
  sectionName: string;
  note: string;
  updatedAt: string;
};

export type VocabularyItem = {
  id: string;
  term: string;
  meaning: string;
  context: string;
  updatedAt: string;
};

export type CoreNote = {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
};

export type Paper = {
  id: string;
  title: string;
  authors?: string;
  tags?: string[];
  status?: PaperStatus;
  progress?: number;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  createdAt?: string;
  updatedAt?: string;
  lastOpenedAt?: string;
  lastReadPage?: number;
  lastReadMarkerId?: string;
  currentPage: number;
  totalPages?: number;
  markers: ReadingMarker[];
  sectionNotes: SectionNote[];
  vocabulary: VocabularyItem[];
  coreNotes: CoreNote[];
};

export const MARKER_TYPES: MarkerType[] = [
  "여기까지 읽음",
  "중요",
  "모름",
  "단어",
  "이해 안 됨",
  "다시 보기",
  "자유 메모"
];
