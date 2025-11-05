"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload } from "lucide-react"

// PDF.js types
interface PDFDocumentProxy {
  numPages: number
  getPage(pageNumber: number): Promise<PDFPageProxy>
}

interface PDFPageProxy {
  getViewport(params: { scale: number; rotation?: number }): PDFPageViewport
  render(params: { canvasContext: CanvasRenderingContext2D; viewport: PDFPageViewport }): PDFRenderTask
  getTextContent(): Promise<TextContent>
}

interface PDFPageViewport {
  width: number
  height: number
  transform: number[]
}

interface PDFRenderTask {
  promise: Promise<void>
}

interface TextContent {
  items: TextItem[]
}

interface TextItem {
  str: string
  dir: string
  width: number
  height: number
  transform: number[]
  fontName: string
}

// Global PDF.js object
declare global {
  interface Window {
    pdfjsLib: any
  }
}

interface PDFViewerProps {
  textbookId?: string
  selectedChapterId?: string // Added selectedChapterId prop for dynamic chapter loading
  targetPage?: number // Add targetPage prop for navigation
  onPageChange?: (currentPage: number, totalPages: number) => void
  onChapterLoad?: (chapterTitle: string, totalPages: number) => void
  onProgressChange?: (progress: number) => void
}

export function PDFViewer({
  textbookId,
  selectedChapterId,
  targetPage, // Accept targetPage prop
  onPageChange,
  onChapterLoad,
  onProgressChange,
}: PDFViewerProps = {}) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState("")
  const [selectedText, setSelectedText] = useState("")
  const [showActions, setShowActions] = useState(false)
  const [actionPosition, setActionPosition] = useState({ x: 0, y: 0 })
  const [currentChapterId, setCurrentChapterId] = useState<number | null>(null)
  const [pdfJsLoaded, setPdfJsLoaded] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const pagesContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingServerUpdateRef = useRef<{ percent: number; page: number } | null>(null)
  const lastSentRef = useRef<{ percent: number; page: number } | null>(null)
  const suppressTrackingRef = useRef<boolean>(false)
  const selectedChapterIdRef = useRef<string | undefined>(undefined)
  const resumeAtMsRef = useRef<number>(0)
  const firstTrackDoneRef = useRef<boolean>(false)

  const sendProgressToServer = (percent: number, page: number, chapter: number) => {
    try {
      if (!textbookId || !currentChapterId) return
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null
      if (!token) return
      // Avoid duplicate sends for same payload
      const last = lastSentRef.current
      if (last && last.percent === percent && last.page === page) return

      fetch(`/api/user/progress/${encodeURIComponent(textbookId)}/chapter/${encodeURIComponent(String(currentChapterId))}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ percent, page, chapter }),
        },
      ).catch(() => {})
      lastSentRef.current = { percent, page }
    } catch {
      // noop
    }
  }

  const flushProgressUpdate = () => {
    const pending = pendingServerUpdateRef.current
    if (pending) {
      sendProgressToServer(pending.percent, pending.page, Number(currentChapterId))
      pendingServerUpdateRef.current = null
    }
  }

  const scheduleDebouncedProgressUpdate = (percent: number, page: number) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      pendingServerUpdateRef.current = { percent, page }
      flushProgressUpdate()
    }, 1000)
  }

  useEffect(() => {
    const loadPDFJS = async () => {
      if (typeof window !== "undefined" && !window.pdfjsLib) {
        const cssLink = document.createElement("link")
        cssLink.rel = "stylesheet"
        cssLink.href = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf_viewer.css"
        document.head.appendChild(cssLink)

        const script = document.createElement("script")
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
        script.onload = () => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
          console.log("[v0] PDF.js loaded successfully")
          setPdfJsLoaded(true)
        }
        script.onerror = () => {
          console.error("[v0] Failed to load PDF.js")
          setError("Failed to load PDF.js library. Please refresh the page.")
        }
        document.head.appendChild(script)
      } else if (window.pdfjsLib) {
        setPdfJsLoaded(true)
      }
    }
    loadPDFJS()
  }, [])

  useEffect(() => {
    if (textbookId && selectedChapterId && pdfJsLoaded) {
      // Reset per-chapter state to avoid carryover
      setCurrentPage(1)
      lastSentRef.current = null
      pendingServerUpdateRef.current = null
      suppressTrackingRef.current = true
      selectedChapterIdRef.current = selectedChapterId
      firstTrackDoneRef.current = false
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      // Ensure we start at top for the new chapter before rendering
      try {
        scrollContainerRef.current?.scrollTo({ top: 0 })
      } catch {}
      loadChapterPDF(textbookId, selectedChapterId)
    }
  }, [textbookId, selectedChapterId, pdfJsLoaded])

  useEffect(() => {
    if (!currentChapterId || !textbookId) return

    const container = scrollContainerRef.current
    if (!container) return

    let ticking = false

    const updateProgress = () => {
      ticking = false
      if (suppressTrackingRef.current) {
        return
      }
      if (typeof performance !== "undefined" && performance.now() < (resumeAtMsRef.current || 0)) {
        return
      }
      const maxScrollable = container.scrollHeight - container.clientHeight
      if (maxScrollable <= 0) return
      const rawPercent = (container.scrollTop / maxScrollable) * 100
      const clampedPercent = Math.max(0, Math.min(100, Math.round(rawPercent)))
      // write function here that calculates better clampedPercent based on quizzes and stuff

      const newCurrentPage = Math.min(
        Math.max(1, Math.ceil((container.scrollTop / maxScrollable) * totalPages)),
        totalPages,
      )

      if (newCurrentPage !== currentPage) {
        setCurrentPage(newCurrentPage)
        onPageChange?.(newCurrentPage, totalPages)
      }

      onProgressChange?.(clampedPercent)

      // Only track when the PDF viewer is truly on the selected chapter and user has scrolled or percent > 0
      if (!currentChapterId || String(currentChapterId) !== selectedChapterIdRef.current) {
        return
      }
      const nearTop = container.scrollTop <= 1
      if (!firstTrackDoneRef.current && nearTop && clampedPercent === 0) {
        // Ignore the very first 0% update at load to avoid churn
        firstTrackDoneRef.current = true
        return
      }
      firstTrackDoneRef.current = true

      // Schedule debounced server sync (Kindle-like)
      scheduleDebouncedProgressUpdate(clampedPercent, newCurrentPage)

      try {
        const key = "readingProgress"
        const existing = typeof window !== "undefined" ? window.localStorage.getItem(key) : null
        const parsed: Record<string, Record<string, number>> = existing ? JSON.parse(existing) : {}
        const byTextbook = parsed[textbookId] || {}
        const currentStored = Number(byTextbook[String(currentChapterId)] || 0)
        const next = Math.max(currentStored, clampedPercent)
        if (next !== currentStored) {
          byTextbook[String(currentChapterId)] = next
          parsed[textbookId] = byTextbook
          window.localStorage.setItem(key, JSON.stringify(parsed))
          window.dispatchEvent(
            new CustomEvent("reading-progress", {
              detail: { textbookId, chapterId: String(currentChapterId), percent: next },
            }),
          )
        }
      } catch {
        // ignore localStorage errors
      }
    }

    const onScroll = () => {
      if (!ticking) {
        ticking = true
        window.requestAnimationFrame(updateProgress)
      }
    }

    container.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", updateProgress)
    const onVisibility = () => {
      if (document.hidden) {
        flushProgressUpdate()
      }
    }
    const onBeforeUnload = () => {
      flushProgressUpdate()
    }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("beforeunload", onBeforeUnload)
    updateProgress()

    return () => {
      container.removeEventListener("scroll", onScroll as EventListener)
      window.removeEventListener("resize", updateProgress)
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("beforeunload", onBeforeUnload)
      flushProgressUpdate()
    }
  }, [textbookId, currentChapterId, pdfDoc, currentPage, totalPages, onPageChange, onProgressChange])

  const scrollToPage = (pageNumber: number) => {
    if (!pagesContainerRef.current || !totalPages || pageNumber < 1 || pageNumber > totalPages) {
      return
    }

    const container = scrollContainerRef.current
    if (!container) return

    // Calculate scroll position based on page number
    const pageHeight = container.scrollHeight / totalPages
    const targetScrollTop = (pageNumber - 1) * pageHeight

    container.scrollTo({
      top: targetScrollTop,
      behavior: "smooth",
    })

    setCurrentPage(pageNumber)
    onPageChange?.(pageNumber, totalPages)
  }

  // Disable auto-jump to targetPage for now to avoid jumping before pages finish rendering

  const handleTextSelection = (e: React.MouseEvent<HTMLDivElement>) => {
    const selection = window.getSelection()
    if (selection && selection.toString().trim()) {
      const text = selection.toString().trim()
      setSelectedText(text)

      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()

      setActionPosition({
        x: rect.left + rect.width / 2,
        y: rect.bottom + 10,
      })
      setShowActions(true)
    }
  }

  const handleDocumentClick = (e: MouseEvent) => {
    if (!(e.target as Element).closest(".action-popup")) {
      setShowActions(false)
    }
  }

  useEffect(() => {
    document.addEventListener("click", handleDocumentClick)
    return () => document.removeEventListener("click", handleDocumentClick)
  }, [])

  const handleAsk = () => {
    console.log("Ask about:", selectedText)
    setShowActions(false)
  }

  const handleAddToNotes = () => {
    console.log("Add to notes:", selectedText)
    setShowActions(false)
  }

  const handleHighlight = () => {
    console.log("Highlight:", selectedText)
    setShowActions(false)
  }

  const loadPDF = async (url: string) => {
    if (!pdfJsLoaded || !window.pdfjsLib) {
      setError("PDF.js library is still loading. Please wait a moment and try again.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const loadingTask = window.pdfjsLib.getDocument(url)
      const pdf = await loadingTask.promise
      setPdfDoc(pdf)
      setTotalPages(pdf.numPages)
      console.log("[v0] PDF loaded successfully:", pdf.numPages, "pages")
    } catch (err) {
      console.error("[v0] Error loading PDF:", err)
      setError("Failed to load PDF. Please check the URL and try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === "application/pdf") {
      const fileUrl = URL.createObjectURL(file)
      loadPDF(fileUrl)
    } else {
      setError("Please select a valid PDF file.")
    }
  }

  const renderAllPages = async () => {
    if (!pdfDoc || !pagesContainerRef.current) return

    const container = pagesContainerRef.current
    container.innerHTML = ""

    try {
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum)
        const viewport = page.getViewport({ scale: 1.5 })

        const pageContainer = document.createElement("div")
        pageContainer.className = "relative mb-4"
        pageContainer.style.display = "inline-block"

        pageContainer.addEventListener("mouseup", (e) => {
          handleTextSelection(e as any)
        })

        const canvas = document.createElement("canvas")
        const context = canvas.getContext("2d")!

        const devicePixelRatio = window.devicePixelRatio || 1
        canvas.width = viewport.width * devicePixelRatio
        canvas.height = viewport.height * devicePixelRatio
        canvas.style.width = "100%"   // allow flex shrink
        canvas.style.height = "auto"  // maintain aspect
        canvas.className = "block border"

        context.scale(devicePixelRatio, devicePixelRatio)

        const textLayerDiv = document.createElement("div")
        textLayerDiv.className = "textLayer"
        textLayerDiv.style.setProperty("--scale-factor", "1.5")
        textLayerDiv.style.width = `${viewport.width}px`
        textLayerDiv.style.height = `${viewport.height}px`
        textLayerDiv.style.position = "absolute"
        textLayerDiv.style.left = "0"
        textLayerDiv.style.top = "0"
        textLayerDiv.style.overflow = "hidden"
        textLayerDiv.style.lineHeight = "1.0"
        textLayerDiv.style.pointerEvents = "auto"
        textLayerDiv.style.color = "transparent"
        textLayerDiv.style.userSelect = "text"

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        }

        await page.render(renderContext).promise

        const textContent = await page.getTextContent()

        if (window.pdfjsLib.renderTextLayer) {
          try {
            window.pdfjsLib.renderTextLayer({
              textContentSource: textContent,
              container: textLayerDiv,
              viewport,
              textDivs: [],
            })
          } catch (textLayerError) {
            console.error("[v0] Error with renderTextLayer for page", pageNum, textLayerError)
            renderTextLayerManually(textContent, textLayerDiv, viewport)
          }
        } else {
          renderTextLayerManually(textContent, textLayerDiv, viewport)
        }

        pageContainer.appendChild(canvas)
        pageContainer.appendChild(textLayerDiv)

        const pageLabel = document.createElement("div")
        pageLabel.textContent = `Page ${pageNum}`
        pageLabel.className = "text-sm text-muted-foreground text-center mt-2"
        pageContainer.appendChild(pageLabel)

        container.appendChild(pageContainer)
      }

      console.log("[v0] All pages rendered successfully")
    } catch (err) {
      console.error("[v0] Error rendering pages:", err)
      setError("Failed to render pages.")
    }
  }

  const renderTextLayerManually = (textContent: TextContent, container: HTMLDivElement, viewport: PDFPageViewport) => {
    console.log("[v0] Using manual text layer rendering")

    container.style.transform = ""
    container.style.transformOrigin = ""

    textContent.items.forEach((item: TextItem) => {
      const textDiv = document.createElement("div")
      textDiv.textContent = item.str
      textDiv.style.position = "absolute"
      textDiv.style.whiteSpace = "pre"
      textDiv.style.color = "transparent"
      textDiv.style.userSelect = "text"
      textDiv.style.cursor = "text"
      textDiv.style.pointerEvents = "auto"
      textDiv.style.background = "transparent"

      const tx = item.transform[4]
      const ty = item.transform[5]
      const scaleY = Math.abs(item.transform[3])

      textDiv.style.left = `${tx}px`
      textDiv.style.top = `${viewport.height - ty - scaleY}px`
      textDiv.style.fontSize = `${scaleY}px`
      textDiv.style.fontFamily = "sans-serif"
      textDiv.style.transformOrigin = "left bottom"

      container.appendChild(textDiv)
    })
  }

  useEffect(() => {
    if (pdfDoc) {
      ;(async () => {
        await renderAllPages()
        // Re-enable tracking once pages are laid out
        suppressTrackingRef.current = false
        // Delay accepting updates slightly to avoid stale geometry
        if (typeof performance !== "undefined") {
          resumeAtMsRef.current = performance.now() + 500
        } else {
          resumeAtMsRef.current = Date.now() + 500
        }
        // Trigger an initial update at top (will compute ~0%)
        try {
          scrollContainerRef.current?.scrollTo({ top: 0 })
        } catch {}
        // Let the scroll/resize listener compute next frame
        requestAnimationFrame(() => {
          try {
            const evt = new Event("resize")
            window.dispatchEvent(evt)
          } catch {}
        })
      })()
    }
  }, [pdfDoc])

  const loadChapterPDF = async (textbookId: string, chapterId: string) => {
    try {
      setLoading(true)
      setError(null)

      const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL

      const response = await fetch(`${backendUrl}/api/v1/textbooks/${encodeURIComponent(textbookId)}/chapters/${encodeURIComponent(chapterId)}/pdf`)

      if (!response.ok) {
        throw new Error(`Failed to get chapter PDF: ${response.status}`)
      }

      const data = await response.json()
      const pdfUrl = data.pdf_url

      setCurrentChapterId(Number.parseInt(chapterId))

      await loadPDF(pdfUrl)

      onChapterLoad?.(data.chapter_title, totalPages)

      console.log("[v0] Loaded chapter PDF:", data.chapter_title)
    } catch (err) {
      console.error("[v0] Error loading chapter PDF:", err)
      setError(`Failed to load chapter ${chapterId}. Please try again.`)
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 h-full flex flex-col">
      {!textbookId && (
        <Card>
          <CardHeader>
            <CardTitle>PDF Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="Enter PDF URL..."
                value={pdfUrl}
                onChange={(e) => setPdfUrl(e.target.value)}
                className="flex-1"
              />
              <Button onClick={() => loadPDF(pdfUrl)} disabled={loading || !pdfUrl || !pdfJsLoaded}>
                Load PDF
              </Button>
            </div>

            <div className="flex gap-2">
              <Input type="file" accept=".pdf" onChange={handleFileUpload} ref={fileInputRef} className="flex-1" />
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" disabled={!pdfJsLoaded}>
                <Upload className="w-4 h-4 mr-2" />
                Upload PDF
              </Button>
            </div>

            {pdfDoc && (
              <div className="text-center">
                <span className="text-sm text-muted-foreground">Total pages: {totalPages}</span>
              </div>
            )}

            {!pdfJsLoaded && (
              <div className="text-center">
                <span className="text-sm text-muted-foreground">Loading PDF.js library...</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {textbookId && !pdfJsLoaded && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center">Loading PDF.js library...</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center">Loading PDF...</p>
          </CardContent>
        </Card>
      )}

      {pdfDoc && (
        <>
          {textbookId ? (
            <div
              ref={scrollContainerRef}
              className="overflow-auto h-full border bg-white p-4 relative"
              style={{ userSelect: "text", cursor: "text" }}
            >
              <div ref={pagesContainerRef} className="space-y-4" />
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div ref={scrollContainerRef} className="overflow-auto max-h-[80vh] border rounded-lg">
                  <div ref={pagesContainerRef} className="p-4 space-y-4" />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {showActions && (
        <div
          className="action-popup fixed z-50 bg-[#2d2d30] border border-[#3e3e42] rounded-lg shadow-lg p-2 flex gap-2"
          style={{
            left: `${actionPosition.x}px`,
            top: `${actionPosition.y}px`,
            transform: "translateX(-50%)",
          }}
        >
          <button
            onClick={handleAsk}
            className="px-3 py-1 text-xs bg-[#007acc] text-white rounded hover:bg-[#005a9e] transition-colors"
          >
            Ask
          </button>
          <button
            onClick={handleAddToNotes}
            className="px-3 py-1 text-xs bg-[#4ec9b0] text-white rounded hover:bg-[#3a9b85] transition-colors"
          >
            Add to Notes
          </button>
          <button
            onClick={handleHighlight}
            className="px-3 py-1 text-xs bg-[#dcdcaa] text-black rounded hover:bg-[#c7c78a] transition-colors"
          >
            Highlight
          </button>
        </div>
      )}
    </div>
  )
}