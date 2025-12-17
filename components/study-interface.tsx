"use client"

import { useState, useEffect, useRef } from "react"
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
  Tally1,
  Home,
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
  disabled?: boolean
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

  // Textbook metadata and progress state
  const [textbookData, setTextbookData] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [currentProgress, setCurrentProgress] = useState(0)
  const [currentSectionTitle, setCurrentSectionTitle] = useState<string>("")
  const [currentSectionId, setCurrentSectionId] = useState<string | undefined>(undefined)
  const [currentChapterTitle, setCurrentChapterTitle] = useState<string>("")
  const [totalPages, setTotalPages] = useState(0)
  const [targetPage, setTargetPage] = useState<number | undefined>(undefined)

  // Flash animation states
  const [chaptersFlashing, setChaptersFlashing] = useState(false)
  const [toolsFlashing, setToolsFlashing] = useState(false)

  // Mobile-specific state
  const [mobileActivePanel, setMobileActivePanel] = useState<"chapters" | "pdf" | "tools">("pdf")
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false)
  const [mobileChaptersOpen, setMobileChaptersOpen] = useState(false)

  const [selectedChapterId, setSelectedChapterId] = useState<string | undefined>(undefined)
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [leftPanelWidth, setLeftPanelWidth] = useState(208) // 208px = w-52 (13rem)
  const [rightPanelWidth, setRightPanelWidth] = useState(400)
  const [showHelpTab, setShowHelpTab] = useState(false)
  const [isRightPanelNarrow, setIsRightPanelNarrow] = useState(false)
  const titleBarRef = useRef<HTMLDivElement | null>(null)

  // Set initial chapter panel width to 20% of viewport on first load
  useEffect(() => {
    if (typeof window === "undefined") return
    const baseWidth = titleBarRef.current?.clientWidth || window.innerWidth || 0
    const initialWidth = Math.max(150, Math.min(500, Math.round(baseWidth * 0.2)))
    setLeftPanelWidth(initialWidth)
  }, [])

  // Fetch textbook metadata on component mount
  useEffect(() => {
    const fetchTextbookData = async () => {
      if (!textbookId) return

      const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL
      try {
        const token = localStorage.getItem("access_token")
        const response = await fetch(`${backendUrl}/api/v1/textbooks/${encodeURIComponent(textbookId)}`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        })
        console.log("[v0] Fetch response status:", response.status)

        if (response.ok) {
          const data = await response.json()
          console.log("[v0] Raw textbook data received:", data)
          setTextbookData(data)
        } else {
          const errorText = await response.text()
          console.error("[v0] Failed to fetch textbook data - response not ok:", response.status)
          console.error("[v0] Error response body:", errorText)
        }
      } catch (error) {
        console.error("[v0] Failed to fetch textbook data:", error)
        if (error instanceof Error) {
          console.error("[v0] Error details:", {
            message: error.message,
            stack: error.stack,
            name: error.name,
          })
        } else {
          console.error("[v0] Unknown error type:", error)
        }
      }
    }

    fetchTextbookData()
  }, [textbookId])

  // Restore last visit for this textbook (non-blocking UI)
  useEffect(() => {
    const restore = async () => {
      if (!textbookId) return
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null
        if (!token) return
        const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL
        const resp = await fetch(`${backendUrl}/api/v1/progress/${encodeURIComponent(textbookId)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        })
        if (!resp.ok) return
        const data = await resp.json()
        const last = data?.last_visit
        if (last && typeof last.chapter === "number") {
          setSelectedChapterId(String(last.chapter))
        }
      } catch (e) {
        // ignore restore failures
      }
    }
    restore()
  }, [textbookId])

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
    if (tab.disabled) return
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
    if (tab.disabled) return
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
    if (tab.disabled) return
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
    if (tab.disabled) return
    const newGroup: TabGroupData = {
      id: `group-${Date.now()}`,
      tabs: [tab],
      activeTab: tab.id,
      position: { ...position, width: 100, height: 50 },
    }
    setTabGroups((prev) => [...prev, newGroup])
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

  const handleChapterSelect = (chapterId: string) => {
    console.log("[v0] Chapter selected:", chapterId)
    setSelectedChapterId(chapterId)
    setCurrentPage(1)
    setCurrentProgress(0)
    setCurrentSectionTitle("")
    setCurrentSectionId(undefined)
    setTargetPage(undefined)
  }

  const handleSectionSelect = (chapterId: string, sectionId: string, pageOffset?: number) => {
    console.log("[v0] Section selected:", { chapterId, sectionId, pageOffset })

    // If this is a different chapter, load it first
    if (chapterId !== selectedChapterId) {
      setSelectedChapterId(chapterId)
      setCurrentProgress(0)
      // Set target page for when chapter loads
      if (pageOffset !== undefined) {
        setTargetPage(pageOffset + 1)
      }
    } else {
      // Same chapter, just scroll to the page
      if (pageOffset !== undefined) {
        setTargetPage(pageOffset + 1)
      }
    }

    let sectionTitle = String(sectionId)

    if (textbookData && textbookData.chapters) {
      const chapter = textbookData.chapters.find((ch: any) => ch.id.toString() === chapterId.toString())
      if (chapter && chapter.sub_chapters) {
        const section = chapter.sub_chapters.find((sub: any, index: number) => {
          // Handle both old format (strings) and new format (objects with title/pageOffset)
          if (typeof sub === "string") {
            return `${chapterId}-${index + 1}` === sectionId
          } else if (sub && typeof sub === "object" && sub.title) {
            return `${chapterId}-${index + 1}` === sectionId
          }
          return false
        })

        if (section) {
          sectionTitle = typeof section === "string" ? section : section.title
        }
      }
    }

    setCurrentSectionTitle(sectionTitle)
    setCurrentSectionId(`${chapterId}-${sectionId.split("-").pop() || sectionId}`)
  }

  const handlePageChange = (page: number, total: number) => {
    setCurrentPage(page)
    setTotalPages(total)
    updateActiveSectionFromPage(page)
  }

  const handleChapterLoad = (chapterTitle: string, total: number) => {
    setCurrentChapterTitle(chapterTitle)
    setTotalPages(total)
  }

  const handleProgressChange = (progress: number) => {
    setCurrentProgress(progress)
    // Best-effort persist last visit in background
    if (!textbookId || !selectedChapterId) return
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null
      if (!token) return
      // Fire-and-forget last visit using keepalive for page-close safety
      // fetch(`/api/user/progress/${encodeURIComponent(textbookId)}/last-visit`, {
      //   method: "PATCH",
      //   headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
      //   body: JSON.stringify({ chapter: Number(selectedChapterId), page: currentPage || 1 }),
      //   keepalive: true,
      // }).catch(() => {})
    } catch {
      // noop
    }
  }

  const getCurrentChapterInfo = () => {
    if (!textbookData || !selectedChapterId) {
      return {
        chapterTitle: "No Chapter Selected",
        chapterNumber: 0,
        totalChapters: textbookData?.chapters?.length || 0,
        sectionTitle: "",
      }
    }

    const chapterIndex = textbookData.chapters.findIndex((ch: any) => ch.id.toString() === selectedChapterId.toString())
    const chapter = textbookData.chapters[chapterIndex]

    if (!chapter) {
      return {
        chapterTitle: "Chapter Not Found",
        chapterNumber: 0,
        totalChapters: textbookData.chapters.length,
        sectionTitle: "",
      }
    }

    return {
      chapterTitle: currentChapterTitle || chapter.title,
      chapterNumber: chapter.id,
      totalChapters: textbookData.chapters.length,
      sectionTitle: currentSectionTitle || chapter.sub_chapters?.[0]?.title || "",
    }
  }

  const updateActiveSectionFromPage = (page: number) => {
    if (!textbookData || !selectedChapterId) return
    const chapter = textbookData.chapters?.find(
      (ch: any) => ch.id?.toString() === selectedChapterId?.toString(),
    )
    if (!chapter || !chapter.sub_chapters || chapter.sub_chapters.length === 0) return

    type SectionInfo = { id: string; title: string; startPage: number }

    const sections: SectionInfo[] = chapter.sub_chapters.map((sub: any, index: number): SectionInfo => {
      const title = typeof sub === "object" && sub !== null ? sub.title || `Section ${index + 1}` : String(sub)
      const rawOffset =
        typeof sub === "object" && sub !== null && typeof sub.pageOffset === "number" ? sub.pageOffset : undefined
      const startPage = (rawOffset ?? index) + 1 // fallback to order if no pageOffset
      const id = `${chapter.id}-${index + 1}`
      return { id, title, startPage }
    })

    const sorted = sections.slice().sort((a: SectionInfo, b: SectionInfo) => a.startPage - b.startPage)
    const active = sorted.reduce((acc, section) => (section.startPage <= page ? section : acc), sorted[0])

    setCurrentSectionId(active.id)
    setCurrentSectionTitle(active.title)
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
        <ChapterSelector
          textbookId={textbookId}
          onChapterSelect={handleChapterSelect}
          onSectionSelect={handleSectionSelect}
        />
      </div>
    </div>
  )

  const handleSplitGroup = (groupId: string, direction: "horizontal" | "vertical") => {
    // TODO: Implement actual split behavior for tab groups
    console.warn("Split group not yet implemented", { groupId, direction })
  }

  return (
    <DragDropProvider
      onMoveTab={moveTabToGroup}
      onCreateGroup={createNewTabGroup}
      onSplitGroup={handleSplitGroup}
    >
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
        <div
          ref={titleBarRef}
          className="h-8 bg-[#323233] border-b border-[#2d2d30] flex items-center px-4 flex-shrink-0"
        >
          <div className="flex items-center gap-2">
            <Link href="/">
              <div
                className="cursor-pointer hover:bg-[#3e3e42] p-1 rounded transition-colors relative group flex items-center justify-center"
                title="Return to Home"
              >
                <Home className="w-4 h-4 text-[#cccccc] group-hover:text-[#ffffff] transition-colors" />
              </div>
            </Link>
          </div>
          <div className="flex-1 text-center text-sm">Research Methods in Psychology</div> 
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
              <div
                className="hidden md:flex relative bg-[#252526] border-r border-[#3e3e42] flex-shrink-0 flex-col"
                style={{ width: `${leftPanelWidth}px` }}
              >
                {/* Resize handle */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-[#2d2d30] cursor-col-resize z-10 group"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    const startX = e.clientX
                    const startWidth = leftPanelWidth

                    const handleMouseMove = (e: MouseEvent) => {
                      const deltaX = e.clientX - startX
                      const newWidth = Math.max(150, Math.min(500, startWidth + deltaX))
                      setLeftPanelWidth(newWidth)
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
                  <div className="absolute right-[-4px] top-1/2 -translate-y-1/2">
                    <div className="flex items-center justify-center h-6 w-1.5 rounded-md bg-[#3D3D40] text-[#3D3D40] border border-[#252526] shadow-sm overflow-hidden">
                      <Tally1 className="h-3.5 w-3.5" />
                      <span className="sr-only">Resize chapter navigation panel</span>
                    </div>
                  </div>
                </div>

                <div className="h-8 bg-[#2d2d30] border-b border-[#3e3e42] flex items-center justify-between px-3 flex-shrink-0">
                  {/* <span className="text-sm font-medium">CHAPTERS</span> */}
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
                  <ChapterSelector
                    textbookId={textbookId}
                    onChapterSelect={handleChapterSelect}
                    onSectionSelect={handleSectionSelect}
                    activeChapterId={selectedChapterId}
                    activeSectionId={currentSectionId}
                  />
                </div>
              </div>
            )}

            {/* Center panel - PDF viewer */}
            <div className="flex-1 bg-[#1e1e1e] min-w-0 flex flex-col">
              <div className="relative h-8 bg-[#2d2d30] border-b border-[#3e3e42] flex items-center px-3 flex-shrink-0 overflow-visible">
                {/* Overlays to mask adjacent panel borders just for this bar */}
                <div
                  className="pointer-events-none absolute -left-[1px] top-0 bottom-0 w-[2px] bg-[#2d2d30]"
                  aria-hidden="true"
                />
                <div
                  className="pointer-events-none absolute -right-[1px] top-0 bottom-0 w-[2px] bg-[#2d2d30]"
                  aria-hidden="true"
                />
                <div className="flex items-center justify-between w-full">
                  <div className="w-8 flex justify-start">
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
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  )}
                  </div>

                  {/* Breadcrumb Navigation */}
                  <div className="flex-1 flex items-center justify-center gap-1 text-sm min-w-0 overflow-hidden text-center">
                    {(() => {
                      const chapterInfo = getCurrentChapterInfo()
                      return (
                        <>
                          <span
                            className="truncate block text-[#cccccc] hover:text-[#ffffff] cursor-pointer transition-colors"
                            title={`Chapter ${chapterInfo.chapterNumber}: ${chapterInfo.chapterTitle}`}
                          >
                            Chapter {chapterInfo.chapterNumber}: {chapterInfo.chapterTitle}
                          </span>

                          {chapterInfo.sectionTitle && (
                            <>
                              <ChevronRight className="w-3 h-3 text-[#969696] flex-shrink-0" />
                              <span
                                className="truncate block text-[#007acc] font-medium"
                                title={chapterInfo.sectionTitle}
                              >
                                {chapterInfo.sectionTitle}
                              </span>
                            </>
                          )}

                          <span className="text-[#969696] ml-2 flex-shrink-0 hidden sm:inline">
                            • Page {currentPage}
                          </span>
                        </>
                      )
                    })()}
                  </div>

                  <div className="w-8 flex justify-end">
                    {rightPanelCollapsed && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`w-6 h-6 p-0 hover:bg-[#3e3e42] rounded ${toolsFlashing ? "flash-animation" : ""}`}
                        onClick={() => setRightPanelCollapsed(false)}
                        title="Open Learning Tools"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div id="pdf-root" className="flex-1 min-h-0 min-w-0 overflow-hidden">
                <PDFViewer
                  textbookId={textbookId}
                  selectedChapterId={selectedChapterId}
                  targetPage={targetPage}
                  onPageChange={handlePageChange}
                  onChapterLoad={handleChapterLoad}
                  onProgressChange={handleProgressChange}
                />
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
                  className="absolute left-0 top-0 bottom-0 w-3 cursor-col-resize z-10 group"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    const startX = e.clientX
                    const startWidth = rightPanelWidth

                    // Calculate available width: window width minus left panel minus minimum PDF width
                    const minPdfWidth = 300
                    const currentLeftPanelWidth = leftPanelCollapsed ? 0 : leftPanelWidth
                    const maxRightPanelWidth = Math.min(450, window.innerWidth - currentLeftPanelWidth - minPdfWidth)

                    const handleMouseMove = (e: MouseEvent) => {
                      const deltaX = startX - e.clientX
                      const newWidth = Math.max(200, Math.min(maxRightPanelWidth, startWidth + deltaX))
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
                  {/* Thin hover line (keeps the affordance visually narrow while the hit-area is wider) */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-1 bg-transparent group-hover:bg-[#2d2d30]"
                    aria-hidden="true"
                  />

                  {/* Visual indicator for resize handle */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 pointer-events-none">
                    <div className="flex items-center justify-center h-6 w-1.5 rounded-md bg-[#3D3D40] text-[#3D3D40] border border-[#252526] shadow-sm overflow-hidden">
                      <Tally1 className="h-3.5 w-3.5" />
                      <span className="sr-only">Resize learning tools panel</span>
                    </div>
                  </div>
                </div>

                {/* Panel header */}
                <div className="relative h-8 bg-[#2d2d30] border-b border-[#3e3e42] flex items-center justify-between px-3 flex-shrink-0">
                  <div
                    className="pointer-events-none absolute -left-[1px] top-0 bottom-0 w-[2px] bg-[#2d2d30]"
                    aria-hidden="true"
                  />
                  <div className="flex items-center gap-2"></div>
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
                        onRemoveGroup={() => removeTabGroup(group.id)}
                        onOpenToolGrid={toggleHelpTab}
                        isNarrowPanel={isRightPanelNarrow}
                        textbookId={textbookId}
                        selectedChapterId={selectedChapterId}
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
          {(() => {
            const chapterInfo = getCurrentChapterInfo()
            return (
              <span>
                Chapter {chapterInfo.chapterNumber} of {chapterInfo.totalChapters} • Page {currentPage} of {totalPages}{" "}
                • {currentProgress}% Complete
              </span>
            )
          })()}
          <div className="ml-auto flex items-center gap-4">
            <span>Learning Mode: Socratic</span>
            {/* TODO: Implement study time tracking */}
            {/* <span>Study Time: 0h 0m</span> */}
          </div>
        </div>

        {/* Mobile Status bar */}
        <div className="md:hidden h-8 bg-[#007acc] text-white text-xs flex items-center justify-center px-4 flex-shrink-0">
          {(() => {
            const chapterInfo = getCurrentChapterInfo()
            return (
              <span>
                Ch {chapterInfo.chapterNumber} • Page {currentPage} of {totalPages} • {currentProgress}%
              </span>
            )
          })()}
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
