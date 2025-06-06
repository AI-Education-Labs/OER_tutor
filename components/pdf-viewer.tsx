import { useEffect, useState } from "react";

export function PDFViewer() {
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [showActions, setShowActions] = useState(false);
  const [actionPosition, setActionPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const loadHTML = async () => {
      try {
        const response = await fetch("/physics/chapter1.html");
        if (!response.ok) {
          throw new Error(`Failed to load HTML: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();
        setHtmlContent(html);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    loadHTML();
  }, []);

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
          <div className="text-sm text-gray-400">Make sure text.html is in your public folder</div>
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
    <div className="h-full overflow-auto bg-white p-4 relative">
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
