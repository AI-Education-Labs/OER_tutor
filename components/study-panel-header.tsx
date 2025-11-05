"use client"

import { ChevronLeft, ChevronRight, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface StudyPanelHeaderProps {
  title: string
  showCollapseButton?: boolean
  showHelpButton?: boolean
  showHelpActive?: boolean
  collapseDirection?: "left" | "right"
  onCollapse?: () => void
  onHelpToggle?: () => void
}

export function StudyPanelHeader({
  title,
  showCollapseButton = false,
  showHelpButton = false,
  showHelpActive = false,
  collapseDirection = "right",
  onCollapse,
  onHelpToggle,
}: StudyPanelHeaderProps) {
  return (
    <div className="h-8 bg-[#2d2d30] border-b border-[#3e3e42] flex items-center justify-between px-3 flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{title}</span>
        {showHelpButton && (
          <Button
            variant="ghost"
            size="sm"
            className={`w-6 h-6 p-0 hover:bg-[#3e3e42] group relative ${showHelpActive ? "bg-[#3e3e42]" : ""}`}
            onClick={onHelpToggle}
          >
            <HelpCircle className="w-4 h-4" />
            <div className="absolute left-8 top-1/2 transform -translate-y-1/2 bg-[#2d2d30] text-[#cccccc] text-xs px-2 py-1 rounded border border-[#3e3e42] opacity-0 group-hover:opacity-100 transition-opacity duration-100 pointer-events-none whitespace-nowrap z-50">
              Show Learning Tools
            </div>
          </Button>
        )}
      </div>
      {showCollapseButton && onCollapse && (
        <Button variant="ghost" size="sm" className="w-6 h-6 p-0 hover:bg-[#3e3e42]" onClick={onCollapse}>
          {collapseDirection === "left" ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </Button>
      )}
    </div>
  )
}
