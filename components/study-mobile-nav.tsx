"use client"

import { BookOpen, FileText, Target } from "lucide-react"
import { Button } from "@/components/ui/button"

interface StudyMobileNavProps {
  mobileChaptersOpen: boolean
  mobileToolsOpen: boolean
  onChaptersToggle: () => void
  onPDFSelect: () => void
  onToolsToggle: () => void
}

export function StudyMobileNav({
  mobileChaptersOpen,
  mobileToolsOpen,
  onChaptersToggle,
  onPDFSelect,
  onToolsToggle,
}: StudyMobileNavProps) {
  return (
    <div className="md:hidden h-12 bg-[#2d2d30] border-b border-[#3e3e42] flex items-center justify-around flex-shrink-0">
      <Button
        variant="ghost"
        size="sm"
        className={`flex flex-col items-center gap-1 h-10 px-3 ${mobileChaptersOpen ? "bg-[#3e3e42]" : ""}`}
        onClick={onChaptersToggle}
      >
        <BookOpen className="w-4 h-4" />
        <span className="text-xs">Chapters</span>
      </Button>

      <Button variant="ghost" size="sm" className="flex flex-col items-center gap-1 h-10 px-3" onClick={onPDFSelect}>
        <FileText className="w-4 h-4" />
        <span className="text-xs">PDF</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className={`flex flex-col items-center gap-1 h-10 px-3 ${mobileToolsOpen ? "bg-[#3e3e42]" : ""}`}
        onClick={onToolsToggle}
      >
        <Target className="w-4 h-4" />
        <span className="text-xs">Tools</span>
      </Button>
    </div>
  )
}
