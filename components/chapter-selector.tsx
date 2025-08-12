"use client"
import type React from "react"
import { useState, useEffect } from "react"
import { ChevronDown, ChevronRight, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Section {
  id: string
  title: string
  page: number
  completed?: boolean
  progress?: number
}

interface Chapter {
  id: string
  title: string
  chapter_number: number
  sections: Section[]
  progress: number
}

interface TextbookPreview {
  textbook_id: string
  title: string
  author: string
  total_chapters: number
  total_pages?: number
  cover_image_url?: string
  chapters: {
    chapter_id: string
    chapter_number: number
    title: string
    page_start: number
    page_end?: number
    sections: {
      section_id: string
      section_number: string
      title: string
      page_start: number
      page_end?: number
    }[]
  }[]
}

interface UserProgress {
  user_id: string
  textbook_id: string
  progress: {
    completion_percentage: number
    chapters: {
      [key: string]: {
        completion_percentage: number
        sections: {
          [key: string]: {
            completion_percentage: number
            status: string
          }
        }
      }
    }
  }
}

interface TextbookWithProgress {
  textbook_id: string
  title: string
  author: string
  chapters: Chapter[]
  overall_progress: number
}

interface ChapterSelectorProps {
  textbookId: string
  onSectionSelect?: (chapterId: string, sectionId: string) => void
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

  const handleSectionClick = async (chapterId: string, sectionId: string) => {
    // Mark section as accessed/in progress
    await updateProgress(chapterId, sectionId, {
      status: "in_progress",
      time_spent_minutes: 1, // Minimal time to mark as accessed
    })

    if (onSectionSelect) {
      onSectionSelect(chapterId, sectionId)
    }
  }

  const markSectionComplete = async (chapterId: string, sectionId: string, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent triggering section click
    await updateProgress(chapterId, sectionId, {
      completion_percentage: 100,
      status: "completed",
    })
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-[#969696]" />
        <span className="ml-2 text-sm text-[#969696]">Loading chapters...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert>
          <AlertDescription className="text-sm">
            {error}
            <Button variant="outline" size="sm" onClick={fetchTextbookData} className="ml-2 bg-transparent">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!textbookData) {
    return <div className="p-4 text-center text-sm text-[#969696]">No textbook data available</div>
  }

  return (
    <div className="p-1.5 show-scrollbar">
      {/* Overall progress */}
      <div className="mb-3 p-2 bg-[#2d2d30] rounded">
        <div className="text-xs text-[#cccccc] mb-1">{textbookData.title}</div>
        <div className="text-[10px] text-[#969696] mb-1">by {textbookData.author}</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-[#3e3e42] rounded-full h-1">
            <div
              className="bg-[#007acc] h-1 rounded-full transition-all duration-300"
              style={{ width: `${textbookData.overall_progress}%` }}
            />
          </div>
          <span className="text-[10px] text-[#969696]">{Math.round(textbookData.overall_progress)}%</span>
        </div>
      </div>

      {textbookData.chapters.map((chapter) => (
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
                  {chapter.chapter_number}. {chapter.title}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-12 bg-[#3e3e42] rounded-full h-0.5">
                    <div
                      className="bg-[#007acc] h-0.5 rounded-full transition-all duration-300"
                      style={{ width: `${chapter.progress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[#969696] flex-shrink-0">{Math.round(chapter.progress)}%</span>
                </div>
              </div>
            </div>
          </Button>

          {expandedChapters.includes(chapter.id) && chapter.sections && (
            <div className="ml-4 mt-0.5">
              {chapter.sections.map((section) => (
                <div
                  key={section.id}
                  className="w-full justify-start p-1.5 h-auto hover:bg-[#3e3e42] text-left relative group cursor-pointer rounded"
                  onMouseEnter={() => setHoveredSection(section.id)}
                  onMouseLeave={() => setHoveredSection(null)}
                  onClick={() => handleSectionClick(chapter.id, section.id)}
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
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="text-[10px] text-[#969696]">Page {section.page}</div>
                        {section.progress !== undefined && section.progress > 0 && (
                          <div className="text-[10px] text-[#007acc]">{Math.round(section.progress)}%</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {section.completed ? (
                        <div className="w-1.5 h-1.5 bg-[#4ec9b0] rounded-full flex-shrink-0" />
                      ) : (
                        <div
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto cursor-pointer"
                          onClick={(e) => markSectionComplete(chapter.id, section.id, e)}
                        >
                          <div className="w-1.5 h-1.5 border border-[#969696] rounded-full" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
