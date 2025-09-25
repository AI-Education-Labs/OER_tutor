"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
import { Send, User, Bot, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import type { Message, ChatContext } from "@/types/chat"
import { text } from "stream/consumers"

interface AiChatPanelProps {
  context?: ChatContext
  textbookId?: string
  selectedChapterId?: string
}

// ---------------- Markdown formatting ----------------
const formatMarkdown = (text: string): React.ReactNode => {
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match

  const formatInlineMarkdown = (t: string) => {
    let text = t
    text = text.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white mt-4 mb-2">$1</h3>')
    text = text.replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold text-white mt-4 mb-2">$1</h2>')
    text = text.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-white mt-4 mb-3">$1</h1>')
    text = text.replace(/`([^`]+)`/g, '<code class="bg-[#3e3e42] px-1 py-0.5 rounded text-sm text-[#d4d4d4]">$1</code>')
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
    text = text.replace(/\*(.*?)\*/g, '<em class="italic text-[#cccccc]">$1</em>')
    text = text.replace(/\n/g, "<br />")
    return <div dangerouslySetInnerHTML={{ __html: text }} />
  }

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(formatInlineMarkdown(text.slice(lastIndex, match.index)))
    const language = match[1] || "text"
    const code = match[2].trim()
    parts.push(
      <div key={match.index} className="my-2">
        <div className="bg-[#1e1e1e] border border-[#3e3e42] rounded-md overflow-hidden">
          <div className="bg-[#2d2d30] px-3 py-1 text-xs text-[#969696] border-b border-[#3e3e42]">{language}</div>
          <pre className="p-3 text-sm text-[#d4d4d4] overflow-x-auto">
            <code>{code}</code>
          </pre>
        </div>
      </div>
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) parts.push(formatInlineMarkdown(text.slice(lastIndex)))
  return parts.length > 1 ? <>{parts}</> : parts[0] || text
}

// ---------------- Session storage ----------------
const CHAT_STORAGE_KEY = "ai-chat-messages"
const MESSAGE_COUNT_KEY = "ai-chat-message-count"

const saveChatToSession = (messages: Message[], messageCount: number) => {
  try {
    const serialized = messages.map(m => ({ ...m, timestamp: m.timestamp.toISOString() }))
    sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(serialized))
    sessionStorage.setItem(MESSAGE_COUNT_KEY, messageCount.toString())
  } catch {}
}

const loadChatFromSession = (): { messages: Message[]; messageCount: number } => {
  try {
    const raw = sessionStorage.getItem(CHAT_STORAGE_KEY)
    const count = sessionStorage.getItem(MESSAGE_COUNT_KEY)
    if (!raw) return { messages: [], messageCount: 0 }
    const messages = JSON.parse(raw).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
    const messageCount = count ? parseInt(count) : 0
    return { messages, messageCount }
  } catch {
    return { messages: [], messageCount: 0 }
  }
}

const clearChatSession = () => {
  sessionStorage.removeItem(CHAT_STORAGE_KEY)
  sessionStorage.removeItem(MESSAGE_COUNT_KEY)
}

// ---------------- MessageCard ----------------
const MessageCard = React.memo(({ message }: { message: Message }) => {
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
                <div className="w-2 h-2 bg-[#007acc] rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                <div className="w-2 h-2 bg-[#007acc] rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
              </div>
              <span className="text-sm">AI is thinking...</span>
            </div>
          ) : (
            <div className="text-sm">{formatMarkdown(message.content)}</div>
          )}
          <div className="text-xs opacity-70 mt-2">
            {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
})

// ---------------- Main Component ----------------
export function AiChatPanel({ context, textbookId, selectedChapterId }: AiChatPanelProps) {
  console.log("current textbookId:", textbookId)
  console.log("current selectedChapterId:", selectedChapterId)
  const initial = loadChatFromSession()
  const [messages, setMessages] = useState<Message[]>(initial.messages)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [messageCount, setMessageCount] = useState<number>(initial.messageCount)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  const MAX_MESSAGES_GUEST = 100

  // Scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Save chat whenever messages or count changes
  useEffect(() => saveChatToSession(messages, messageCount), [messages, messageCount])

  // Detect login
  useEffect(() => {
    const token = localStorage.getItem("access_token")
    setIsLoggedIn(!!token)
  }, [])

  const fetchGreeting = async () => {
    setIsLoading(true)
    const loading: Message = { id: "loading-greeting", content: "", role: "assistant", timestamp: new Date() }
    setMessages([loading])

    try {
      const token = localStorage.getItem("access_token")
      const res = await fetch("/api/greeting", { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
      const data = await res.json()
      const welcome: Message = { id: "welcome", content: data.response || "Hello!", role: "assistant", timestamp: new Date() }
      setMessages([welcome])
    } catch {
      const fallback: Message = {
        id: "welcome",
        content: `Hello! I'm your AI assistant.`,
        role: "assistant",
        timestamp: new Date(),
      }
      setMessages([fallback])
    } finally {
      setIsLoading(false)
    }
  }

  // Clear chat
  const clearChat = () => {
    setMessages([])
    setMessageCount(0)
    clearChatSession()
    fetchGreeting()
  }

  // ---------------- Input Handlers ----------------
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!input.trim() || isLoading) return
    if (!isLoggedIn && messageCount >= MAX_MESSAGES_GUEST) return

    const userMessage: Message = { id: Date.now().toString(), content: input, role: "user", timestamp: new Date() }
    const tempMessage: Message = { id: `temp-${Date.now()}`, content: "", role: "assistant", timestamp: new Date() }

    setMessages(prev => [...prev, userMessage, tempMessage])
    setMessageCount(prev => prev + 1)
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

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const data = JSON.parse(line.slice(6))
          if (!sessionIdRef.current && data.session_id) sessionIdRef.current = data.session_id
          if (data.text) {
            chunks.push(data.text)
            const current = chunks.join("")
            setMessages(prev => prev.map(m => (m.id === tempMessage.id ? { ...m, content: current } : m)))
          }
          if (data.error) {
            setMessages(prev => prev.map(m => (m.id === tempMessage.id ? { ...m, content: `⚠️ ${data.error}` } : m)))
            controller.abort()
          }
        }
      }

      if (chunks.length === 0)
        setMessages(prev =>
          prev.map(m => (m.id === tempMessage.id ? { ...m, content: "I couldn’t generate a response. Try again." } : m))
        )
    } catch (err) {
      setMessages(prev =>
        prev.map(m =>
          m.id === tempMessage.id
            ? { ...m, content: err instanceof Error ? `⚠️ ${err.message}` : "Streaming error occurred." }
            : m
        )
      )
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const canSend = isLoggedIn || messageCount < MAX_MESSAGES_GUEST

  // ---------------- Render ----------------
  const renderedMessages = useMemo(() => messages.map(m => <MessageCard key={m.id} message={m} />), [messages])

  return (
    <div className="h-full flex flex-col bg-[#252526]">
      {/* Clear chat */}
      <div className="flex justify-end p-2 border-b border-[#3e3e42]">
        <Button onClick={clearChat} size="sm" variant="ghost" className="text-[#969696] hover:text-white" disabled={isLoading}>
          Clear
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 space-y-4 show-scrollbar">{renderedMessages}<div ref={messagesEndRef} /></div>

      {/* Message limit */}
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
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={canSend ? "Ask me anything..." : "Sign in to continue chatting"}
            className="flex-1 bg-[#3e3e42] border-[#3e3e42] text-[#cccccc] placeholder-[#969696] focus:border-[#007acc] focus:ring-[#007acc] min-h-[40px] max-h-[120px] resize-none overflow-auto"
            disabled={!canSend || isLoading}
            rows={1}
          />
          <Button type="submit" size="sm" className="bg-[#007acc] hover:bg-[#005a9e] text-white" disabled={!input.trim() || !canSend || isLoading}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
        {canSend && <div className="text-xs text-[#969696] mt-2">Press Enter to send, Shift+Enter for new line</div>}
      </div>
    </div>
  )
}
