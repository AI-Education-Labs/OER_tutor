"use client"

import { useState, type ReactNode } from "react"

interface StudyResizablePanelProps {
  initialWidth: number
  minWidth?: number
  maxWidth?: number
  children: ReactNode
  className?: string
}

export function StudyResizablePanel({
  initialWidth,
  minWidth = 200,
  maxWidth = 700,
  children,
  className = "",
}: StudyResizablePanelProps) {
  const [width, setWidth] = useState(initialWidth)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = width

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startX - e.clientX
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX))
      setWidth(newWidth)
    }

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }

  return (
    <div className={`relative ${className}`} style={{ width: `${width}px` }}>
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 bg-transparent hover:bg-[#007acc] cursor-col-resize z-10 group"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-[#3e3e42] opacity-0 group-hover:opacity-100 transition-opacity"></div>
      </div>
      {children}
    </div>
  )
}
