"use client";
import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

type ChapterItem = {
  id: number;
  title: string;
  file: string; 
};

interface PDFViewerProps {
  textbookId: string;
}

export function PDFViewer({ textbookId }: PDFViewerProps) {
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [showActions, setShowActions] = useState(false);
  const [actionPosition, setActionPosition] = useState({ x: 0, y: 0 });
  const [currentChapterId, setCurrentChapterId] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Load chapters for textbook, then load first chapter content
  useEffect(() => {
    let isCancelled = false;

    const loadFirstChapter = async () => {
      setIsLoading(true);
      setError(null);
      setHtmlContent(null);
      setPdfUrl(null);

      try {
        // 1) Fetch chapters for the textbook
        const resp = await fetch(`/api/chapters/${encodeURIComponent(textbookId)}`);
        if (!resp.ok) throw new Error(`Failed to fetch chapters (${resp.status})`);
        const data = await resp.json();
        const rawChapters = data?.chapters ?? [];
        const chaptersArray = Array.isArray(rawChapters)
          ? rawChapters
          : typeof rawChapters === "object" && rawChapters !== null
            ? Object.values(rawChapters)
            : [];
        const chapters: ChapterItem[] = chaptersArray.map((c: any) => ({
          id: Number(c.id ?? c.chapter_id ?? c.key ?? 0),
          title: String(c.title ?? `Chapter ${c.id ?? c.chapter_id ?? ""}`),
          file: String(c.file ?? ""),
        }));

        if (chapters.length === 0) throw new Error("No chapters found for this textbook");

        // 2) Pick first chapter by smallest id
        const first = [...chapters].sort((a, b) => a.id - b.id)[0];
        setCurrentChapterId(first.id);

        // 3) Try to load HTML version
        const htmlPath = `/textbooks/${encodeURIComponent(textbookId)}/chapter${first.id}.html`;
        try {
          const htmlResp = await fetch(htmlPath, { cache: "no-store" });
          if (htmlResp.ok) {
            const html = await htmlResp.text();
            if (!isCancelled) setHtmlContent(html);
          } else {
            // Fall back to PDF via API
            if (!isCancelled) setPdfUrl(`/api/pdf/${encodeURIComponent(textbookId)}/${first.id}`);
          }
        } catch {
          if (!isCancelled) setPdfUrl(`/api/pdf/${encodeURIComponent(textbookId)}/${first.id}`);
        }
      } catch (err) {
        if (!isCancelled) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    if (textbookId) loadFirstChapter();

    return () => {
      isCancelled = true;
    };
  }, [textbookId]);

  // Persist scroll-based reading progress to localStorage (per textbook/chapter)
  useEffect(() => {
    if (!currentChapterId) return;

    // Identify the element that actually scrolls. Try in this order:
    // 1) Known inner container from pdf2htmlEX: #page-container inside our viewer
    // 2) A scrollable descendant of our viewer (first match)
    // 3) Our own viewer container
    // 4) A scrollable ancestor (fallback)
    const findScrollableDescendant = (root: HTMLElement | null): HTMLElement | null => {
      if (!root) return null;
      const pageContainer = root.querySelector<HTMLElement>("#page-container");
      const candidateList: HTMLElement[] = [];
      if (pageContainer) candidateList.push(pageContainer);
      // Add immediate children that look scrollable
      candidateList.push(...Array.from(root.querySelectorAll<HTMLElement>("div, section, article")));
      for (const el of candidateList) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        const isScrollable = (overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight;
        if (isScrollable) return el;
      }
      return null;
    };

    const findScrollableAncestor = (node: HTMLElement | null): HTMLElement | null => {
      let el: HTMLElement | null = node;
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        const isScrollable = (overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight;
        if (isScrollable) return el;
        el = el.parentElement;
      }
      return (document.scrollingElement as HTMLElement) || (document.documentElement as HTMLElement);
    };

    const preferred = scrollContainerRef.current;
    const container = findScrollableDescendant(preferred) || preferred || findScrollableAncestor(preferred);
    if (!container) return;

    let ticking = false;

    const updateProgress = () => {
      ticking = false;
      const maxScrollable = container.scrollHeight - container.clientHeight;
      if (maxScrollable <= 0) return;
      const rawPercent = (container.scrollTop / maxScrollable) * 100;
      const clampedPercent = Math.max(0, Math.min(100, Math.round(rawPercent)));

      try {
        const key = "readingProgress";
        const existing = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
        const parsed: Record<string, Record<string, number>> = existing ? JSON.parse(existing) : {};
        const byTextbook = parsed[textbookId] || {};
        const currentStored = Number(byTextbook[String(currentChapterId)] || 0);
        const next = Math.max(currentStored, clampedPercent);
        if (next !== currentStored) {
          byTextbook[String(currentChapterId)] = next;
          parsed[textbookId] = byTextbook;
          window.localStorage.setItem(key, JSON.stringify(parsed));
          // Notify listeners within this tab
          window.dispatchEvent(
            new CustomEvent("reading-progress", {
              detail: { textbookId, chapterId: String(currentChapterId), percent: next },
            })
          );
        }
      } catch {
        // ignore localStorage errors
      }
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(updateProgress);
      }
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateProgress);
    // Kick once in case we're already scrolled
    updateProgress();

    return () => {
      container.removeEventListener("scroll", onScroll as EventListener);
      window.removeEventListener("resize", updateProgress);
    };
  }, [textbookId, currentChapterId, htmlContent, pdfUrl]);

  const handleTextSelection = (e: React.MouseEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const text = selection.toString().trim();
      setSelectedText(text);

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setActionPosition({
        x: rect.left + rect.width / 2,
        y: rect.bottom + 10,
      });
      setShowActions(true);
    }
  };

  const handleDocumentClick = (e: MouseEvent) => {
    if (!(e.target as Element).closest(".action-popup")) {
      setShowActions(false);
    }
  };

  useEffect(() => {
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  const handleAsk = () => {
    console.log("Ask about:", selectedText);
    setShowActions(false);
  };

  const handleAddToNotes = () => {
    console.log("Add to notes:", selectedText);
    setShowActions(false);
  };

  const handleHighlight = () => {
    console.log("Highlight:", selectedText);
    setShowActions(false);
  };

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-red-400 text-center">
          <div className="mb-2">Error: {error}</div>
          <div className="text-sm text-gray-400">Make sure chapters are available for this textbook and metadata.json is set</div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-white">Loading content...</div>
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef} className="h-full overflow-auto bg-white p-4 relative">
      {/* Inject custom styles to override pdf2htmlEX defaults */}
      <style>
        {`
          .pf {
            box-shadow: none !important;
            border: none !important;
          }
          #page-container {
            background-color: white !important;
            background-image: none !important;
          }
        `}
      </style>

      {htmlContent && (
        <div
          className="max-w-4xl mx-auto prose prose-sm"
          style={{ userSelect: "text", cursor: "text" }}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
          onMouseUp={handleTextSelection}
        />
      )}

      {!htmlContent && pdfUrl && (
        <iframe
          src={pdfUrl}
          className="w-full h-full min-h-[80vh]"
          title="Chapter PDF"
        />
      )}

      {showActions && (
        <div
          className="action-popup fixed z-50 bg-[#2d2d30] border border-[#3e3e42] rounded-lg shadow-lg p-2 flex gap-2"
          style={{
            left: `${actionPosition.x}px`,
            top: `${actionPosition.y}px`,
            transform: "translateX(-50%)",
          }}
        >
          <button
            onClick={handleAsk}
            className="px-3 py-1 text-xs bg-[#007acc] text-white rounded hover:bg-[#005a9e] transition-colors"
          >
            Ask
          </button>
          <button
            onClick={handleAddToNotes}
            className="px-3 py-1 text-xs bg-[#4ec9b0] text-white rounded hover:bg-[#3a9b85] transition-colors"
          >
            Add to Notes
          </button>
          <button
            onClick={handleHighlight}
            className="px-3 py-1 text-xs bg-[#dcdcaa] text-black rounded hover:bg-[#c7c78a] transition-colors"
          >
            Highlight
          </button>
        </div>
      )}
    </div>
  );
}
