"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import type { TabItem } from "@/components/study-interface"

interface DraggedTab {
  tab: TabItem
  sourceGroupId: string
}

interface DragDropContextType {
  draggedTab: DraggedTab | null
  setDraggedTab: (tab: DraggedTab | null) => void
  onMoveTab: (tabId: string, fromGroupId: string, toGroupId: string, index?: number) => void
  onCreateGroup: (tab: TabItem, position: { x: number; y: number }) => void
  onSplitGroup: (groupId: string, direction: "horizontal" | "vertical") => void
}

const DragDropContext = createContext<DragDropContextType | null>(null)

interface DragDropProviderProps {
  children: ReactNode
  onMoveTab: (tabId: string, fromGroupId: string, toGroupId: string, index?: number) => void
  onCreateGroup: (tab: TabItem, position: { x: number; y: number }) => void
  onSplitGroup: (groupId: string, direction: "horizontal" | "vertical") => void
}

export function DragDropProvider({ children, onMoveTab, onCreateGroup, onSplitGroup }: DragDropProviderProps) {
  const [draggedTab, setDraggedTab] = useState<DraggedTab | null>(null)

  return (
    <DragDropContext.Provider
      value={{
        draggedTab,
        setDraggedTab,
        onMoveTab,
        onCreateGroup,
        onSplitGroup,
      }}
    >
      {children}
    </DragDropContext.Provider>
  )
}

export function useDragDrop() {
  const context = useContext(DragDropContext)
  if (!context) {
    throw new Error("useDragDrop must be used within a DragDropProvider")
  }
  return context
}
