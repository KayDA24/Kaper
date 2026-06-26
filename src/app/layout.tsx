import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kaper v1.0",
  description: "PDF 논문을 업로드하고 읽기 위치, 메모, 단어장을 local-first로 관리하는 연구 워크스페이스"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
