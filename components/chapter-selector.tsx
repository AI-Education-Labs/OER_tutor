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

export function ChapterSelector({ textbookId, onSectionSelect }: ChapterSelectorProps) {
  const [expandedChapters, setExpandedChapters] = useState<string[]>([])
  const [hoveredChapter, setHoveredChapter] = useState<string | null>(null)
  const [hoveredSection, setHoveredSection] = useState<string | null>(null)
  const [textbookData, setTextbookData] = useState<TextbookWithProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!textbookId) {
      console.log("ChapterSelector: Missing textbookId")
      setError("Missing textbook ID")
      setLoading(false)
      return
    }
    console.log("ChapterSelector: Starting fetch with textbookId:", textbookId)
    fetchTextbookData()
  }, [textbookId])

  const fetchTextbookData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get the authentication token
      const token = localStorage.getItem("access_token")
      if (!token) {
        throw new Error("Authentication required. Please log in.")
      }

      console.log(`ChapterSelector: Fetching textbook preview for ID: ${textbookId}`)

      // First, get the textbook structure/preview
      const textbookResponse = await fetch(`/textbook/get_textbook_preview/${textbookId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      console.log(`ChapterSelector: Textbook response status:`, textbookResponse.status)
      if (!textbookResponse.ok) {
        const errorText = await textbookResponse.text()
        console.error(`ChapterSelector: Textbook fetch failed:`, errorText)
        throw new Error(`Failed to fetch textbook preview: ${textbookResponse.statusText}`)
      }

      const textbookPreview: TextbookPreview = await textbookResponse.json()
      console.log("ChapterSelector: Textbook preview received:", textbookPreview)

      // Then, get the user's progress for this textbook
      console.log(`ChapterSelector: Fetching progress for textbook: ${textbookId}`)
      const progressResponse = await fetch(`/progress/${textbookId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      console.log(`ChapterSelector: Progress response status:`, progressResponse.status)
      if (!progressResponse.ok) {
        const errorText = await progressResponse.text()
        console.error(`ChapterSelector: Progress fetch failed:`, errorText)
        throw new Error(`Failed to fetch user progress: ${progressResponse.statusText}`)
      }

      const userProgress: UserProgress = await progressResponse.json()
      console.log("ChapterSelector: User progress received:", userProgress)

      // Combine textbook structure with user progress
      const combinedData: TextbookWithProgress = {
        textbook_id: textbookPreview.textbook_id,
        title: textbookPreview.title,
        author: textbookPreview.author,
        overall_progress: userProgress.progress.completion_percentage,
        chapters: textbookPreview.chapters.map((chapter) => {
          const chapterProgress = userProgress.progress.chapters[chapter.chapter_id] || {
            completion_percentage: 0,
            sections: {},
          }

          return {
            id: chapter.chapter_id,
            title: chapter.title,
            chapter_number: chapter.chapter_number,
            progress: chapterProgress.completion_percentage,
            sections: chapter.sections.map((section) => {
              const sectionProgress = chapterProgress.sections[section.section_id] || {
                completion_percentage: 0,
                status: "not_started",
              }

              return {
                id: section.section_id,
                title: section.title,
                page: section.page_start,
                completed: sectionProgress.status === "completed",
                progress: sectionProgress.completion_percentage,
              }
            }),
          }
        }),
      }

      console.log("ChapterSelector: Combined data created:", combinedData)
      setTextbookData(combinedData)
    } catch (err) {
      console.error("ChapterSelector: Error in fetchTextbookData:", err)
      setError(err instanceof Error ? err.message : "Failed to load textbook data")
    } finally {
      setLoading(false)
    }
  }

  const updateProgress = async (chapterId: string, sectionId?: string, progressData?: any) => {
    try {
      const token = localStorage.getItem("access_token")
      if (!token) {
        console.error("No authentication token available")
        return
      }

      let url: string
      if (sectionId) {
        // Update subsection progress
        url = `/progress/${textbookId}/chapter/${chapterId}/subsection/${sectionId}`
      } else {
        // Update chapter progress
        url = `/progress/${textbookId}/chapter/${chapterId}`
      }

      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
          progressData || {
            completion_percentage: 100,
            status: "completed",
          },
        ),
      })

      if (!response.ok) {
        throw new Error(`Failed to update progress: ${response.statusText}`)
      }

      // Refresh the data after updating progress
      await fetchTextbookData()
    } catch (err) {
      console.error("Failed to update progress:", err)
    }
  }

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
