"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  MessageSquare,
  Brain,
  CreditCard,
  FileText,
  Target,
  BarChart3,
  BookOpen,
  HelpCircle,
  X,
  Settings,
  MessageSquareText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChapterSelector } from "@/components/chapter-selector"
import { PDFViewer } from "@/components/pdf-viewer"
import { TabGroup } from "@/components/tab-group"
import { DragDropProvider } from "@/components/drag-drop-provider"
import { ToolGrid } from "@/components/tool-grid"
import Link from "next/link"

interface StudyInterfaceProps {
  textbookId?: string // Make optional since we can get from URL
}

export interface TabItem {
  id: string
  label: string
  icon: any
  content: string
  description: string
}

export interface TabGroupData {
  id: string
  tabs: TabItem[]
  activeTab: string
  position: { x: number; y: number; width: number; height: number }
}

export function StudyInterface({ textbookId: propTextbookId }: StudyInterfaceProps) {
  const params = useParams()

  // Get textbookId from props or URL params
  const textbookId = propTextbookId || (params?.id as string)

  // Authentication state
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)

  // Flash animation states
  const [chaptersFlashing, setChaptersFlashing] = useState(false)
  const [toolsFlashing, setToolsFlashing] = useState(false)

  // Mobile-specific state
  const [mobileActivePanel, setMobileActivePanel] = useState<"chapters" | "pdf" | "tools">("pdf")
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false)
  const [mobileChaptersOpen, setMobileChaptersOpen] = useState(false)

  // Get user authentication on component mount
  useEffect(() => {
    const token = localStorage.getItem("access_token")
    setIsLoggedIn(!!token)
    setAuthLoading(false)

    console.log("StudyInterface - Authentication check:", {
      hasToken: !!token,
      textbookId,
      isLoggedIn: !!token,
    })
  }, [])

  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [rightPanelWidth, setRightPanelWidth] = useState(208)
  const [showHelpTab, setShowHelpTab] = useState(false)

  // Track right panel width for responsive behavior
  const [isRightPanelNarrow, setIsRightPanelNarrow] = useState(true)

  useEffect(() => {
    setIsRightPanelNarrow(rightPanelWidth < 300)
  }, [rightPanelWidth])

  // Flash animation effect for chapters
  const handleChaptersFlash = () => {
    if (leftPanelCollapsed) {
      setChaptersFlashing(true)
      const timer = setTimeout(() => {
        setChaptersFlashing(false)
      }, 3200) // 4 flashes at 0.8s each = 3.2 seconds
      return () => clearTimeout(timer)
    }
  }

  // Flash animation effect for tools
  const handleToolsFlash = () => {
    if (rightPanelCollapsed) {
      setToolsFlashing(true)
      const timer = setTimeout(() => {
        setToolsFlashing(false)
      }, 3200) // 4 flashes at 0.8s each = 3.2 seconds
      return () => clearTimeout(timer)
    }
  }

  useEffect(() => {
    handleChaptersFlash()
  }, [leftPanelCollapsed])

  useEffect(() => {
    handleToolsFlash()
  }, [rightPanelCollapsed])

  console.log("StudyInterface - Render state:", {
    textbookId,
    isLoggedIn,
    authLoading,
  })

  const tutorTabs: TabItem[] = [
    {
      id: "ai-chat",
      label: "AI Chat",
      icon: MessageSquareText,
      content: "ai-chat",
      description: "Chat with AI about the textbook content and your highlights",
    },
    {
      id: "chat",
      label: "Socratic Dialogue",
      icon: MessageSquare,
      content: "chat",
      description: "Explore concepts through guided questions and discovery",
    },
    {
      id: "quiz",
      label: "Concept Checks",
      icon: Brain,
      content: "quiz",
      description: "Test your understanding with adaptive questions",
    },
    {
      id: "flashcards",
      label: "Flashcards",
      icon: CreditCard,
      content: "flashcards",
      description: "Practice key concepts with spaced repetition",
    },
    {
      id: "notes",
      label: "Study Notes",
      icon: FileText,
      content: "notes",
      description: "AI-generated and personal study notes",
    },
    {
      id: "concepts",
      label: "Key Concepts",
      icon: BookOpen,
      content: "concepts",
      description: "Track your mastery of important concepts",
    },
    {
      id: "practice",
      label: "Practice",
      icon: Target,
      content: "practice",
      description: "Work through problems and exercises",
    },
    {
      id: "progress",
      label: "Progress",
      icon: BarChart3,
      content: "progress",
      description: "Monitor your learning progress and analytics",
    },
  ]

  const [tabGroups, setTabGroups] = useState<TabGroupData[]>([])

  const updateTabGroup = (groupId: string, updates: Partial<TabGroupData>) => {
    setTabGroups((prev) => {
      const newGroups = prev.map((group) => (group.id === groupId ? { ...group, ...updates } : group))
      return newGroups.filter((group) => group.tabs.length > 0)
    })
  }

  const removeTabGroup = (groupId: string) => {
    setTabGroups((prev) => prev.filter((group) => group.id !== groupId))
  }

  const addTabToNewGroup = (tab: TabItem) => {
    const newGroup: TabGroupData = {
      id: `group-${Date.now()}`,
      tabs: [tab],
      activeTab: tab.id,
      position: { x: 0, y: 0, width: 100, height: 100 },
    }
    setTabGroups([newGroup])
    setRightPanelCollapsed(false)
    setShowHelpTab(false)
    setMobileToolsOpen(true)
    setMobileActivePanel("tools")
  }

  const addTabToExistingGroup = (tab: TabItem, groupId?: string) => {
    const targetGroupId = groupId || (tabGroups.length > 0 ? tabGroups[0].id : null)

    if (targetGroupId) {
      setTabGroups((prev) =>
        prev.map((group) =>
          group.id === targetGroupId
            ? {
                ...group,
                tabs: [...group.tabs.filter((t) => t.id !== tab.id), tab],
                activeTab: tab.id,
              }
            : group,
        ),
      )
    } else {
      addTabToNewGroup(tab)
    }
    setRightPanelCollapsed(false)
    setShowHelpTab(false)
    setMobileToolsOpen(true)
    setMobileActivePanel("tools")
  }

  const addToolFromHelpGrid = (tab: TabItem) => {
    if (tabGroups.length > 0) {
      addTabToExistingGroup(tab)
    } else {
      addTabToNewGroup(tab)
    }
    setShowHelpTab(false)
  }

  const moveTabToGroup = (tabId: string, fromGroupId: string, toGroupId: string, index?: number) => {
    setTabGroups((prev) => {
      const newGroups = [...prev]
      const fromGroup = newGroups.find((g) => g.id === fromGroupId)
      const toGroup = newGroups.find((g) => g.id === toGroupId)

      if (!fromGroup || !toGroup) return prev

      const tab = fromGroup.tabs.find((t) => t.id === tabId)
      if (!tab) return prev

      fromGroup.tabs = fromGroup.tabs.filter((t) => t.id !== tabId)

      if (index !== undefined) {
        toGroup.tabs.splice(index, 0, tab)
      } else {
        toGroup.tabs.push(tab)
      }

      toGroup.activeTab = tabId

      return newGroups.filter((group) => group.tabs.length > 0)
    })
  }

  const createNewTabGroup = (tab: TabItem, position: { x: number; y: number }) => {
    const newGroup: TabGroupData = {
      id: `group-${Date.now()}`,
      tabs: [tab],
      activeTab: tab.id,
      position: { ...position, width: 100, height: 50 },
    }
    setTabGroups((prev) => [...prev, newGroup])
  }

  const splitTabGroup = (groupId: string, direction: "horizontal" | "vertical") => {
    setTabGroups((prev) => {
      const group = prev.find((g) => g.id === groupId)
      if (!group || group.tabs.length < 2) return prev

      const midIndex = Math.ceil(group.tabs.length / 2)
      const firstHalf = group.tabs.slice(0, midIndex)
      const secondHalf = group.tabs.slice(midIndex)

      const newGroup: TabGroupData = {
        id: `group-${Date.now()}`,
        tabs: secondHalf,
        activeTab: secondHalf[0].id,
        position: {
          x: group.position.x,
          y: direction === "vertical" ? group.position.y + group.position.height / 2 : group.position.y,
          width: group.position.width,
          height: direction === "vertical" ? group.position.height / 2 : group.position.height,
        },
      }

      return [
        ...prev.filter((g) => g.id !== groupId),
        {
          ...group,
          tabs: firstHalf,
          position: {
            ...group.position,
            height: direction === "vertical" ? group.position.height / 2 : group.position.height,
          },
        },
        newGroup,
      ]
    })
  }

  const toggleHelpTab = () => {
    if (!showHelpTab) {
      setShowHelpTab(true)
      if (rightPanelCollapsed) {
        setRightPanelCollapsed(false)
      }
      setMobileToolsOpen(true)
      setMobileActivePanel("tools")
    } else {
      setShowHelpTab(false)
    }
  }

  // Show authentication required message if not logged in
  if (authLoading) {
    return (
      <div className="h-screen bg-[#1e1e1e] text-[#cccccc] flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg mb-2">Loading...</div>
          <div className="text-sm text-[#969696]">Checking authentication</div>
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="h-screen bg-[#1e1e1e] text-[#cccccc] flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl mb-4">Authentication Required</div>
          <div className="text-sm text-[#969696] mb-6">
            You need to be logged in to access the study interface and track your progress.
          </div>
          <Link href="/auth/login">
            <Button className="bg-[#007acc] hover:bg-[#005a9e] text-white">Sign In</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!textbookId) {
    return (
      <div className="h-screen bg-[#1e1e1e] text-[#cccccc] flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl mb-4">No Textbook Selected</div>
          <div className="text-sm text-[#969696]">Please select a textbook to continue.</div>
        </div>
      </div>
    )
  }

  // Mobile bottom drawer for tools
  const renderMobileToolsDrawer = () => (
    <div
      className={`md:hidden fixed inset-x-0 bottom-0 bg-[#252526] border-t border-[#3e3e42] transform transition-transform duration-300 z-50 ${
        mobileToolsOpen ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="flex items-center justify-between p-3 border-b border-[#3e3e42]">
        <h3 className="text-sm font-medium text-[#ffffff]">Learning Tools</h3>
        <Button
          variant="ghost"
          size="sm"
          className="w-8 h-8 p-0 hover:bg-[#3e3e42]"
          onClick={() => setMobileToolsOpen(false)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="max-h-[60vh] overflow-auto">
        {showHelpTab || tabGroups.length === 0 ? (
          <ToolGrid
            tutorTabs={tutorTabs}
            onSelectTool={tabGroups.length === 0 ? addTabToNewGroup : addToolFromHelpGrid}
          />
        ) : (
          <div className="p-4">
            {tabGroups.map((group) => (
              <TabGroup
                key={group.id}
                group={group}
                onUpdateGroup={(updates) => updateTabGroup(group.id, updates)}
                onSplitGroup={(direction) => splitTabGroup(group.id, direction)}
                onRemoveGroup={() => removeTabGroup(group.id)}
                isNarrowPanel={isRightPanelNarrow}
                style={{ minHeight: "200px" }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )

  // Mobile chapters drawer
  const renderMobileChaptersDrawer = () => (
    <div
      className={`md:hidden fixed inset-x-0 bottom-0 bg-[#252526] border-t border-[#3e3e42] transform transition-transform duration-300 z-50 ${
        mobileChaptersOpen ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="flex items-center justify-between p-3 border-b border-[#3e3e42]">
        <h3 className="text-sm font-medium text-[#ffffff]">Chapters</h3>
        <Button
          variant="ghost"
          size="sm"
          className="w-8 h-8 p-0 hover:bg-[#3e3e42]"
          onClick={() => setMobileChaptersOpen(false)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="max-h-[60vh] overflow-auto">
        <ChapterSelector textbookId={textbookId} />
      </div>
    </div>
  )

  return (
    <DragDropProvider onMoveTab={moveTabToGroup} onCreateGroup={createNewTabGroup} onSplitGroup={splitTabGroup}>
      <div className="h-screen bg-[#1e1e1e] text-[#cccccc] flex flex-col overflow-hidden">
        {/* Custom CSS for flash animation */}
        <style jsx>{`
          @keyframes flash-bg {
            0%, 100% { background-color: transparent; }
            50% { background-color: rgba(0, 122, 204, 0.3); }
          }
          .flash-animation {
            animation: flash-bg 0.8s ease-in-out 4;
          }
        `}</style>

        {/* VSCode-style title bar */}
        <div className="h-8 bg-[#323233] border-b border-[#2d2d30] flex items-center px-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Link href="/">
              <div
                className="w-3 h-3 rounded-full bg-[#ff5f57] cursor-pointer hover:bg-[#ff4444] transition-colors relative group flex items-center justify-center"
                title="Return to Home"
              >
                <X className="w-2 h-2 text-[#8b0000] opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </div>
            </Link>
          </div>
          <div className="flex-1 text-center text-sm">StudyCode - Physics</div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden h-12 bg-[#2d2d30] border-b border-[#3e3e42] flex items-center justify-around flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className={`flex flex-col items-center gap-1 h-10 px-3 ${mobileChaptersOpen ? "bg-[#3e3e42]" : ""}`}
            onClick={() => setMobileChaptersOpen(!mobileChaptersOpen)}
          >
            <BookOpen className="w-4 h-4" />
            <span className="text-xs">Chapters</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 h-10 px-3"
            onClick={() => {
              setMobileActivePanel("pdf")
              setMobileChaptersOpen(false)
              setMobileToolsOpen(false)
            }}
          >
            <FileText className="w-4 h-4" />
            <span className="text-xs">PDF</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={`flex flex-col items-center gap-1 h-10 px-3 ${mobileToolsOpen ? "bg-[#3e3e42]" : ""}`}
            onClick={() => setMobileToolsOpen(!mobileToolsOpen)}
          >
            <Target className="w-4 h-4" />
            <span className="text-xs">Tools</span>
          </Button>
        </div>

        {/* Main content area */}
        <div className="flex flex-1 min-h-0">
          {/* Content area - no more activity bar */}
          <div className="flex flex-1 min-h-0">
            {/* Desktop Left panel - Chapter selector (hidden on mobile) */}
            {!leftPanelCollapsed && (
              <div className="hidden md:flex w-52 bg-[#252526] border-r border-[#3e3e42] flex-shrink-0 flex-col">
                <div className="h-8 bg-[#2d2d30] border-b border-[#3e3e42] flex items-center justify-between px-3 flex-shrink-0">
                  <span className="text-sm font-medium">CHAPTERS</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-6 h-6 p-0 hover:bg-[#3e3e42]"
                    onClick={() => setLeftPanelCollapsed(true)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-auto">
                  <ChapterSelector textbookId={textbookId} />
                </div>
              </div>
            )}

            {/* Center panel - PDF viewer */}
            <div className="flex-1 bg-[#1e1e1e] min-w-0 flex flex-col">
              <div className="h-8 bg-[#2d2d30] border-b border-[#3e3e42] flex items-center justify-between px-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  {/* Chapters toggle button - moved here from activity bar */}
                  {leftPanelCollapsed && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`w-6 h-6 p-0 hover:bg-[#3e3e42] group relative rounded ${
                        chaptersFlashing ? "flash-animation" : ""
                      }`}
                      onClick={() => setLeftPanelCollapsed(false)}
                      title="Show Chapters"
                    >
                      <Menu className="w-4 h-4" />
                      <div className="absolute left-8 top-1/2 transform -translate-y-1/2 bg-[#2d2d30] text-[#cccccc] text-xs px-2 py-1 rounded border border-[#3e3e42] opacity-0 group-hover:opacity-100 transition-opacity duration-100 pointer-events-none whitespace-nowrap z-50">
                        Show Chapters
                      </div>
                    </Button>
                  )}

                  {/* Breadcrumb Navigation */}
                  <div className="flex items-center gap-1 text-sm min-w-0">
                    <span className="text-[#cccccc] hover:text-[#ffffff] cursor-pointer transition-colors truncate">
                      Chapter 1: What is Physics?
                    </span>
                    <ChevronRight className="w-3 h-3 text-[#969696] flex-shrink-0" />
                    <span className="text-[#007acc] font-medium truncate">Physics: Definitions and Applications</span>
                    <span className="text-[#969696] ml-2 flex-shrink-0 hidden sm:inline">• Page 5</span>
                  </div>
                </div>
                {rightPanelCollapsed && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`w-6 h-6 p-0 hover:bg-[#3e3e42] rounded ${toolsFlashing ? "flash-animation" : ""}`}
                    onClick={() => setRightPanelCollapsed(false)}
                    title="Open Learning Tools"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <div className="flex-1 overflow-auto">
                <PDFViewer />
              </div>
            </div>

            {/* Desktop Right panel - Resizable tutoring tools (hidden on mobile) */}
            {!rightPanelCollapsed && (
              <div
                className="hidden md:flex relative bg-[#252526] border-l border-[#3e3e42] flex-col flex-shrink-0"
                style={{ width: `${rightPanelWidth}px` }}
              >
                {/* Resize handle */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 bg-transparent hover:bg-[#007acc] cursor-col-resize z-10 group"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    const startX = e.clientX
                    const startWidth = rightPanelWidth

                    const handleMouseMove = (e: MouseEvent) => {
                      const deltaX = startX - e.clientX
                      const newWidth = Math.max(208, Math.min(800, startWidth + deltaX))
                      setRightPanelWidth(newWidth)
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
                  }}
                >
                  {/* Visual indicator for resize handle */}
                  <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-[#3e3e42] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>

                {/* Panel header */}
                <div className="h-8 bg-[#2d2d30] border-b border-[#3e3e42] flex items-center justify-between px-3 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">LEARNING TOOLS</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`w-6 h-6 p-0 hover:bg-[#3e3e42] group relative ${showHelpTab ? "bg-[#3e3e42]" : ""}`}
                      onClick={toggleHelpTab}
                    >
                      <HelpCircle className="w-4 h-4" />
                      <div className="absolute left-8 top-1/2 transform -translate-y-1/2 bg-[#2d2d30] text-[#cccccc] text-xs px-2 py-1 rounded border border-[#3e3e42] opacity-0 group-hover:opacity-100 transition-opacity duration-100 pointer-events-none whitespace-nowrap z-50">
                        Show Learning Tools
                      </div>
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-6 h-6 p-0 hover:bg-[#3e3e42]"
                    onClick={() => setRightPanelCollapsed(true)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                {/* Tab groups or tool grid */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  {showHelpTab ? (
                    <div className="flex-1 overflow-auto">
                      <ToolGrid tutorTabs={tutorTabs} onSelectTool={addToolFromHelpGrid} />
                    </div>
                  ) : tabGroups.length === 0 ? (
                    <div className="flex-1 overflow-auto">
                      <ToolGrid tutorTabs={tutorTabs} onSelectTool={addTabToNewGroup} />
                    </div>
                  ) : (
                    tabGroups.map((group, index) => (
                      <TabGroup
                        key={group.id}
                        group={group}
                        onUpdateGroup={(updates) => updateTabGroup(group.id, updates)}
                        onSplitGroup={(direction) => splitTabGroup(group.id, direction)}
                        onRemoveGroup={() => removeTabGroup(group.id)}
                        isNarrowPanel={isRightPanelNarrow}
                        style={{
                          height: `${group.position.height}%`,
                          minHeight: "200px",
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Status bar */}
        <div className="hidden md:flex h-6 bg-[#007acc] text-white text-xs items-center px-4 flex-shrink-0">
          <span>Chapter 1 of 23 • Page 5 • 0% Complete</span>
          <div className="ml-auto flex items-center gap-4">
            <span>Learning Mode: Socratic</span>
            <span>Study Time: 0h 0m</span>
          </div>
        </div>

        {/* Mobile Status bar */}
        <div className="md:hidden h-8 bg-[#007acc] text-white text-xs flex items-center justify-center px-4 flex-shrink-0">
          <span>Ch 1 • Page 5 • 0%</span>
        </div>

        {/* Mobile Drawers */}
        {renderMobileToolsDrawer()}
        {renderMobileChaptersDrawer()}

        {/* Mobile overlay */}
        {(mobileToolsOpen || mobileChaptersOpen) && (
          <div
            className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => {
              setMobileToolsOpen(false)
              setMobileChaptersOpen(false)
            }}
          />
        )}
      </div>
    </DragDropProvider>
  )
}
