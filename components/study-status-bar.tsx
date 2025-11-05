"use client"

interface StudyStatusBarProps {
  chapterNumber: number
  totalChapters: number
  currentPage: number
  totalPages: number
  currentProgress: number
  isMobile?: boolean
}

export function StudyStatusBar({
  chapterNumber,
  totalChapters,
  currentPage,
  totalPages,
  currentProgress,
  isMobile = false,
}: StudyStatusBarProps) {
  if (isMobile) {
    return (
      <div className="md:hidden h-8 bg-[#007acc] text-white text-xs flex items-center justify-center px-4 flex-shrink-0">
        <span>
          Ch {chapterNumber} • Page {currentPage} of {totalPages} • {currentProgress}%
        </span>
      </div>
    )
  }

  return (
    <div className="hidden md:flex h-6 bg-[#007acc] text-white text-xs items-center px-4 flex-shrink-0">
      <span>
        Chapter {chapterNumber} of {totalChapters} • Page {currentPage} of {totalPages} • {currentProgress}% Complete
      </span>
      <div className="ml-auto flex items-center gap-4">
        <span>Learning Mode: Socratic</span>
        <span>Study Time: 0h 0m</span>
      </div>
    </div>
  )
}
