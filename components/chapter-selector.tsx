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
  pageOffset?: number // Added pageOffset to Section interface
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
  onSectionSelect?: (chapterId: string, sectionId: string, pageOffset?: number) => void
  onChapterSelect?: (chapterId: string) => void // Added onChapterSelect callback for PDF viewer integration
}

export function ChapterSelector({ textbookId, onSectionSelect, onChapterSelect }: ChapterSelectorProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [textbookData, setTextbookData] = useState<TextbookWithProgress | null>(null)
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null)

  // Change the initial expanded state to start collapsed
  const [expandedChapters, setExpandedChapters] = useState<string[]>([])
  const [hoveredChapter, setHoveredChapter] = useState<string | null>(null)
  const [hoveredSection, setHoveredSection] = useState<string | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])

  const updateProgress = async (
    chapterId: string,
    sectionId: string,
    progressData: {
      completion_percentage?: number
      status?: string
      time_spent_minutes?: number
    },
  ) => {
    try {
      // Update local state to reflect progress change
      setChapters((prev) =>
        prev.map((chapter) => {
          if (chapter.id === chapterId && chapter.sections) {
            const updatedSections = chapter.sections.map((section) => {
              if (section.id === sectionId) {
                return {
                  ...section,
                  completed: progressData.status === "completed",
                  progress: progressData.completion_percentage || section.progress,
                }
              }
              return section
            })
            return { ...chapter, sections: updatedSections }
          }
          return chapter
        }),
      )
    } catch (err) {
      console.error("Failed to update progress:", err)
    }
  }

  const fetchTextbookData = async () => {
    if (!textbookId) return

    setLoading(true)
    setError(null)

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
      const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL
      const [textbookResp, chaptersResp] = await Promise.all([
        fetch(`${backendUrl}/api/v1/textbooks/${encodeURIComponent(textbookId)}`, { headers }),
        fetch(`${backendUrl}/api/v1/textbooks/${encodeURIComponent(textbookId)}/chapters`, { headers }),
      ])

      if (!textbookResp.ok) {
        throw new Error(`Failed to load textbook metadata: ${textbookResp.statusText} (${textbookResp.status})`)
      }
      if (!chaptersResp.ok) {
        throw new Error(`Failed to load chapters: ${chaptersResp.statusText} (${chaptersResp.status})`)
      }

      const textbookMetadata = await textbookResp.json()
      const chaptersData = await chaptersResp.json()

      const rawChapters = chaptersData?.chapters ?? textbookMetadata?.chapters ?? []
      const chaptersArray = Array.isArray(rawChapters) ? rawChapters : []

      const textbookInfo: TextbookWithProgress = {
        textbook_id: textbookId,
        title: textbookMetadata?.title || "Unknown Title",
        author: textbookMetadata?.author || "Unknown Author",
        chapters: [],
        overall_progress: 0,
      }

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
        const id = String(c.id ?? "")
        const stored = Number(byTextbook[id] ?? 0)

        const sections: Section[] = (c.sub_chapters || []).map((subChapter: any, index: number) => {
          let title: string
          let pageOffset = 0
          if (typeof subChapter === "string") {
            title = subChapter
            pageOffset = 0
          } else if (typeof subChapter === "object" && subChapter !== null) {
            title = String(subChapter.title || `Section ${index + 1}`)
            pageOffset = Number(subChapter.pageOffset || 0)
          } else {
            title = `Section ${index + 1}`
            pageOffset = 0
          }
          return {
            id: `${id}-${index + 1}`,
            title,
            page: 1, // Default page since not provided in your JSON
            pageOffset, // Use actual pageOffset from metadata
            completed: false,
            progress: 0,
          }
        })

        return {
          id,
          title: c.title || `Chapter ${c.id || ""}`,
          chapter_number: c.id || 1,
          sections,
          progress: Math.max(0, Math.min(100, Math.round(stored))),
        } as Chapter
      })

      const totalProgress = chapterList.reduce((sum, chapter) => sum + chapter.progress, 0)
      const overallProgress = chapterList.length > 0 ? totalProgress / chapterList.length : 0

      textbookInfo.chapters = chapterList
      textbookInfo.overall_progress = overallProgress

      setChapters(chapterList)
      setTextbookData(textbookInfo)

      // Background: merge server progress if available (do not block UI)
      ;(async () => {
        const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL
        try {
          const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null
          if (!token) return
          const resp = await fetch(`${backendUrl}/api/v1/progress/${encodeURIComponent(textbookId)}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          })
          if (!resp.ok) return
          const server = await resp.json()
          const chaptersProgress: Record<string, number> = (server?.chapters as any) || {}
          if (!chaptersProgress || typeof chaptersProgress !== "object") return

          setChapters((prev) =>
            prev.map((c) => ({
              ...c,
              progress: Math.max(
                0,
                Math.min(100, Math.round(Math.max(Number(chaptersProgress[c.id] ?? 0), Number(c.progress ?? 0))))),
            })),
          )

          setTextbookData((prev) => {
            if (!prev) return prev
            const updated = prev.chapters.map((c) => ({
              ...c,
              progress: Math.max(
                0,
                Math.min(100, Math.round(Math.max(Number(chaptersProgress[c.id] ?? 0), Number(c.progress ?? 0))))),
            }))
            const total = updated.reduce((sum, c) => sum + c.progress, 0)
            const overall = updated.length > 0 ? total / updated.length : 0
            return { ...prev, chapters: updated, overall_progress: overall }
          })
        } catch {
          // ignore server errors
        }
      })()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load textbook data"
      setError(errorMessage)
      setChapters([])
      setTextbookData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (textbookId) {
      fetchTextbookData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textbookId])

  useEffect(() => {
    const handler = (evt: Event) => {
      const custom = evt as CustomEvent<{ textbookId: string; chapterId: string; percent: number }>
      if (!custom?.detail) return
      const { textbookId: tid, chapterId, percent } = custom.detail
      if (tid !== textbookId) return
      setChapters((prev) =>
        prev.map((c) => (c.id === chapterId ? { ...c, progress: Math.max(0, Math.min(100, Math.round(percent))) } : c)),
      )

      setTextbookData((prev) => {
        if (!prev) return prev
        const updatedChapters = prev.chapters.map((c) =>
          c.id === chapterId ? { ...c, progress: Math.max(0, Math.min(100, Math.round(percent))) } : c,
        )
        const totalProgress = updatedChapters.reduce((sum, chapter) => sum + chapter.progress, 0)
        const overallProgress = updatedChapters.length > 0 ? totalProgress / updatedChapters.length : 0

        return {
          ...prev,
          chapters: updatedChapters,
          overall_progress: overallProgress,
        }
      })
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

  const handleChapterClick = (chapterId: string) => {
    // Toggle the dropdown
    toggleChapter(chapterId)
    setSelectedChapter(chapterId)

    // Load the PDF for this chapter
    if (onChapterSelect) {
      onChapterSelect(chapterId)
    }
  }

  const handleSectionClick = async (chapterId: string, sectionId: string, pageOffset?: number) => {
    const sectionNumber = sectionId.split("-").pop() || sectionId

    await updateProgress(chapterId, sectionNumber, {
      status: "in_progress",
      time_spent_minutes: 1,
    })

    if (onSectionSelect) {
      onSectionSelect(chapterId, sectionId, pageOffset)
    }
  }

  const markSectionComplete = async (chapterId: string, sectionId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    const sectionNumber = sectionId.split("-").pop() || sectionId

    await updateProgress(chapterId, sectionNumber, {
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
        <div key={chapter.id} 
            className={`mb-1 ${chapter.id === selectedChapter ? "border-2 border border-[#3a3a3d] rounded-lg" : ""}`}>
          <Button
            variant="ghost"
            className="w-full justify-start p-1.5 h-auto hover:bg-[#3e3e42] text-left relative"
            onClick={() => handleChapterClick(chapter.id)}
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
              {chapter.sections.map((section, index) => {
                const pageOffset = section.pageOffset || 0

                return (
                  <div
                    key={section.id}
                    className="w-full justify-start p-1.5 h-auto hover:bg-[#3e3e42] text-left relative group cursor-pointer rounded"
                    onMouseEnter={() => setHoveredSection(section.id)}
                    onMouseLeave={() => setHoveredSection(null)}
                    onClick={() => handleSectionClick(chapter.id, section.id, pageOffset)}
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
                          <div className="text-[10px] text-[#969696]">Page {pageOffset}</div>
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
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}