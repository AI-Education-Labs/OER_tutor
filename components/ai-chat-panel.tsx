"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
import { Send, User, Bot, AlertCircle, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import type { Message, ChatContext, BranchCandidate, ChatSession } from "@/types/chat"
import { formatMarkdown } from "@/utils/markdown"

interface AiChatPanelProps {
  context?: ChatContext
  textbookId?: string
  selectedChapterId?: string
}

type StreamTextData = {
  text: string
  session_id: string
}

type StreamBranchData = {
  start_new_chat: boolean
  new_session_id: string
  suggested_title: string
}

type StreamDoneData = {
  done: boolean
  session_id: string
}

type StreamErrorData = {
  error: string
}

type StreamData = StreamTextData | StreamBranchData | StreamDoneData | StreamErrorData

// Helper type guards
const isStreamTextData = (data: StreamData): data is StreamTextData => "text" in data
const isStreamBranchData = (data: StreamData): data is StreamBranchData => "start_new_chat" in data
const isStreamDoneData = (data: StreamData): data is StreamDoneData => "done" in data
const isStreamErrorData = (data: StreamData): data is StreamErrorData => "error" in data

// ---------------- Session storage ----------------
const CHAT_STORAGE_KEY = "ai-chat-messages"
const MESSAGE_COUNT_KEY = "ai-chat-message-count"

const saveChatToSession = (messages: Message[], messageCount: number) => {
  try {
    const serialized = messages.map((m) => ({ ...m, timestamp: m.timestamp.toISOString() }))
    sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(serialized))
    sessionStorage.setItem(MESSAGE_COUNT_KEY, messageCount.toString())
  } catch {}
}

const loadChatFromSession = (): { messages: Message[]; messageCount: number } => {
  try {
    const raw = sessionStorage.getItem(CHAT_STORAGE_KEY)
    const count = sessionStorage.getItem(MESSAGE_COUNT_KEY)
    if (!raw) return { messages: [], messageCount: 0 }
    const messages = JSON.parse(raw).map((m: { content: string; role: string; timestamp: string; id: string }) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }))
    const messageCount = count ? Number.parseInt(count) : 0
    return { messages, messageCount }
  } catch {
    return { messages: [], messageCount: 0 }
  }
}

const removeChatSession = () => {
  sessionStorage.removeItem(CHAT_STORAGE_KEY)
  sessionStorage.removeItem(MESSAGE_COUNT_KEY)
  sessionStorage.removeItem("current_session_id")
}

// ---------------- MessageCard ----------------
const MessageCard = React.memo(
  ({
    message,
    branchCandidate,
    onBranch,
  }: {
    message: Message
    branchCandidate?: BranchCandidate
    onBranch?: (payload: BranchCandidate) => void
  }) => {
    return (
      <div className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
        {message.role === "assistant" && (
          <div className="w-8 h-8 bg-[#007acc] rounded-full flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
        )}
        <Card
          className={`max-w-[80%] ${
            message.role === "user"
              ? "bg-[#007acc] border-[#007acc] text-white"
              : "bg-[#3e3e42] border-[#3e3e42] text-[#cccccc]"
          }`}
        >
          <CardContent className="p-3">
            {message.content === "" && message.id.startsWith("temp-") ? (
              <div className="flex items-center gap-2 text-[#cccccc]">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-[#007acc] rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-[#007acc] rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-[#007acc] rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
                <span className="text-sm">AI is thinking...</span>
              </div>
            ) : (
              <div className="text-sm">{formatMarkdown(message.content)}</div>
            )}
            <div className="flex items-center justify-between mt-2">
              <div className="text-xs opacity-70">
                {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              {message.role === "assistant" && branchCandidate && (
                <button
                  className="text-xs text-yellow-400 underline hover:text-yellow-300 transition-colors"
                  title={`Start new chat: ${branchCandidate.suggested_title}`}
                  onClick={() => onBranch?.(branchCandidate)}
                >
                  branch
                </button>
              )}
            </div>
          </CardContent>
        </Card>
        {message.role === "user" && (
          <div className="w-8 h-8 bg-[#4ec9b0] rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
    )
  },
)

// ---------------- Main Component ----------------
export function AiChatPanel({ context, textbookId, selectedChapterId }: AiChatPanelProps) {
  const initial = loadChatFromSession()
  const [messages, setMessages] = useState<Message[]>(initial.messages)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [messageCount, setMessageCount] = useState<number>(initial.messageCount)
  const [branchCandidates, setBranchCandidates] = useState<Record<string, BranchCandidate>>({})
  const [chats, setChats] = useState<ChatSession[]>([])
  const [showSidebar, setShowSidebar] = useState(false)
  const [currentChatTitle, setCurrentChatTitle] = useState<string>("Current Chat")
  const [hoveredChat, setHoveredChat] = useState<string | null>(null)
  const [showSummary, setShowSummary] = useState<string | null>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  const MAX_MESSAGES_GUEST = 100
  const MESSAGE_TILL_TITLE_UPDATE = 2
  const [messageSinceTitleUpdate, setMessageSinceTitleUpdate] = useState(0);

  // Scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Save chat
  useEffect(() => saveChatToSession(messages, messageCount), [messages, messageCount])

  // Detect login
  useEffect(() => {
    const token = localStorage.getItem("access_token")
    setIsLoggedIn(!!token)
  }, [])

  // Load all chats for sidebar
  const fetchChats = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"
      const token = localStorage.getItem("access_token")
      const res = await fetch(`${backendUrl}/chat/history`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      const data = await res.json()
      setChats(data.chats || [])
    } catch (e) {
      console.error("Failed to load chats", e)
    }
  }

  const loadChat = async (sessionId: string, title: string) => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"
      const token = localStorage.getItem("access_token")
      const res = await fetch(`${backendUrl}/chat/history?session_id=${sessionId}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      const data = await res.json()

      // Backend now returns: { session_id, title, summary, messages }
      const messages = data.messages || []
      const loadedMessages: Message[] = messages.map(
        (msg: { content: string; role: string; timestamp: string }, index: number) => ({
          id: `${sessionId}-${index}`,
          content: msg.content,
          role: msg.role,
          timestamp: new Date(msg.timestamp),
        }),
      )

      if (data.summary && data.summary.trim()) {
        const summaryMessage: Message = {
          id: `${sessionId}-summary`,
          content: `**Conversation Summary:**\n\n${data.summary}`,
          role: "assistant",
          timestamp: new Date(),
        }
        loadedMessages.push(summaryMessage)
      }

      setMessages(loadedMessages)
      setCurrentChatTitle(data.title || title)
      sessionIdRef.current = sessionId
      setBranchCandidates({})
      setShowSidebar(false)

      // Clear session storage since we're loading from server
      removeChatSession()
    } catch (e) {
      console.error("Failed to load chat", e)
    }
  }

  const handleChatHover = (sessionId: string, summary: string) => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }

    setHoveredChat(sessionId)

    // Only show summary if it exists
    if (summary && summary.trim()) {
      hoverTimeoutRef.current = setTimeout(() => {
        setShowSummary(sessionId)
      }, 1000)
    }
  }

  const handleChatLeave = () => {
    // Clear timeout but don't immediately hide - let tooltip handle its own mouse events
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
  }

  const handleTooltipEnter = () => {
    // Keep tooltip visible when hovering over it
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
  }

  const handleTooltipLeave = () => {
    // Hide tooltip when leaving it
    setHoveredChat(null)
    setShowSummary(null)
  }

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  const clearChat = () => {
    setMessages([])
    setMessageCount(0)
    setBranchCandidates({})
    setCurrentChatTitle("New Chat")
    sessionIdRef.current = null
    removeChatSession()
  }

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!input.trim() || isLoading) return
    if (!isLoggedIn && messageCount >= MAX_MESSAGES_GUEST) return

    const userMessage: Message = { id: Date.now().toString(), content: input, role: "user", timestamp: new Date() }
    const tempMessage: Message = { id: `temp-${Date.now()}`, content: "", role: "assistant", timestamp: new Date() }

    setMessages((prev) => [...prev, userMessage, tempMessage])
    setMessageCount((prev) => prev + 1)
    setInput("")
    setIsLoading(true)

    try {
      const token = localStorage.getItem("access_token")
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"
      const body: any = { message: userMessage.content, textbook_id: textbookId, chapter_id: selectedChapterId }
      if (sessionIdRef.current) body.session_id = sessionIdRef.current

      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

      const streamRes = await fetch(`${backendUrl}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!streamRes.body) throw new Error("No response body")

      const reader = streamRes.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      const chunks: string[] = []
      const rawDataReceived: string[] = [] // Track all raw data received

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log("[v0] 🔚 Stream ended. Total chunks received:", chunks.length)
          console.log("[v0] 🔚 All raw data received:", rawDataReceived) // Log all raw data
          console.log("[v0] 🔚 Final branch candidates state:", branchCandidates)
          break
        }

        const rawChunk = decoder.decode(value, { stream: true })
        rawDataReceived.push(rawChunk) // Store raw chunk
        console.log("[v0] 🔍 Raw chunk received:", JSON.stringify(rawChunk)) // Log raw chunk with escaping

        buffer += rawChunk
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          console.log("[v0] 📥 Processing line:", JSON.stringify(line)) // Log with escaping

          if (line.includes("start_new_chat")) {
            console.log("[v0] 🌟 FOUND LINE WITH start_new_chat:", JSON.stringify(line))

            // Try to parse as direct JSON
            try {
              const directData = JSON.parse(line)
              console.log("[v0] 🌟 Direct JSON parse successful:", directData)
              if (directData.start_new_chat) {
                console.log("[v0] 🌟 BRANCH SIGNAL IN DIRECT JSON!")
              }
            } catch (e) {
              console.log("[v0] ⚠️ Direct JSON parse failed:", e)
            }
          }

          if (!line.startsWith("data: ")) {
            console.log("[v0] ⚠️ Skipping non-data line:", JSON.stringify(line))
            continue
          }

          const jsonStr = line.slice(6).trim()
          if (!jsonStr) {
            console.log("[v0] ⚠️ Empty JSON string after 'data: '")
            continue
          }

          console.log("[v0] 🔍 Raw JSON string:", jsonStr)
          let data: StreamData
          try {
            data = JSON.parse(jsonStr) as StreamData
            console.log("[v0] ✅ Parsed stream data:", data)
            console.log("[v0] 🔍 Data keys:", Object.keys(data))

            if (isStreamTextData(data)) {
              if (!sessionIdRef.current && data.session_id) {
                sessionIdRef.current = data.session_id
                console.log("[v0] 🆔 Set session ID:", data.session_id)
              }
              chunks.push(data.text)
              const current = chunks.join("")
              setMessages((prev) => prev.map((m) => (m.id === tempMessage.id ? { ...m, content: current } : m)))
            }

            if (isStreamBranchData(data)) {
              console.log("[v0] 🌟 BRANCH SIGNAL DETECTED! Full data object:", JSON.stringify(data, null, 2))

              const branchData = {
                new_session_id: data.new_session_id,
                suggested_title: data.suggested_title || "New Chat",
              }

              console.log("[v0] 🌿 Creating branch candidate:", branchData)
              setBranchCandidates((prev) => {
                const updated = { ...prev, [tempMessage.id]: branchData }
                console.log("[v0] 🌿 Updated branch candidates:", updated)
                return updated
              })
            }

            if (isStreamDoneData(data)) {
              console.log("[v0] ✅ Stream marked as done")
            }

            if (isStreamErrorData(data)) {
              let error = data as StreamErrorData
              console.log("[v0] ❌ Error in stream:", data.error)
              setMessages((prev) =>
                prev.map((m) => (m.id === tempMessage.id ? { ...m, content: `⚠️ ${error}` } : m)),
              )
              controller.abort()
            }
          } catch (parseError) {
            console.error("[v0] 💥 Failed to parse stream data:", parseError, "Raw line:", line)
            console.error("[v0] 💥 JSON string that failed:", jsonStr)
          }
        }
      }

      if (chunks.length === 0) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempMessage.id ? { ...m, content: "I couldn't generate a response. Try again." } : m,
          ),
        )
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempMessage.id
            ? { ...m, content: err instanceof Error ? `⚠️ ${err.message}` : "Streaming error occurred." }
            : m,
        ),
      )
    } finally {
      updateChatTitle()
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const updateChatTitle = async () => {
    console.log("Attempting to update chat title...")
    console.log("Current messageSinceTitleUpdate:", messageSinceTitleUpdate)
    if (messageSinceTitleUpdate < MESSAGE_TILL_TITLE_UPDATE) {
      setMessageSinceTitleUpdate(prev => prev + 1)
      return
    }
    setMessageSinceTitleUpdate(0)
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"
      const token = localStorage.getItem("access_token")
      const sessionId = sessionIdRef.current
      const res = await fetch(`${backendUrl}/chat/history?session_id=${sessionId}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      const data = await res.json()
      if (data.title) {
        setCurrentChatTitle(data.title)
        //await fetchChats() // Refresh chat list to show updated title
      }
    } catch (e) {
      console.error("Failed to update chat title", e)
    }
  }

  const handleBranch = async (payload: BranchCandidate) => {
    console.log("[v0] Starting new branch:", payload)

    setMessages([])
    setMessageCount(0)
    setBranchCandidates({})
    setCurrentChatTitle(payload.suggested_title)
    sessionIdRef.current = payload.new_session_id

    // Clear session storage for clean start
    removeChatSession()

    // Update session storage with new session ID
    sessionStorage.setItem("current_session_id", payload.new_session_id)

    // Refresh chat list to show the new chat
    await fetchChats()
  }

  const canSend = isLoggedIn || messageCount < MAX_MESSAGES_GUEST

  const renderedMessages = useMemo(
    () =>
      messages.map((message) => (
        <MessageCard
          key={message.id}
          message={message}
          branchCandidate={branchCandidates[message.id]}
          onBranch={handleBranch}
        />
      )),
    [messages, branchCandidates],
  )

  return (
    <div className="h-full flex bg-[#252526]">
      {/* Sidebar */}
      {showSidebar && (
        <div className="w-64 bg-[#1e1e1e] border-r border-[#3e3e42] flex flex-col">
          <div className="p-3 border-b border-[#3e3e42]">
            <div className="font-bold text-white mb-2">Chats</div>
            <Button onClick={clearChat} size="sm" className="w-full bg-[#007acc] hover:bg-[#005a9e] text-white">
              New Chat
            </Button>
          </div>
          <div className="flex-1 overflow-auto relative">
            {chats.map((c) => (
              <div key={c.session_id} className="relative">
                <button
                  className={`block w-full text-left px-3 py-2 hover:bg-[#2d2d30] text-sm border-b border-[#3e3e42] transition-colors ${
                    sessionIdRef.current === c.session_id ? "bg-[#2d2d30] text-white" : "text-[#cccccc]"
                  }`}
                  onClick={() => loadChat(c.session_id, c.title || "Untitled Chat")}
                  onMouseEnter={() => handleChatHover(c.session_id, c.summary || "")}
                  onMouseLeave={handleChatLeave}
                >
                  <div className="font-medium">{c.title || "Untitled Chat"}</div>
                  <div className="text-xs text-[#969696] mt-1">{new Date(c.updated_at).toLocaleDateString()}</div>
                </button>

                {showSummary === c.session_id && c.summary && (
                  <div
                    className="absolute left-full top-0 ml-2 z-50 bg-[#1e1e1e] border border-[#3e3e42] rounded-md p-3 shadow-lg max-w-xs pointer-events-auto"
                    onMouseEnter={handleTooltipEnter}
                    onMouseLeave={handleTooltipLeave}
                  >
                    <div className="text-xs text-[#cccccc] font-medium mb-1">Summary:</div>
                    <div className="text-xs text-[#969696] leading-relaxed">{c.summary}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-2 border-b border-[#3e3e42]">
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setShowSidebar(!showSidebar)
                if (!showSidebar) fetchChats()
              }}
              size="sm"
              variant="ghost"
            >
              <Menu className="w-4 h-4 text-[#969696]" />
            </Button>
            <span className="text-sm text-[#cccccc] font-medium">{currentChatTitle}</span>
          </div>
          <Button
            onClick={clearChat}
            size="sm"
            variant="ghost"
            className="text-[#969696] hover:text-white"
            disabled={isLoading}
          >
            Clear
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-3 space-y-4 show-scrollbar">
          {renderedMessages}
          <div ref={messagesEndRef} className="h-0 w-0 opacity-0 pointer-events-none" />
        </div>

        {/* Message limit warning */}
        {!isLoggedIn && messageCount >= MAX_MESSAGES_GUEST && (
          <div className="p-3 bg-[#2d2d30] border-t border-[#3e3e42] flex items-center gap-2 text-[#ce9178] text-sm">
            <AlertCircle className="w-4 h-4" /> You've reached the message limit. Sign in for unlimited chat!
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t border-[#3e3e42] bg-[#2d2d30]">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder={canSend ? "Ask me anything..." : "Sign in to continue chatting"}
              className="flex-1 bg-[#3e3e42] border-[#3e3e42] text-[#cccccc] placeholder-[#969696] focus:border-[#007acc] focus:ring-[#007acc] min-h-[40px] max-h-[120px] resize-none overflow-auto"
              disabled={!canSend || isLoading}
              rows={1}
            />
            <Button
              type="submit"
              size="sm"
              className="bg-[#007acc] hover:bg-[#005a9e] text-white"
              disabled={!input.trim() || !canSend || isLoading}
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
          {canSend && <div className="text-xs text-[#969696] mt-2">Press Enter to send, Shift+Enter for new line</div>}
        </div>
      </div>
    </div>
  )
}
