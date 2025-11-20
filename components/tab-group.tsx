"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { X, SquarePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TutorPanel } from "@/components/tutor-panel"
import { useDragDrop } from "@/components/drag-drop-provider"
import type { TabGroupData, TabItem } from "@/components/study-interface"

interface TabGroupProps {
  group: TabGroupData
  onUpdateGroup: (updates: Partial<TabGroupData>) => void
  onRemoveGroup: () => void
  onOpenToolGrid?: () => void
  isNarrowPanel?: boolean
  style?: React.CSSProperties
  textbookId?: string
  selectedChapterId?: string
}

export function TabGroup({
  group,
  onUpdateGroup,
  onRemoveGroup,
  onOpenToolGrid,
  isNarrowPanel = true,
  style,
  textbookId,
  selectedChapterId,
}: TabGroupProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)
  const [showIconOnly, setShowIconOnly] = useState(false)
  const [showAddToolTooltip, setShowAddToolTooltip] = useState(false)
  const [addToolTooltipPos, setAddToolTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const { draggedTab, setDraggedTab } = useDragDrop()
  const tabContainerRef = useRef<HTMLDivElement>(null)
  const addButtonRef = useRef<HTMLButtonElement>(null)

  // Calculate if we should show icon-only tabs based on available width
  useEffect(() => {
    const calculateTabDisplay = () => {
      if (!tabContainerRef.current) return

      const containerWidth = tabContainerRef.current.offsetWidth
      const tabCount = group.tabs.length
      const fullTabWidth = 160 // Width of tab with label
      const iconOnlyTabWidth = 32 // Width of icon-only tab (optimized)
      const addButtonWidth = onOpenToolGrid ? 32 : 0

      // Check if full tabs would fit
      const fullTabsWidth = tabCount * fullTabWidth + addButtonWidth
      const iconOnlyTabsWidth = tabCount * iconOnlyTabWidth + addButtonWidth

      if (fullTabsWidth > containerWidth && iconOnlyTabsWidth <= containerWidth) {
        setShowIconOnly(true)
      } else if (fullTabsWidth <= containerWidth) {
        setShowIconOnly(false)
      }
    }

    calculateTabDisplay()

    // Recalculate on resize
    const resizeObserver = new ResizeObserver(calculateTabDisplay)
    if (tabContainerRef.current) {
      resizeObserver.observe(tabContainerRef.current)
    }

    return () => resizeObserver.disconnect()
  }, [group.tabs.length, onOpenToolGrid])

  const handleTabDragStart = (e: React.DragEvent, tab: TabItem) => {
    setDraggedTab({ tab, sourceGroupId: group.id })
    e.dataTransfer.effectAllowed = "move"
  }

  const handleTabDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverIndex(index)
  }

  const handleTabDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(null)

    if (!draggedTab) return

    if (draggedTab.sourceGroupId === group.id) {
      // Reorder within same group
      const newTabs = [...group.tabs]
      const draggedIndex = newTabs.findIndex((t) => t.id === draggedTab.tab.id)
      const [removed] = newTabs.splice(draggedIndex, 1)
      newTabs.splice(index, 0, removed)

      onUpdateGroup({ tabs: newTabs })
    }

    setDraggedTab(null)
  }

  const handleTabDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleTabMouseEnter = (e: React.MouseEvent, tabId: string, tabLabel: string) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const textElement = e.currentTarget.querySelector(".tab-text") as HTMLElement

    // Show tooltip if in icon-only mode or if text is truncated
    if (showIconOnly || (textElement && textElement.scrollWidth > textElement.clientWidth)) {
      setHoveredTabId(tabId)
      setTooltipPosition({
        x: rect.left + rect.width / 2,
        y: rect.bottom + 4,
      })
    }
  }

  const handleTabMouseLeave = () => {
    setHoveredTabId(null)
    setTooltipPosition(null)
  }

  const removeTab = (tabId: string) => {
    const newTabs = group.tabs.filter((t) => t.id !== tabId)

    if (newTabs.length === 0) {
      onRemoveGroup()
      return
    }

    let newActiveTab = group.activeTab
    if (group.activeTab === tabId) {
      newActiveTab = newTabs[0].id
    }

    onUpdateGroup({ tabs: newTabs, activeTab: newActiveTab })
  }

  const activeTab = group.tabs.find((t) => t.id === group.activeTab)

  return (
    <div className="flex flex-col border-b border-[#3e3e42] bg-[#252526] min-h-0 relative" style={style}>
      {/* Tab bar */}
      <div className="flex items-center bg-[#2d2d30] border-b border-[#3e3e42] min-h-[35px] flex-shrink-0">
        <div ref={tabContainerRef} className="flex flex-1 overflow-x-auto scrollbar-none" onDragLeave={handleTabDragLeave}>
          {group.tabs.map((tab, index) => (
            <div
              key={tab.id}
              className={`relative flex items-center justify-center border-r border-[#3e3e42] transition-all duration-200 group ${
                group.activeTab === tab.id
                  ? "bg-[#1e1e1e] text-[#ffffff]"
                  : "bg-[#2d2d30] text-[#cccccc] hover:bg-[#3e3e42]"
              } ${dragOverIndex === index ? "bg-[#007acc]" : ""} ${tab.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              style={{
                width: showIconOnly ? "32px" : "160px",
                height: "35px",
                padding: showIconOnly ? "0" : "0 8px",
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
              }}
              draggable
              onDragStart={(e) => handleTabDragStart(e, tab)}
              onDragOver={(e) => handleTabDragOver(e, index)}
              onDrop={(e) => handleTabDrop(e, index)}
              onClick={() => {
                if (tab.disabled) return
                onUpdateGroup({ activeTab: tab.id })
              }}
              onMouseEnter={(e) => handleTabMouseEnter(e, tab.id, tab.label)}
              onMouseLeave={handleTabMouseLeave}
              title=""
            >
              {showIconOnly ? (
                <>
                  {/* In icon-only mode: show icon by default, X on hover */}
                  <tab.icon className="w-4 h-4 flex-shrink-0 group-hover:hidden" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden group-hover:flex w-4 h-4 p-0 items-center justify-center flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeTab(tab.id)
                    }}
                  >
                    <X className="w-3 h-3 text-white" />
                  </Button>
                </>
              ) : (
                <>
                  {/* Icon */}
                  <tab.icon className="w-4 h-4 flex-shrink-0" />

                  {/* Text */}
                  <span className="tab-text text-sm ml-2 truncate flex-1 min-w-0">{tab.label}</span>

                  {/* Close button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-5 h-5 p-0 ml-2 hover:bg-[#3e3e42] flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeTab(tab.id)
                    }}
                  >
                    <X className="w-3 h-3 text-white" />
                  </Button>
                </>
              )}

              {/* Drop indicator */}
              {dragOverIndex === index && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#007acc]" />}
            </div>
          ))}

          {/* Add tool button - inside scrollable container */}
          {onOpenToolGrid && (
            <Button
              ref={addButtonRef}
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0 hover:bg-[#3e3e42] flex-shrink-0 border-r border-[#3e3e42]"
              onClick={onOpenToolGrid}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                setAddToolTooltipPos({ x: rect.left + rect.width / 2, y: rect.bottom + 4 })
                setShowAddToolTooltip(true)
              }}
              onMouseLeave={() => {
                setShowAddToolTooltip(false)
                setAddToolTooltipPos(null)
              }}
            >
              <SquarePlus className="w-4 h-4 text-[#cccccc] hover:text-white" />
            </Button>
          )}
        </div>
      </div>

      {/* Floating tooltip for tabs */}
      {hoveredTabId && tooltipPosition && (
        <div
          className="fixed bg-[#2d2d30] text-[#cccccc] text-xs px-2 py-1 rounded border border-[#3e3e42] shadow-lg z-50 pointer-events-none max-w-xs"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: "translateX(-50%)",
          }}
        >
          {group.tabs.find((tab) => tab.id === hoveredTabId)?.label}
        </div>
      )}

      {/* Floating tooltip for add tool button */}
      {showAddToolTooltip && addToolTooltipPos && (
        <div
          className="fixed bg-[#2d2d30] text-[#cccccc] text-xs px-2 py-1 rounded border border-[#3e3e42] shadow-lg z-50 pointer-events-none whitespace-nowrap"
          style={{
            left: `${addToolTooltipPos.x}px`,
            top: `${addToolTooltipPos.y}px`,
            transform: "translateX(-50%)",
          }}
        >
          Add Tool
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
        <div className="flex-1 overflow-auto pr-1 pb-2">
          {activeTab && (
            <TutorPanel activeTab={activeTab.content} textbookId={textbookId} selectedChapterId={selectedChapterId} />
          )}
        </div>
      </div>
    </div>
  )
}
