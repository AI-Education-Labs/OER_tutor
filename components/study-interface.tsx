"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Menu, Settings, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChapterSelector } from "@/components/chapter-selector"
import { PDFViewer } from "@/components/pdf-viewer"
import { TabGroup } from "@/components/tab-group"
import { DragDropProvider } from "@/components/drag-drop-provider"
import { ToolGrid } from "@/components/tool-grid"
import { StudyBreadcrumb } from "@/components/study-breadcrumb"
import { StudyStatusBar } from "@/components/study-status-bar"
import { StudyMobileNav } from "@/components/study-mobile-nav"
import { StudyMobileDrawer } from "@/components/study-mobile-drawer"
import { StudyPanelHeader } from "@/components/study-panel-header"
import { StudyResizablePanel } from "@/components/study-resizable-panel"
import Link from "next/link"
import { components } from "@/types/api"
import { useTutorTabs } from "@/hooks/use-tutor-tabs"

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

  // Textbook metadata and progress state
  const [textbookData, setTextbookData] = useState<components["schemas"]["Textbook"]|null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [currentProgress, setCurrentProgress] = useState(0)
  const [currentSection, setCurrentSection] = useState<string>("")
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

  const [selectedChapterId, setSelectedChapterId] = useState<string>("")
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [showHelpTab, setShowHelpTab] = useState(false)
  const [isRightPanelNarrow, setIsRightPanelNarrow] = useState(false)

  const tutorTabs = useTutorTabs()
  const [tabGroups, setTabGroups] = useState<TabGroupData[]>([])

  // Fetch textbook metadata on component mount
  useEffect(() => {
    const fetchTextbookData = async () => {
      if (!textbookId) return

      try {
        const response = await fetch(`/api/textbooks/${encodeURIComponent(textbookId)}`)
        if (response.ok) {
          const data: components["schemas"]["Textbook"] = await response.json()
          setTextbookData(data)
        }
      } catch (error) {
        console.log(error)
      }
    }

    fetchTextbookData()
  }, [textbookId])

  // Restore last visit for this textbook (non-blocking UI)
  useEffect(() => {
    const restore = async () => {
      if (!textbookId) return
      try {

        const resp = await fetch(`/api/progress/${encodeURIComponent(textbookId)}`, {
          credentials: "include",
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

  useEffect(() => {
    if (!textbookData || selectedChapterId) {
      return
    }

    const chapters = Array.isArray(textbookData.chapters) ? textbookData.chapters : []
    if (chapters.length === 0) {
      return
    }

    const firstChapterId = chapters[0]?.id
    if (firstChapterId !== undefined && firstChapterId !== null) {
      setSelectedChapterId(String(firstChapterId))
    }
  }, [textbookData, selectedChapterId])

  // Flash animation effect for chapters
  useEffect(() => {
    if (leftPanelCollapsed) {
      setChaptersFlashing(true)
      const timer = setTimeout(() => {
        setChaptersFlashing(false)
      }, 3200)
      return () => clearTimeout(timer)
    }
  }, [leftPanelCollapsed])

  // Flash animation effect for tools
  useEffect(() => {
    if (rightPanelCollapsed) {
      setToolsFlashing(true)
      const timer = setTimeout(() => {
        setToolsFlashing(false)
      }, 3200)
      return () => clearTimeout(timer)
    }
  }, [rightPanelCollapsed])

  // Tab group management functions
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

  const handleChapterSelect = (chapterId: string) => {
    console.log("[v0] Chapter selected:", chapterId)
    setSelectedChapterId(chapterId)
    setCurrentPage(1)
    setCurrentProgress(0)
    setCurrentSection("")
    setTargetPage(undefined)
  }

  const handleSectionSelect = (chapterId: string, sectionId: string, pageOffset?: number) => {
    console.log("[v0] Section selected:", { chapterId, sectionId, pageOffset })

    // If this is a different chapter, load it first
    if (chapterId !== selectedChapterId) {
      setSelectedChapterId(chapterId)
      setCurrentProgress(0)
    }

    // Set target page for navigation (add 1 since pageOffset is 0-based but pages are 1-based)
    if (pageOffset !== undefined) {
      setTargetPage(pageOffset + 1)
    }

  }

  const handlePageChange = (page: number, total: number) => {
    setCurrentPage(page)
    setTotalPages(total)
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
      sectionTitle: currentSection || chapter.sections?.[0]?.title || "",
    }
  }

  const chapterInfo = getCurrentChapterInfo()

  return (
    <DragDropProvider onMoveTab={moveTabToGroup} onCreateGroup={createNewTabGroup} onSplitGroup={splitTabGroup}>
      <div className="h-screen bg-[#1e1e1e] text-[#cccccc] flex flex-col overflow-hidden">
        <style>{`
          @keyframes flash {
            0%, 100% { background-color: transparent; }
            50% { background-color: rgba(0, 122, 204, 0.3); }
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

        {/* Mobile Navigation */}
        <StudyMobileNav
          mobileChaptersOpen={mobileChaptersOpen}
          mobileToolsOpen={mobileToolsOpen}
          onChaptersToggle={() => setMobileChaptersOpen(!mobileChaptersOpen)}
          onPDFSelect={() => {
            setMobileActivePanel("pdf")
            setMobileChaptersOpen(false)
            setMobileToolsOpen(false)
          }}
          onToolsToggle={() => setMobileToolsOpen(!mobileToolsOpen)}
        />

        {/* Main content area */}
        <div className="flex flex-1 min-h-0">
          {/* Content area - no more activity bar */}
          <div className="flex flex-1 min-h-0">
            {/* Left panel - Chapters */}
            {!leftPanelCollapsed && (
              <div className="hidden md:flex w-52 bg-[#252526] border-r border-[#3e3e42] flex-shrink-0 flex-col">
                <StudyPanelHeader
                  title="CHAPTERS"
                  showCollapseButton
                  collapseDirection="left"
                  onCollapse={() => setLeftPanelCollapsed(true)}
                />
                <div className="flex-1 overflow-auto">
                  <ChapterSelector
                    textbook={textbookData}
                    onChapterSelect={handleChapterSelect}
                    onSectionSelect={handleSectionSelect}
                  />
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
                      className={`w-6 h-6 p-0 hover:bg-[#3e3e42] group relative rounded transition-colors ${
                        chaptersFlashing ? "animate-[flash_0.8s_ease-in-out_4] [animation-name:flash] [@keyframes_flash]:from:bg-transparent [@keyframes_flash]:to:bg-transparent [@keyframes_flash]:50%:bg-[rgba(0,122,204,0.3)]" : ""
                      }`}
                      onClick={() => setLeftPanelCollapsed(false)}
                      title="Show Chapters"
                      style={
                        chaptersFlashing
                          ? {
                              animation: "flash 0.8s ease-in-out 4",
                            }
                          : undefined
                      }
                    >
                      <Menu className="w-4 h-4" />
                      <div className="absolute left-8 top-1/2 transform -translate-y-1/2 bg-[#2d2d30] text-[#cccccc] text-xs px-2 py-1 rounded border border-[#3e3e42] opacity-0 group-hover:opacity-100 transition-opacity duration-100 pointer-events-none whitespace-nowrap z-50">
                        Show Chapters
                      </div>
                    </Button>
                  )}

                  <StudyBreadcrumb
                    chapterNumber={chapterInfo.chapterNumber}
                    chapterTitle={chapterInfo.chapterTitle}
                    sectionTitle={chapterInfo.sectionTitle}
                    currentPage={currentPage}
                  />
                </div>
                {rightPanelCollapsed && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`w-6 h-6 p-0 hover:bg-[#3e3e42] rounded transition-colors`}
                    onClick={() => setRightPanelCollapsed(false)}
                    title="Open Learning Tools"
                    style={
                      toolsFlashing
                        ? {
                            animation: "flash 0.8s ease-in-out 4",
                          }
                        : undefined
                    }
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                )}
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

            {/* Right panel - Tools */}
            {!rightPanelCollapsed && (
              <StudyResizablePanel
                initialWidth={400}
                className="hidden md:flex bg-[#252526] border-l border-[#3e3e42] flex-col flex-shrink-0"
              >
                <StudyPanelHeader
                  title="LEARNING TOOLS"
                  showCollapseButton
                  showHelpButton
                  showHelpActive={showHelpTab}
                  onCollapse={() => setRightPanelCollapsed(true)}
                  onHelpToggle={toggleHelpTab}
                />

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
                    tabGroups.map((group) => (
                      <TabGroup
                        key={group.id}
                        group={group}
                        onUpdateGroup={(updates) => updateTabGroup(group.id, updates)}
                        onSplitGroup={(direction) => splitTabGroup(group.id, direction)}
                        onRemoveGroup={() => removeTabGroup(group.id)}
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
              </StudyResizablePanel>
            )}
          </div>
        </div>

        {/* Status bars */}
        <StudyStatusBar
          chapterNumber={chapterInfo.chapterNumber}
          totalChapters={chapterInfo.totalChapters}
          currentPage={currentPage}
          totalPages={totalPages}
          currentProgress={currentProgress}
        />
        <StudyStatusBar
          chapterNumber={chapterInfo.chapterNumber}
          totalChapters={chapterInfo.totalChapters}
          currentPage={currentPage}
          totalPages={totalPages}
          currentProgress={currentProgress}
          isMobile
        />

        {/* Mobile Drawers */}
        <StudyMobileDrawer
          isOpen={mobileToolsOpen}
          title="Learning Tools"
          onClose={() => setMobileToolsOpen(false)}
        >
          {showHelpTab || tabGroups.length === 0 ? (
            <ToolGrid tutorTabs={tutorTabs} onSelectTool={tabGroups.length === 0 ? addTabToNewGroup : addToolFromHelpGrid} />
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
                  textbookId={textbookId}
                  selectedChapterId={selectedChapterId}
                  style={{ minHeight: "200px" }}
                />
              ))}
            </div>
          )}
        </StudyMobileDrawer>

        <StudyMobileDrawer
          isOpen={mobileChaptersOpen}
          title="Chapters"
          onClose={() => setMobileChaptersOpen(false)}
        >
          <ChapterSelector
            textbook={textbookData}
            onChapterSelect={handleChapterSelect}
            onSectionSelect={handleSectionSelect}
          />
        </StudyMobileDrawer>

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
