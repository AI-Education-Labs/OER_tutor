"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Shuffle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Flashcard {
  front: string
  back: string
}

interface FlashcardPanelProps {
  textbookId?: string
  selectedChapterId?: string
}

export function FlashcardPanel({ textbookId, selectedChapterId }: FlashcardPanelProps) {
  const [stage, setStage] = useState<"menu" | "loading" | "study">("menu")
  const [subchapters, setSubchapters] = useState<string[]>([])
  const [selectedSubchapter, setSelectedSubchapter] = useState<string>("")
  const [contextText, setContextText] = useState<string>("")
  const [cards, setCards] = useState<Flashcard[]>([])
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [showBack, setShowBack] = useState<boolean>(false)
  const [defaultFront, setDefaultFront] = useState<boolean>(true) // true = Original(front), false = Flipped(back)
  const [numCards, setNumCards] = useState<number>(5)

  // Load subchapters for the currently selected chapter
  useEffect(() => {
    let isCancelled = false
    const load = async () => {
      try {
        if (!textbookId || !selectedChapterId) return
        // 1) Load metadata to extract subchapters
        const metaResp = await fetch(`/api/textbooks/${encodeURIComponent(textbookId)}`, { cache: "no-store" })
        if (metaResp.ok) {
          const meta = await metaResp.json()
          console.log("Meta:", meta);
          let current_chapter: any = null;
          const chapters = Array.isArray(meta?.chapters) ? meta.chapters : []
          for (const chapter of chapters) {
            if (String(chapter?.id) === String(selectedChapterId)) {
              current_chapter = chapter;
              break;
            }
          }
          const rawSubs = current_chapter?.sub_chapters ?? []
          const sub_chapters: string[] = Array.isArray(rawSubs)
            ? rawSubs.map((s: any) => (typeof s === "string" ? s : String(s?.title ?? ""))).filter((s: string) => s)
            : []
          console.log("Subs:", sub_chapters);
          if (!isCancelled) {
            setSubchapters(sub_chapters)
            // Enable generation UI by marking context as available for this chapter
            setContextText(`context-ready:${selectedChapterId}`)
            // Default select first subchapter if none selected
            if (!selectedSubchapter && sub_chapters.length > 0) {
              setSelectedSubchapter(sub_chapters[0])
            }
          }
        }
      } catch {
        // ignore
      }
    }
    load()
    return () => {
      isCancelled = true
    }
  }, [textbookId, selectedChapterId])

  const startGeneration = async () => {
    setStage("loading")
    try {
      const context = ""
      const focusHint = selectedSubchapter ? `${selectedSubchapter}` : ""

      const resp = await fetch("/api/flashcard/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, hint: focusHint, num_flashcards: numCards, chapter: selectedChapterId, textbook_id: textbookId }),
      })

      if (!resp.ok) {
        throw new Error(`Failed to generate flashcards (${resp.status})`)
      }

      const payload = await resp.json()
      // Accept multiple shapes and normalize to fronts/backs arrays
      const fronts: string[] = Array.isArray(payload?.front)
        ? payload.front
        : Array.isArray(payload?.flashcards_front)
          ? payload.flashcards_front
          : Array.isArray(payload?.data?.front)
            ? payload.data.front
            : Array.isArray(payload?.data?.flashcards_front)
              ? payload.data.flashcards_front
              : []
      const backs: string[] = Array.isArray(payload?.back)
        ? payload.back
        : Array.isArray(payload?.flashcards_back)
          ? payload.flashcards_back
          : Array.isArray(payload?.data?.back)
            ? payload.data.back
            : Array.isArray(payload?.data?.flashcards_back)
              ? payload.data.flashcards_back
              : []

      const length = Math.min(fronts.length, backs.length)
      if (length === 0) throw new Error("Flashcard generation returned no cards")

      const nextCards: Flashcard[] = Array.from({ length }, (_, i) => ({ front: String(fronts[i] ?? ""), back: String(backs[i] ?? "") }))
      setCards(nextCards)
      setCurrentIndex(0)
      setShowBack(!defaultFront)
      setStage("study")
    } catch {
      setStage("menu")
    }
  }

  const canPrev = currentIndex > 0
  const canNext = currentIndex < cards.length - 1

  const goPrev = () => {
    if (!canPrev) return
    setCurrentIndex((i) => Math.max(0, i - 1))
    setShowBack(!defaultFront)
  }

  const goNext = () => {
    if (!canNext) return
    setCurrentIndex((i) => Math.min(cards.length - 1, i + 1))
    setShowBack(!defaultFront)
  }

  const shuffleDeck = () => {
    setCards((prev) => {
      const copy = [...prev]
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
      }
      return copy
    })
    setCurrentIndex(0)
    setShowBack(!defaultFront)
  }

  const toggleDefaultSide = () => {
    setDefaultFront((prev) => {
      const next = !prev
      // When switching default, also update current shown side to match the new default
      setShowBack(!next)
      return next
    })
  }

  const currentCard = useMemo(() => cards[currentIndex], [cards, currentIndex])

  if (stage === "menu") {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-[#3e3e42]">
          <h3 className="text-sm font-medium text-[#ffffff]">Flashcards</h3>
          <p className="text-xs text-[#969696]">Choose a subchapter to generate a deck.</p>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-4 show-scrollbar">
          <div>
            <label className="block text-xs text-[#cccccc] mb-2">Subchapter</label>
            <Select onValueChange={(v: string) => setSelectedSubchapter(v)}>
              <SelectTrigger className="w-full bg-[#2d2d30] border-[#3e3e42] text-[#cccccc]">
                <SelectValue placeholder="Select a subchapter" />
              </SelectTrigger>
              <SelectContent className="bg-[#2d2d30] border-[#3e3e42] text-[#cccccc] max-h-60 overflow-auto">
                {subchapters.length === 0 ? (
                  <div className="px-2 py-1 text-xs text-[#969696]">No subchapters detected</div>
                ) : (
                  subchapters.map((s, i) => (
                    <SelectItem key={`${s}-${i}`} value={s} className="focus:bg-[#3e3e42]">
                      {s}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-xs text-[#cccccc] mb-2">Number of Flashcards</label>
            <Select onValueChange={(v: string) => setNumCards(parseInt(v))} value={String(numCards)}>
              <SelectTrigger className="w-full bg-[#2d2d30] border-[#3e3e42] text-[#cccccc]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#2d2d30] border-[#3e3e42] text-[#cccccc] max-h-60 overflow-auto">
                {Array.from({ length: 18 }, (_, i) => i + 3).map((n) => (
                  <SelectItem key={n} value={String(n)} className="focus:bg-[#3e3e42]">
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 justify-center">
            <Button className="bg-[#007acc] hover:bg-[#005a9e]" onClick={startGeneration} disabled={!contextText}>
              Generate Flashcards
            </Button>
          </div>
          {!contextText && (
            <div className="text-xs text-[#969696]">Select a chapter to get started!</div>
          )}
        </div>
      </div>
    )
  }

  if (stage === "loading") {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-[#cccccc]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Generating your flashcards…</span>
        </div>
      </div>
    )
  }

  // study
  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-[#3e3e42] flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="px-2 py-1 bg-[#2d2d30] text-[#cccccc] hover:bg-[#3e3e42] rounded"
          onClick={() => setStage("menu")}
        >
          Back
        </Button>
        {selectedSubchapter && <span className="ml-2 text-xs text-[#969696] truncate">{selectedSubchapter}</span>}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="px-2 py-1 bg-[#2d2d30] text-[#cccccc] hover:bg-[#3e3e42] rounded"
            onClick={toggleDefaultSide}
          >
            {defaultFront ? "Original" : "Flipped"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="px-2 py-1 bg-[#2d2d30] text-[#cccccc] hover:bg-[#3e3e42] rounded"
            onClick={shuffleDeck}
          >
            <Shuffle className="w-3 h-3 mr-1" />
            Shuffle
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="px-2 py-1 bg-[#2d2d30] text-[#cccccc] hover:bg-[#3e3e42] rounded"
            onClick={() => {}}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Review
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4 show-scrollbar">
        <div className="max-w-xl mx-auto w-full">
          <Card className="bg-[#2d2d30] border-[#3e3e42]">
            <CardContent className="p-6">
              <div
                className="relative w-full h-64 sm:h-72 md:h-80 cursor-pointer select-none [perspective:1000px]"
                onClick={() => setShowBack((v) => !v)}
              >
                <div
                  className={`absolute inset-0 transition-transform duration-500 [transform-style:preserve-3d] ${showBack ? "[transform:rotateY(180deg)]" : ""}`}
                >
                  {/* Front */}
                  <div className="absolute inset-0 flex items-center justify-center p-4 [backface-visibility:hidden]">
                    <div className="text-center text-[#ffffff] text-sm whitespace-pre-wrap break-words">
                      {currentCard?.front}
                    </div>
                  </div>
                  {/* Back */}
                  <div className="absolute inset-0 flex items-center justify-center p-4 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                    <div className="text-center text-[#ffffff] text-sm whitespace-pre-wrap break-words">
                      {currentCard?.back}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-[#3e3e42] text-[#cccccc] hover:text-[#ffffff] w-full sm:w-auto"
              onClick={goPrev}
              disabled={!canPrev}
            >
              Previous
            </Button>
            <div className="text-sm text-[#cccccc] py-1">
              Card {cards.length > 0 ? currentIndex + 1 : 0} of {cards.length}
            </div>
            <Button
              size="sm"
              className="bg-[#007acc] hover:bg-[#005a9e] w-full sm:w-auto"
              onClick={goNext}
              disabled={!canNext}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}


