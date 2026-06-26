"use client";

import { useEffect, useState } from "react";
import type { Paper } from "./types";
import { getPapers } from "./storage";

export function usePapers() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => {
      setPapers(getPapers());
      setReady(true);
    };

    sync();
    window.addEventListener("kaper:papers-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("kaper:papers-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return { papers, ready };
}

export function usePaper(id: string) {
  const { papers, ready } = usePapers();
  return { paper: papers.find((item) => item.id === id) ?? null, ready };
}
