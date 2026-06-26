export type MarkerType = "여기까지 읽음" | "중요" | "모름" | "단어" | "이해 안 됨" | "다시 보기" | "자유 메모";

export type ReadingMarker = {
  id: string;
  pageNumber: number;
  xRatio: number;
  yRatio: number;
  widthRatio?: number;
  heightRatio?: number;
  markerType: MarkerType;
  memo: string;
  createdAt: string;
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
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  lastOpenedAt?: string;
  currentPage: number;
  totalPages?: number;
  markers: ReadingMarker[];
  sectionNotes: SectionNote[];
  vocabulary: VocabularyItem[];
  coreNotes: CoreNote[];
};

export const MARKER_TYPES: MarkerType[] = [
  "중요",
  "모름",
  "단어",
  "다시 보기",
  "자유 메모"
];
