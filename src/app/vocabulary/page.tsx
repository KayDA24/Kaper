"use client";

import AppShell from "@/components/app-shell";
import { usePapers } from "@/lib/hooks";

export default function VocabularyPage() {
  const { papers } = usePapers();
  const items = papers.flatMap((paper) => paper.vocabulary.map((item) => ({ paper, item })));

  return (
    <AppShell title="단어장">
      <section className="h-[calc(100vh-64px)] w-full overflow-y-auto px-6 py-6 transition-all duration-200">
        <h1 className="text-[32px] font-bold leading-10 tracking-tight">단어장</h1>
        <p className="mt-2 text-muted">논문별로 저장한 용어와 문맥을 한 곳에서 확인합니다.</p>
        <div className="mt-8 grid w-full grid-cols-3 gap-4 transition-all duration-200">
          {items.length === 0 ? <div className="col-span-3 rounded-2xl border border-dashed border-line bg-panel p-10 text-center text-muted">저장된 단어가 아직 없습니다.</div> : items.map(({ paper, item }) => (
            <article key={item.id} className="rounded-2xl border border-line bg-panel p-5 shadow-soft">
              <h2 className="text-lg font-bold">{item.term}</h2>
              <p className="mt-2 text-sm text-muted">{paper.title}</p>
              <p className="mt-4 leading-7">{item.meaning}</p>
              {item.context && <p className="mt-3 rounded-xl bg-canvas p-3 text-sm text-muted">{item.context}</p>}
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
