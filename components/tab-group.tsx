"use client"

import type React from "react"

import { useState } from "react"
import { X, MoreHorizontal, SplitSquareHorizontal, SplitSquareVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { TutorPanel } from "@/components/tutor-panel"
import { useDragDrop } from "@/components/drag-drop-provider"
import type { TabGroupData, TabItem } from "@/components/study-interface"

interface TabGroupProps {
  group: TabGroupData
  onUpdateGroup: (updates: Partial<TabGroupData>) => void
  onSplitGroup: (direction: "horizontal" | "vertical") => void
  onRemoveGroup: () => void
  isNarrowPanel?: boolean
  style?: React.CSSProperties
}

export function TabGroup({
  group,
  onUpdateGroup,
  onSplitGroup,
  onRemoveGroup,
  isNarrowPanel = true,
  style,
}: TabGroupProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)
  const { draggedTab, setDraggedTab } = useDragDrop()

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

    // Check if text is truncated by comparing scroll width to client width
    if (textElement && textElement.scrollWidth > textElement.clientWidth) {
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
        <div className="flex flex-1 overflow-x-auto scrollbar-none" onDragLeave={handleTabDragLeave}>
          {group.tabs.map((tab, index) => (
            <div
              key={tab.id}
              className={`relative flex items-center border-r border-[#3e3e42] cursor-pointer transition-all duration-200 group ${
                group.activeTab === tab.id
                  ? "bg-[#1e1e1e] text-[#ffffff]"
                  : "bg-[#2d2d30] text-[#cccccc] hover:bg-[#3e3e42]"
              } ${dragOverIndex === index ? "bg-[#007acc]" : ""}`}
              style={{
                width: "160px",
                height: "35px",
                padding: "0 8px",
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
              }}
              draggable
              onDragStart={(e) => handleTabDragStart(e, tab)}
              onDragOver={(e) => handleTabDragOver(e, index)}
              onDrop={(e) => handleTabDrop(e, index)}
              onClick={() => onUpdateGroup({ activeTab: tab.id })}
              onMouseEnter={(e) => handleTabMouseEnter(e, tab.id, tab.label)}
              onMouseLeave={handleTabMouseLeave}
              title=""
            >
              {/* Icon */}
              <tab.icon className="w-4 h-4 flex-shrink-0" />

              {/* Text */}
              <span className="tab-text text-sm ml-2 truncate flex-1 min-w-0">{tab.label}</span>

              {/* Close button - always visible */}
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

              {/* Drop indicator */}
              {dragOverIndex === index && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#007acc]" />}
            </div>
          ))}
        </div>

        {/* Group actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="w-8 h-8 p-0 hover:bg-[#3e3e42] flex-shrink-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-[#2d2d30] border-[#3e3e42] text-[#cccccc]">
            <DropdownMenuItem onClick={() => onSplitGroup("horizontal")} className="hover:bg-[#3e3e42]">
              <SplitSquareHorizontal className="w-4 h-4 mr-2" />
              Split Right
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSplitGroup("vertical")} className="hover:bg-[#3e3e42]">
              <SplitSquareVertical className="w-4 h-4 mr-2" />
              Split Down
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Floating tooltip */}
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

      {/* Tab content */}
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
        <div className="flex-1 overflow-auto pr-1 pb-2">
          {activeTab && <TutorPanel activeTab={activeTab.content} />}
        </div>
      </div>
    </div>
  )
}
