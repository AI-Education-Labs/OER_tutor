"use client"

import { ChevronRight } from "lucide-react"

interface StudyBreadcrumbProps {
  chapterNumber: number
  chapterTitle: string
  sectionTitle?: string
  currentPage: number
}

export function StudyBreadcrumb({ chapterNumber, chapterTitle, sectionTitle, currentPage }: StudyBreadcrumbProps) {
  return (
    <div className="flex items-center gap-1 text-sm flex-1 min-w-0 overflow-hidden">
      <span
        className="truncate block flex-1 text-[#cccccc] hover:text-[#ffffff] cursor-pointer transition-colors"
        title={`Chapter ${chapterNumber}: ${chapterTitle}`}
      >
        Chapter {chapterNumber}: {chapterTitle}
      </span>

      {sectionTitle && (
        <>
          <ChevronRight className="w-3 h-3 text-[#969696] flex-shrink-0" />
          <span className="truncate block flex-1 text-[#007acc] font-medium" title={sectionTitle}>
            {sectionTitle}
          </span>
        </>
      )}

      <span className="text-[#969696] ml-2 flex-shrink-0 hidden sm:inline">• Page {currentPage}</span>
    </div>
  )
}
