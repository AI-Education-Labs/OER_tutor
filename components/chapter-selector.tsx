"use client"

import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Chapter {
  id: string
  title: string
  sections?: Section[]
  progress?: number
}

interface Section {
  id: string
  title: string
  page: number
  completed?: boolean
}

interface ChapterSelectorProps {
  textbookId: string
}

export function ChapterSelector({ textbookId }: ChapterSelectorProps) {
  // Change the initial expanded state to start collapsed
  const [expandedChapters, setExpandedChapters] = useState<string[]>([])
  const [hoveredChapter, setHoveredChapter] = useState<string | null>(null)
  const [hoveredSection, setHoveredSection] = useState<string | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])

  // On mount/load: fetch chapters for textbook, reset progress to 0 for testing, then fetch progress
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}

    const loadChaptersAndProgress = async () => {
      try {
        // 1) Fetch chapters list from Next.js API
        const chaptersResp = await fetch(`/api/chapters/${encodeURIComponent(textbookId)}`)
        const chaptersData = await chaptersResp.json()

        console.log("chaptersData:", chaptersData)
        const rawChapters = chaptersData?.chapters ?? []
        const chaptersArray = Array.isArray(rawChapters)
          ? rawChapters
          : typeof rawChapters === "object" && rawChapters !== null
            ? Object.values(rawChapters)
            : []

        // Build initial progress from localStorage
        const key = "readingProgress"
        let byTextbook: Record<string, number> = {}
        try {
          const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null
          const parsed: Record<string, Record<string, number>> = raw ? JSON.parse(raw) : {}
          byTextbook = parsed[textbookId] || {}
        } catch {
          byTextbook = {}
        }

        const chapterList = chaptersArray.map((c: any) => {
          const id = String(c.id ?? c.chapter_id ?? "")
          const stored = Number(byTextbook[id] ?? 0)
          return {
            id,
            title: c.title || `Chapter ${c.id ?? c.chapter_id ?? ""}`,
            progress: Math.max(0, Math.min(100, Math.round(stored))),
          } as Chapter
        })

        setChapters(chapterList)
      } catch (e) {
        // If API fails (e.g., not logged in), fallback: keep current chapters list empty
        setChapters([])
      }
    }

    if (textbookId) {
      loadChaptersAndProgress()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textbookId])

  // Listen for progress updates emitted from the viewer
  useEffect(() => {
    const handler = (evt: Event) => {
      const custom = evt as CustomEvent<{ textbookId: string; chapterId: string; percent: number }>
      if (!custom?.detail) return
      const { textbookId: tid, chapterId, percent } = custom.detail
      if (tid !== textbookId) return
      setChapters((prev) =>
        prev.map((c) => (c.id === chapterId ? { ...c, progress: Math.max(0, Math.min(100, Math.round(percent))) } : c)),
      )
    }

    if (typeof window !== "undefined") {
      window.addEventListener("reading-progress", handler as EventListener)
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("reading-progress", handler as EventListener)
      }
    }
  }, [textbookId])

  // Fallback: periodically sync from localStorage in case custom events are missed
  useEffect(() => {
    if (typeof window === "undefined") return
    const key = "readingProgress"
    const interval = setInterval(() => {
      try {
        const raw = window.localStorage.getItem(key)
        if (!raw) return
        const parsed: Record<string, Record<string, number>> = JSON.parse(raw)
        const byTextbook = parsed[textbookId] || {}
        setChapters((prev) =>
          prev.map((c) => ({
            ...c,
            progress: Math.max(0, Math.min(100, Math.round(Number(byTextbook[c.id] ?? c.progress ?? 0)))),
          })),
        )
      } catch {
        // ignore parse errors
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [textbookId])

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) =>
      prev.includes(chapterId) ? prev.filter((id) => id !== chapterId) : [...prev, chapterId],
    )
  }

  return (
    <div className="p-1.5 show-scrollbar">
      {chapters.map((chapter) => (
        <div key={chapter.id} className="mb-1">
          <Button
            variant="ghost"
            className="w-full justify-start p-1.5 h-auto hover:bg-[#3e3e42] text-left relative"
            onClick={() => toggleChapter(chapter.id)}
            onMouseEnter={() => setHoveredChapter(chapter.id)}
            onMouseLeave={() => setHoveredChapter(null)}
          >
            <div className="flex items-center gap-1.5 w-full">
              {expandedChapters.includes(chapter.id) ? (
                <ChevronDown className="w-3 h-3 text-[#969696] flex-shrink-0" />
              ) : (
                <ChevronRight className="w-3 h-3 text-[#969696] flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div
                  className={`text-xs text-[#cccccc] leading-tight transition-all duration-200 ${
                    hoveredChapter === chapter.id ? "whitespace-normal" : "truncate"
                  }`}
                >
                  {chapter.title}
                </div>
                {chapter.progress !== undefined && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-12 bg-[#3e3e42] rounded-full h-0.5">
                      <div className="bg-[#007acc] h-0.5 rounded-full" style={{ width: `${chapter.progress}%` }} />
                    </div>
                    <span className="text-[10px] text-[#969696] flex-shrink-0">{chapter.progress}%</span>
                  </div>
                )}
              </div>
            </div>
          </Button>

          {expandedChapters.includes(chapter.id) && chapter.sections && (
            <div className="ml-4 mt-0.5">
              {chapter.sections.map((section) => (
                <Button
                  key={section.id}
                  variant="ghost"
                  className="w-full justify-start p-1.5 h-auto hover:bg-[#3e3e42] text-left relative"
                  onMouseEnter={() => setHoveredSection(section.id)}
                  onMouseLeave={() => setHoveredSection(null)}
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <FileText className="w-2.5 h-2.5 text-[#969696] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-[11px] text-[#cccccc] leading-tight transition-all duration-200 ${
                          hoveredSection === section.id ? "whitespace-normal" : "truncate"
                        }`}
                      >
                        {section.title}
                      </div>
                      <div className="text-[10px] text-[#969696]">Page {section.page}</div>
                    </div>
                    {section.completed && <div className="w-1.5 h-1.5 bg-[#4ec9b0] rounded-full flex-shrink-0" />}
                  </div>
                </Button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
