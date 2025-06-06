"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect } from "react"

interface ResizablePanelProps {
  width?: number
  height?: number
  onResize?: (width: number) => void
  onResizeHeight?: (height: number) => void
  minWidth?: number
  maxWidth?: number
  minHeight?: number
  maxHeight?: number
  side: "left" | "right" | "top" | "bottom"
  children: React.ReactNode
}

export function ResizablePanel({
  width,
  height,
  onResize,
  onResizeHeight,
  minWidth = 100,
  maxWidth = 1000,
  minHeight = 100,
  maxHeight = 1000,
  side,
  children,
}: ResizablePanelProps) {
  const [isResizing, setIsResizing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true)
    e.preventDefault()
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !panelRef.current) return

      const rect = panelRef.current.getBoundingClientRect()

      if (side === "left" || side === "right") {
        let newWidth: number
        if (side === "left") {
          newWidth = e.clientX - rect.left
        } else {
          newWidth = rect.right - e.clientX
        }
        newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))
        onResize?.(newWidth)
      } else {
        let newHeight: number
        if (side === "top") {
          newHeight = e.clientY - rect.top
        } else {
          newHeight = rect.bottom - e.clientY
        }
        newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight))
        onResizeHeight?.(newHeight)
      }
    },
    [isResizing, side, minWidth, maxWidth, minHeight, maxHeight, onResize, onResizeHeight],
  )

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = side === "left" || side === "right" ? "col-resize" : "row-resize"
      document.body.style.userSelect = "none"

      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }
    }
  }, [isResizing, handleMouseMove, handleMouseUp, side])

  const style: React.CSSProperties = {}
  if (width !== undefined) style.width = `${width}px`
  if (height !== undefined) style.height = `${height}px`

  const isHorizontal = side === "left" || side === "right"
  const handlePosition = {
    left: side === "right" ? 0 : undefined,
    right: side === "left" ? 0 : undefined,
    top: side === "bottom" ? 0 : undefined,
    bottom: side === "top" ? 0 : undefined,
  }

  return (
    <div ref={panelRef} className="relative flex" style={style}>
      {children}

      {/* Resize handle */}
      <div
        className={`absolute bg-transparent hover:bg-[#007acc] cursor-${isHorizontal ? "col" : "row"}-resize z-10 ${
          isHorizontal ? "top-0 bottom-0 w-1" : "left-0 right-0 h-1"
        }`}
        style={handlePosition}
        onMouseDown={handleMouseDown}
      />
    </div>
  )
}
