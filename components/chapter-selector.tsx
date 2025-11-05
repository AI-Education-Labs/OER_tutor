"use client"
import type React from "react"
import { useState } from "react"
import { ChevronDown, ChevronRight, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { components } from "@/types/api"

interface ChapterSelectorProps {
  textbook: components["schemas"]["Textbook"] | null | undefined
  onSectionSelect?: (chapterId: string, sectionId: string, pageOffset?: number) => void
  onChapterSelect?: (chapterId: string) => void
}

export function ChapterSelector({ textbook, onSectionSelect, onChapterSelect }: ChapterSelectorProps) {
  const [expandedChapters, setExpandedChapters] = useState<string[]>([])
  const [hoveredChapter, setHoveredChapter] = useState<string | null>(null)
  const [hoveredSection, setHoveredSection] = useState<string | null>(null)

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
      // Fire-and-forget progress update to backend
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null
      if (!token) return

      await fetch(`/api/user/progress/${encodeURIComponent(chapterId)}/${sectionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(progressData),
      }).catch(() => {})
    } catch (err) {
      console.error("Failed to update progress:", err)
    }
  }

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) =>
      prev.includes(chapterId) ? prev.filter((id) => id !== chapterId) : [...prev, chapterId],
    )
  }

  const handleChapterClick = (chapterId: string) => {
    toggleChapter(chapterId)
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

  if (!textbook) {
    return <div className="p-4 text-center text-sm text-[#969696]">No textbook data available</div>
  }

  const chapters = Array.isArray(textbook.chapters) ? textbook.chapters : []

  return (
    <div className="p-1.5 show-scrollbar">
      <div className="mb-3 p-2 bg-[#2d2d30] rounded">
        <div className="text-xs text-[#cccccc] mb-1">{textbook.title}</div>
        <div className="text-[10px] text-[#969696] mb-1">by {textbook.author}</div>
      </div>

      {chapters.map((chapter) => (
        <div key={chapter.id} className="mb-1">
          <Button
            variant="ghost"
            className="w-full justify-start p-1.5 h-auto hover:bg-[#3e3e42] text-left relative"
            onClick={() => handleChapterClick(String(chapter.id))}
            onMouseEnter={() => setHoveredChapter(String(chapter.id))}
            onMouseLeave={() => setHoveredChapter(null)}
          >
            <div className="flex items-center gap-1.5 w-full">
              {expandedChapters.includes(String(chapter.id)) ? (
                <ChevronDown className="w-3 h-3 text-[#969696] flex-shrink-0" />
              ) : (
                <ChevronRight className="w-3 h-3 text-[#969696] flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div
                  className={`text-xs text-[#cccccc] leading-tight transition-all duration-200 ${
                    hoveredChapter === String(chapter.id) ? "whitespace-normal" : "truncate"
                  }`}
                >
                  {chapter.title}
                </div>
              </div>
            </div>
          </Button>

          {expandedChapters.includes(String(chapter.id)) && chapter.sections && (
            <div className="ml-4 mt-0.5">
              {chapter.sections.map((section, index) => {
                const sectionId = `${chapter.id}-${index + 1}`
                const pageOffset = section.page_offset || 0
                const title = section.title || `Section ${index + 1}`

                return (
                  <div
                    key={sectionId}
                    className="w-full justify-start p-1.5 h-auto hover:bg-[#3e3e42] text-left relative group cursor-pointer rounded"
                    onMouseEnter={() => setHoveredSection(sectionId)}
                    onMouseLeave={() => setHoveredSection(null)}
                    onClick={() => handleSectionClick(String(chapter.id), sectionId, pageOffset)}
                  >
                    <div className="flex items-center gap-1.5 w-full">
                      <FileText className="w-2.5 h-2.5 text-[#969696] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-[11px] text-[#cccccc] leading-tight transition-all duration-200 ${
                            hoveredSection === sectionId ? "whitespace-normal" : "truncate"
                          }`}
                        >
                          {title}
                        </div>
                        <div className="text-[10px] text-[#969696] mt-0.5">Page {pageOffset}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto cursor-pointer"
                          onClick={(e) => markSectionComplete(String(chapter.id), sectionId, e)}
                        >
                          <div className="w-1.5 h-1.5 border border-[#969696] rounded-full" />
                        </div>
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