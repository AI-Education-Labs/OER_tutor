"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface KeyConceptsPanelProps {
  textbookId?: string
}

export function KeyConceptsPanel({ textbookId }: KeyConceptsPanelProps) {
  const [stage, setStage] = useState<"menu" | "loading" | "view">("menu")
  const [subchapters, setSubchapters] = useState<string[]>([])
  const [selectedSubchapter, setSelectedSubchapter] = useState<string>("")
  const [contextText, setContextText] = useState<string>("")
  const [resultHtml, setResultHtml] = useState<string>("")

  // Load subchapters and simple context from chapter1 HTML (same approach as quiz/flashcards)
  useEffect(() => {
    let isCancelled = false
    const load = async () => {
      try {
        if (!textbookId) return
        // 1) Load metadata to extract subchapters
        const metaResp = await fetch(`/api/textbooks/${encodeURIComponent(textbookId)}`, { cache: "no-store" })
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

  const startGeneration = async () => {
    setStage("loading")
    try {
      // Placeholder context for now; will be replaced when backend context streaming is ready
      const context =
        "Identify the core key concepts for the introduction to physics. Provide concise, well-structured notes that include headings and bullet points, with emphasis on bold/italic text where helpful."
      const focusHint = selectedSubchapter ? `Focus only on section: ${selectedSubchapter}` : ""

      const resp = await fetch("/api/key-concept/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, hint: focusHint }),
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


