"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/use-toast"

interface KeyConceptsPanelProps {
  textbookId?: string
  selectedChapterId?: string
}

export function KeyConceptsPanel({ textbookId, selectedChapterId }: KeyConceptsPanelProps) {
  const [stage, setStage] = useState<"menu" | "loading" | "view">("menu")
  const [subchapters, setSubchapters] = useState<string[]>([])
  const [selectedSubchapter, setSelectedSubchapter] = useState<string>("")
  const [contextText, setContextText] = useState<string>("")
  const [resultHtml, setResultHtml] = useState<string>("")
  const [previousNotes, setPreviousNotes] = useState<any[]>([])
  const [prevLoading, setPrevLoading] = useState<boolean>(false)
  const [prevError, setPrevError] = useState<string>("")
  const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL

  function MenuButton({ id, kind, item, onOptimisticRemove, onFailureRestore }: { id: string; kind: "flashcards" | "quiz" | "study-guide"; item: any; onOptimisticRemove: (id: string, item: any) => void; onFailureRestore: (id: string, item: any) => void }) {
    const handleDelete = async (e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        onOptimisticRemove(id, item)
        const token = localStorage.getItem("token")
        const resp = await fetch(`${backendUrl}/api/v1/${kind}/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!resp.ok) {
          onFailureRestore(id, item)
          toast({ title: "Delete failed", description: `Could not delete. Please try again. (${resp.status})` })
        }
      } catch {
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

  // Load subchapters and simple context from chapter1 HTML (same approach as quiz/flashcards)
  useEffect(() => {
    let isCancelled = false
    const load = async () => {
      try {
        if (!textbookId) return
        // 1) Load metadata to extract subchapters
        const metaResp = await fetch(`${backendUrl}/api/v1/textbooks/${encodeURIComponent(textbookId)}`, { cache: "no-store" })
        if (metaResp.ok) {
          const meta = await metaResp.json()
          const subs: string[] = Array.isArray(meta?.chapters)
            ? meta.chapters.flatMap((c: any) => (Array.isArray(c?.sub_chapters) ? c.sub_chapters : []))
            : []
          const uniqueSubs = Array.from(new Set(subs.filter((s) => typeof s === "string" && s.trim().length > 0)))
          if (!isCancelled) setSubchapters(uniqueSubs)
        }

        // 2) Load chapter1 HTML as base context
        const htmlUrl = `/textbooks/${encodeURIComponent(textbookId)}/chapter1.html`
        const resp = await fetch(htmlUrl, { cache: "no-store" })
        if (resp.ok) {
          const html = await resp.text()
          if (isCancelled) return
          const div = document.createElement("div")
          div.innerHTML = html
          const textContent = div.textContent || ""
          setContextText(textContent)
        }
      } catch {
        // ignore
      }
    }
    load()
    return () => {
      isCancelled = true
    }
  }, [textbookId])

  // Load user's previous notes when in menu
  useEffect(() => {
    let isCancelled = false
    if (stage !== "menu") return
        const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null
        const resp = await fetch(`${backendUrl}/api/study-guide`, {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }) // TODO: no backend route for this anywhere
        if (!resp.ok) {
          if (resp.status === 401 || resp.status === 403) {
            if (!isCancelled) {
              setPreviousNotes([])
              setPrevError("Your session has expired. Please log in again.")
            }
            return
          }
          throw new Error()
        }
        const data = await resp.json()
        if (!isCancelled) setPreviousNotes(Array.isArray(data) ? data : [])
          throw new Error()
        }
        const data = await resp.json()
        if (!isCancelled) setPreviousNotes(Array.isArray(data) ? data : [])
      } catch {
        if (!isCancelled) {
          setPreviousNotes([])
          setPrevError("Could not load previous notes. Make sure you are logged in.")
        }
      } finally {
        if (!isCancelled) setPrevLoading(false)
      }
    }
    load()
    return () => { isCancelled = true }
  }, [stage])

  const loadNote = (doc: any) => {
    try {
      const html = typeof doc?.study_guide === "string" ? doc.study_guide : ""
      if (!html) return
      setResultHtml(html)
      setStage("view")
    } catch {}
  }

  const startGeneration = async () => {
    setStage("loading")
    try {
      // Placeholder context for now; will be replaced when backend context streaming is ready
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
      const resp = await fetch(`${backendUrl}/api/key-concept/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ context, hint: focusHint, textbook_id: textbookId, chapter: selectedChapterId }),
      })
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, hint: focusHint, textbook_id: textbookId, chapter: selectedChapterId }),
      })

      if (!resp.ok) {
        throw new Error(`Failed to generate key concepts (${resp.status})`)
      }

      const payload = await resp.json()
      // Prefer payload.data as a formatted HTML/markdown string
      const htmlCandidate: unknown = payload?.data ?? payload?.raw ?? ""
      const htmlString = typeof htmlCandidate === "string" ? htmlCandidate : ""
      if (!htmlString) throw new Error("No content returned from key concept generation")

      setResultHtml(htmlString)
      setStage("view")
    } catch {
      setStage("menu")
    }
  }

  const hasSubchapters = subchapters.length > 0
  const canGenerate = Boolean(contextText)

  if (stage === "menu") {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-[#3e3e42]">
          <h3 className="text-sm font-medium text-[#ffffff]">Key Concepts</h3>
          <p className="text-xs text-[#969696]">Choose a subchapter to generate structured key concepts.</p>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-4 show-scrollbar">
          <div>
            <label className="block text-xs text-[#cccccc] mb-2">Subchapter</label>
            <Select onValueChange={(v: string) => setSelectedSubchapter(v)}>
              <SelectTrigger className="w-full bg-[#2d2d30] border-[#3e3e42] text-[#cccccc]">
                <SelectValue placeholder={hasSubchapters ? "Select a subchapter" : "No subchapters detected"} />
              </SelectTrigger>
              <SelectContent className="bg-[#2d2d30] border-[#3e3e42] text-[#cccccc] max-h-60 overflow-auto">
                {hasSubchapters ? (
                  subchapters.map((s, i) => (
                    <SelectItem key={`${s}-${i}`} value={s} className="focus:bg-[#3e3e42]">
                      {s}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-1 text-xs text-[#969696]">No subchapters detected</div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 justify-center">
            <Button className="bg-[#007acc] hover:bg-[#005a9e]" onClick={startGeneration} disabled={!canGenerate}>
              Generate Key Concepts
            </Button>
          </div>
          {!canGenerate && (
            <div className="text-xs text-[#969696]">Preparing chapter content. Please wait a moment…</div>
          )}
        <div className="pt-2 border-t border-[#3e3e42]">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-[#ffffff]">Previous Study Guides</h4>
            {prevLoading && (
              <div className="text-[10px] text-[#969696] flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading
              </div>
            )}
          </div>
          {prevError && <div className="text-[10px] text-[#ff6b6b] mb-2">{prevError}</div>}
          {(!previousNotes || previousNotes.length === 0) && !prevLoading ? (
            <div className="text-xs text-[#969696]">No saved study guides yet</div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-auto pr-1 show-scrollbar">
              {previousNotes.map((d, idx) => (
                <div key={d?._id || idx} className="group relative">
                  <div
                    role="button"
                    tabIndex={0}
                    className="w-full text-left px-3 py-2 rounded bg-[#2d2d30] hover:bg-[#3e3e42] border border-[#3e3e42]"
                    onClick={() => loadNote(d)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); loadNote(d) } }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-[#ffffff] truncate">{d?.hint || "Untitled study guide"}</div>
                        <div className="text-[10px] text-[#969696] truncate">{new Date((d?.created_time ?? 0) * 1000).toLocaleString()}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-[11px] text-[#cccccc] whitespace-nowrap">View</div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MenuButton
                            id={d?._id}
                            kind="study-guide"
                            item={d}
                            onOptimisticRemove={(id) => setPreviousNotes((prev) => prev.filter((x) => x?._id !== id))}
                            onFailureRestore={(id, item) => setPreviousNotes((prev) => [item, ...prev])}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
          <span>Generating key concepts…</span>
        </div>
      </div>
    )
  }

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
      </div>

      <div className="flex-1 overflow-auto p-4 show-scrollbar">
        <div className="max-w-2xl mx-auto w-full">
          <Card className="bg-[#2d2d30] border-[#3e3e42]">
            <CardContent className="p-6">
              <div className="text-[#ffffff] text-sm prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: resultHtml }} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}


