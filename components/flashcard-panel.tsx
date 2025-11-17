"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Shuffle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/use-toast"

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
  const [previousDecks, setPreviousDecks] = useState<any[]>([])
  const [prevLoading, setPrevLoading] = useState<boolean>(false)
  const [prevError, setPrevError] = useState<string>("")

  function MenuButton({ id, kind, item, onOptimisticRemove, onFailureRestore }: { id: string; kind: "flashcards" | "quiz" | "study-guide"; item: any; onOptimisticRemove: (id: string, item: any) => void; onFailureRestore: (id: string, item: any) => void }) {
    const handleDelete = async (e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        // Optimistic remove
        onOptimisticRemove(id, item)
        const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL
        const token = localStorage.getItem("access_token")
        const resp = await fetch(`${backendUrl}/api/v1/${kind}/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        })
        if (!resp.ok) {
          onFailureRestore(id, item)
          toast({ title: "Delete failed", description: `Could not delete. Please try again. (${resp.status})` })
        }
      } catch (err) {
        onFailureRestore(id, item)
        toast({ title: "Delete failed", description: "Could not delete. Please try again." })
      }
    }
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="w-6 h-6 rounded hover:bg-[#4b4b4b] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
            aria-label="More options"
            title="More options"
          >
            <span className="block w-[2px] h-[14px] bg-[#9e9e9e] relative">
              <span className="absolute left-0 top-0 w-[2px] h-[2px] bg-[#9e9e9e]"></span>
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[2px] bg-[#9e9e9e]"></span>
              <span className="absolute left-0 bottom-0 w-[2px] h-[2px] bg-[#9e9e9e]"></span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-[#2d2d30] border-[#3e3e42] text-[#cccccc]">
          <DropdownMenuItem onClick={handleDelete} className="text-red-400 focus:bg-[#3e3e42]">
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Load subchapters for the currently selected chapter
  useEffect(() => {
    let isCancelled = false
    const load = async () => {
      try {
        if (!textbookId || !selectedChapterId) return
        // 1) Load metadata to extract subchapters
        const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL
        const metaResp = await fetch(`${backendUrl}/api/v1/textbooks/${encodeURIComponent(textbookId)}`, { cache: "no-store" })
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
            ? rawSubs.map((s: any) => (typeof s === "string" ? (s === "Introduction" ? '' : s) 
            : String(s?.title === "Introduction" ? "" : String(s?.title ?? "")))).filter((s: string) => s)
            : []
          console.log("Subs:", sub_chapters);
          if (!isCancelled) {
            setSubchapters(sub_chapters)
            // Enable generation UI by marking context as available for this chapter
            setContextText(`context-ready:${selectedChapterId}`)
            // Default select first subchapter if none selected
            // if (!selectedSubchapter && sub_chapters.length > 0) {
            //   setSelectedSubchapter(sub_chapters[0])
            // }
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

  // Load user's previously generated decks when entering menu
  useEffect(() => {
    let isCancelled = false
    if (stage !== "menu") return
    const load = async () => {
      try {
        setPrevLoading(true)
        setPrevError("")
        const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL
        const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null
        const resp = await fetch(`${backendUrl}/api/v1/flashcards/list`, { cache: "no-store", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
        if (!resp.ok) {
          if (resp.status === 401 || resp.status === 403) {
            if (!isCancelled) {
              setPreviousDecks([])
              setPrevError("Your session has expired. Please log in again.")
            }
            return
          }
          const msg = `Failed to fetch decks (${resp.status})`
          throw new Error(msg)
        }
        const data = await resp.json()
        if (!isCancelled) setPreviousDecks(Array.isArray(data) ? data : [])
      } catch {
        if (!isCancelled) {
          setPreviousDecks([])
          setPrevError("Could not load previous decks. Make sure you are logged in.")
        }
      } finally {
        if (!isCancelled) setPrevLoading(false)
      }
    }
    load()
    return () => {
      isCancelled = true
    }
  }, [stage])

  const reloadPrev = async () => {
    setStage((s) => s) // noop to keep stage
    try {
      setPrevLoading(true)
      setPrevError("")
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null
      const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL
      const resp = await fetch(`${backendUrl}/api/v1/flashcards/list`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } })
      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
          setPreviousDecks([])
          setPrevError("Your session has expired. Please log in again.")
          return
        }
        throw new Error()
      }
      const data = await resp.json()
      setPreviousDecks(Array.isArray(data) ? data : [])
    } catch {
      setPreviousDecks([])
      setPrevError("Could not load previous decks. Make sure you are logged in.")
    } finally {
      setPrevLoading(false)
    }
  }

  const loadDeck = (doc: any) => {
    try {
      const fronts: string[] = Array.isArray(doc?.flashcard?.flashcards_front) ? doc.flashcard.flashcards_front : []
      const backs: string[] = Array.isArray(doc?.flashcard?.flashcards_back) ? doc.flashcard.flashcards_back : []
      const length = Math.min(fronts.length, backs.length)
      if (length === 0) return
      const nextCards: Flashcard[] = Array.from({ length }, (_, i) => ({ front: String(fronts[i] ?? ""), back: String(backs[i] ?? "") }))
      setCards(nextCards)
      setCurrentIndex(0)
      setShowBack(!defaultFront)
      setStage("study")
    } catch {
      // ignore
    }
  }

  const formatWhen = (ts?: number) => {
    if (!ts) return ""
    try {
      return new Date(ts * 1000).toLocaleString()
    } catch {
      return String(ts)
    }
  }

  const startGeneration = async () => {
    setStage("loading")
    try {
      const context = ""
      const focusHint = selectedSubchapter ? `${selectedSubchapter}` : ""
      const token = localStorage.getItem("access_token")
      const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL

      const resp = await fetch(`${backendUrl}/api/v1/flashcards/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          context,
          hint: focusHint,
          num_questions: numCards,
          chapter: selectedChapterId,
          textbook_id: textbookId,
        }),
      })

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}))
        throw new Error(errorData.detail || "Failed to generate flashcards.")
      }

      const payload = await resp.json()
      const fronts = payload?.flashcards_front ?? []
      const backs = payload?.flashcards_back ?? []
      const length = Math.min(fronts.length, backs.length)

      if (length === 0) {
        throw new Error("No flashcards were generated.")
      }

      const newCards: Flashcard[] = Array.from({ length }, (_, i) => ({
        front: String(fronts[i] ?? ""),
        back: String(backs[i] ?? ""),
      }))

      setCards(newCards)
      setCurrentIndex(0)
      setShowBack(!defaultFront)
      setStage("study")
    } catch (err: any) {
      toast({
        title: "Generation Failed",
        description: err.message || "An unexpected error occurred.",
        variant: "destructive",
      })
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
            <Button className="bg-[#007acc] hover:bg-[#005a9e]" onClick={startGeneration} disabled={!selectedSubchapter}>
              Generate Flashcards
            </Button>
          </div>
          {!contextText && (
            <div className="text-xs text-[#969696]">Select a chapter to get started!</div>
          )}
          <div className="pt-2 border-t border-[#3e3e42]">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-[#ffffff]">Previous Decks</h4>
              {prevLoading && (
                <div className="text-[10px] text-[#969696] flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading
                </div>
              )}
            </div>
            {prevError && <div className="text-[10px] text-[#ff6b6b] mb-2">{prevError}</div>}
            {(!previousDecks || previousDecks.length === 0) && !prevLoading ? (
              <div className="text-xs text-[#969696]">No saved decks yet</div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-auto pr-1 show-scrollbar">
              {previousDecks.map((d, idx) => {
                  const count = Math.min(
                    Array.isArray(d?.flashcard?.flashcards_front) ? d.flashcard.flashcards_front.length : 0,
                    Array.isArray(d?.flashcard?.flashcards_back) ? d.flashcard.flashcards_back.length : 0
                  )
                  return (
                  <div key={d?._id || idx} className="group relative">
                    <div
                      role="button"
                      tabIndex={0}
                      className="w-full text-left px-3 py-2 rounded bg-[#2d2d30] hover:bg-[#3e3e42] border border-[#3e3e42]"
                      onClick={() => loadDeck(d)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); loadDeck(d) } }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs text-[#ffffff] truncate">{d?.hint || "Untitled deck"}</div>
                          <div className="text-[10px] text-[#969696] truncate">{formatWhen(d?.created_time)}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-[11px] text-[#cccccc] whitespace-nowrap">{count} cards</div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <MenuButton
                              id={d?._id}
                              kind="flashcards"
                              item={d}
                              onOptimisticRemove={(id) => setPreviousDecks((prev) => prev.filter((x) => x?._id !== id))}
                              onFailureRestore={(id, item) => setPreviousDecks((prev) => [item, ...prev])}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
          </div>
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
              className="bg-[#3e3e42] text-[#ffffff] hover:bg-[#4a4a50] w-full sm:w-auto"
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

