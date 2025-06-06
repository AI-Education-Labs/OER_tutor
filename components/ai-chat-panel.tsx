"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Send, User, Bot, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import type { Message, ChatContext } from "@/types/chat"

interface AiChatPanelProps {
  context?: ChatContext
}

// Markdown formatting utility functions
const formatMarkdown = (text: string): React.ReactNode => {
  // Split text by code blocks first
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g
  const parts = []
  let lastIndex = 0
  let match

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      parts.push(formatInlineMarkdown(text.slice(lastIndex, match.index)))
    }

    // Add code block
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
      </div>,
    )

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(formatInlineMarkdown(text.slice(lastIndex)))
  }

  return parts.length > 1 ? <>{parts}</> : parts[0] || text
}

const formatInlineMarkdown = (text: string): React.ReactNode => {
  // Handle headers (must be done before other formatting)
  text = text.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-[#ffffff] mt-4 mb-2">$1</h3>')
  text = text.replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold text-[#ffffff] mt-4 mb-2">$1</h2>')
  text = text.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-[#ffffff] mt-4 mb-3">$1</h1>')

  // Handle inline code
  text = text.replace(/`([^`]+)`/g, '<code class="bg-[#3e3e42] px-1 py-0.5 rounded text-sm text-[#d4d4d4]">$1</code>')

  // Handle bold
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-[#ffffff]">$1</strong>')

  // Handle italic
  text = text.replace(/\*(.*?)\*/g, '<em class="italic text-[#cccccc]">$1</em>')

  // Handle links
  text = text.replace(
    /\[([^\]]+)\]$$([^)]+)$$/g,
    '<a href="$2" class="text-[#007acc] hover:underline" target="_blank" rel="noopener noreferrer">$1</a>',
  )

  // Handle line breaks
  text = text.replace(/\n/g, "<br />")

  // Handle lists
  text = text.replace(
    /^- (.+)$/gm,
    '<div class="flex items-start gap-2 my-1"><span class="text-[#007acc] mt-1">•</span><span>$1</span></div>',
  )
  text = text.replace(
    /^\d+\. (.+)$/gm,
    '<div class="flex items-start gap-2 my-1"><span class="text-[#007acc] mt-1 min-w-[1.5rem]">$&</span></div>',
  )

  return <div dangerouslySetInnerHTML={{ __html: text }} />
}

// Session storage utilities
const CHAT_STORAGE_KEY = "ai-chat-messages"
const MESSAGE_COUNT_KEY = "ai-chat-message-count"

const saveChatToSession = (messages: Message[], messageCount: number) => {
  try {
    // Convert dates to strings for storage
    const serializedMessages = messages.map((msg) => ({
      ...msg,
      timestamp: msg.timestamp.toISOString(),
    }))
    sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(serializedMessages))
    sessionStorage.setItem(MESSAGE_COUNT_KEY, messageCount.toString())
    console.log("💾 Saved chat to session storage:", { messageCount: messages.length, userMessageCount: messageCount })
  } catch (error) {
    console.warn("Failed to save chat to session storage:", error)
  }
}

const loadChatFromSession = (): { messages: Message[]; messageCount: number } => {
  try {
    const savedMessages = sessionStorage.getItem(CHAT_STORAGE_KEY)
    const savedCount = sessionStorage.getItem(MESSAGE_COUNT_KEY)

    if (savedMessages) {
      const parsedMessages = JSON.parse(savedMessages)
      // Convert timestamp strings back to Date objects
      const messages = parsedMessages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }))
      const messageCount = savedCount ? Number.parseInt(savedCount, 10) : 0
      console.log("📂 Loaded chat from session storage:", {
        messageCount: messages.length,
        userMessageCount: messageCount,
      })
      return { messages, messageCount }
    }
  } catch (error) {
    console.warn("Failed to load chat from session storage:", error)
  }

  console.log("📂 No saved chat found in session storage")
  return { messages: [], messageCount: 0 }
}

const clearChatSession = () => {
  try {
    sessionStorage.removeItem(CHAT_STORAGE_KEY)
    sessionStorage.removeItem(MESSAGE_COUNT_KEY)
    console.log("🗑️ Cleared chat session storage")
  } catch (error) {
    console.warn("Failed to clear chat session:", error)
  }
}

// Initialize state with session storage data immediately
const getInitialChatState = () => {
  if (typeof window !== "undefined") {
    const { messages, messageCount } = loadChatFromSession()
    return { messages, messageCount }
  }
  return { messages: [], messageCount: 0 }
}

export function AiChatPanel({ context }: AiChatPanelProps) {
  // Initialize state immediately with session storage data
  const initialState = getInitialChatState()
  const [messages, setMessages] = useState<Message[]>(initialState.messages)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [messageCount, setMessageCount] = useState(initialState.messageCount)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoadingGreeting, setIsLoadingGreeting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const MAX_MESSAGES_GUEST = 5

  // Save chat to session storage whenever messages or messageCount changes
  useEffect(() => {
    if (isInitialized && (messages.length > 0 || messageCount > 0)) {
      saveChatToSession(messages, messageCount)
    }
  }, [messages, messageCount, isInitialized])

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    setIsLoggedIn(!!token)
    setIsInitialized(true)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Fetch greeting when component initializes and no saved messages exist
  useEffect(() => {
    if (isInitialized && messages.length === 0) {
      console.log("🤖 Fetching welcome message from API")
      setIsLoadingGreeting(true)

      // Add initial loading message
      const loadingMessage: Message = {
        id: "loading-greeting",
        content: "",
        role: "assistant",
        timestamp: new Date(),
      }
      setMessages([loadingMessage])

      const token = localStorage.getItem("access_token")
      console.log("Token for greeting request:", token ? "Present" : "Not present")

      fetch("/api/greeting", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      })
        .then((res) => {
          console.log("Greeting API response status:", res.status)
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`)
          }
          return res.json()
        })
        .then((data) => {
          console.log("Greeting API response data:", data)
          const welcomeMessage: Message = {
            id: "welcome",
            content: data.response || "Hello! I'm your AI study assistant. How can I help you today?",
            role: "assistant",
            timestamp: new Date(),
          }
          setMessages([welcomeMessage])
        })
        .catch((err) => {
          console.error("Failed to fetch greeting:", err)
          // Fallback to default greeting
          const fallbackMessage: Message = {
            id: "welcome",
            content: `Hello! I'm your AI study assistant. I can help you understand the textbook content, explain concepts, and answer questions about what you're reading.${
              context?.currentChapter ? `\n\nI can see you're currently reading: ${context.currentChapter}` : ""
            }${
              context?.highlightedText ? `\n\nI notice you've highlighted: "${context.highlightedText}"` : ""
            }\n\nWhat would you like to know?`,
            role: "assistant",
            timestamp: new Date(),
          }
          setMessages([fallbackMessage])
        })
        .finally(() => {
          setIsLoadingGreeting(false)
        })
    }
  }, [context, isInitialized, messages.length])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }

  const fetchGreeting = async () => {
    setIsLoadingGreeting(true)
    const loadingMessage: Message = {
      id: "loading-greeting",
      content: "",
      role: "assistant",
      timestamp: new Date(),
    }
    setMessages([loadingMessage])

    const token = localStorage.getItem("access_token")
    console.log("Fetching new greeting, token:", token ? "Present" : "Not present")

    try {
      const response = await fetch("/api/greeting", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      })

      console.log("New greeting API response status:", response.status)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log("New greeting API response data:", data)

      const welcomeMessage: Message = {
        id: "welcome",
        content: data.response || "Hello! I'm your AI study assistant. How can I help you today?",
        role: "assistant",
        timestamp: new Date(),
      }
      setMessages([welcomeMessage])
    } catch (err) {
      console.error("Failed to fetch new greeting:", err)
      // Fallback to default greeting
      const fallbackMessage: Message = {
        id: "welcome",
        content: `Hello! I'm your AI study assistant. I can help you understand the textbook content, explain concepts, and answer questions about what you're reading.${
          context?.currentChapter ? `\n\nI can see you're currently reading: ${context.currentChapter}` : ""
        }${
          context?.highlightedText ? `\n\nI notice you've highlighted: "${context.highlightedText}"` : ""
        }\n\nWhat would you like to know?`,
        role: "assistant",
        timestamp: new Date(),
      }
      setMessages([fallbackMessage])
    } finally {
      setIsLoadingGreeting(false)
    }
  }

  const clearChat = () => {
    console.log("🗑️ Clearing chat")
    setMessages([])
    setMessageCount(0)
    clearChatSession()

    // Fetch new greeting
    fetchGreeting()
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    // Check message limit for non-logged in users
    if (!isLoggedIn && messageCount >= MAX_MESSAGES_GUEST) {
      return
    }

    const userMessage = input.trim()

    // Add user message
    const userMessageObj: Message = {
      id: Date.now().toString(),
      content: userMessage,
      role: "user",
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessageObj])
    setInput("")
    setMessageCount((prev) => prev + 1)
    setIsLoading(true)

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }

    // Create a temporary message for streaming
    const tempMessageId = `temp-${Date.now()}`
    const tempMessage: Message = {
      id: tempMessageId,
      content: "",
      role: "assistant",
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, tempMessage])

    try {
      // Get the authentication token from localStorage if available
      const token = localStorage.getItem("access_token")
      console.log("=== Frontend Chat Request ===")
      console.log("Token from localStorage:", token ? "Token exists" : "No token found")
      console.log("Token preview:", token ? `${token}` : "none")
      console.log("Token length:", token ? token.length : 0)
      console.log("Is logged in:", isLoggedIn)

      // Prepare context for the API
      const chatContext = {
        ...context,
        previousMessages: messages.slice(-6), // Send last 6 messages for context
      }

      // Step 1: Initiate the chat session
      console.log("Initiating chat session...")
      console.log("Request payload:", {
        message: userMessage,
        token: token ? "TOKEN_PROVIDED" : null,
        context: chatContext,
      })

      const initiateResponse = await fetch("/api/chat/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          message: userMessage,
          token: token || null,
          context: chatContext,
        }),
      })

      console.log("Initiate response status:", initiateResponse.status)
      console.log("Initiate response headers:", Object.fromEntries(initiateResponse.headers.entries()))

      if (!initiateResponse.ok) {
        const errorText = await initiateResponse.text()
        console.error("=== INITIATE ERROR ===")
        console.error("Status:", initiateResponse.status)
        console.error("Status Text:", initiateResponse.statusText)
        console.error("Response Text:", errorText)
        console.error("Response Headers:", Object.fromEntries(initiateResponse.headers.entries()))

        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText || "Unknown error" }
        }

        console.error("Parsed error data:", errorData)
        throw new Error(errorData.error || "Failed to initiate chat session")
      }

      const initiateData = await initiateResponse.json()
      console.log("Initiate response data:", initiateData)
      const { session_id } = initiateData

      if (!session_id) {
        console.error("No session_id in response:", initiateData)
        throw new Error("No session ID received from server")
      }

      // Step 2: Stream the response
      console.log("Starting stream request with session_id:", session_id)
      const streamResponse = await fetch(`/api/chat/stream?sessionId=${session_id}`, {
        method: "GET",
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      })

      console.log("Stream response status:", streamResponse.status)
      console.log("Stream response headers:", Object.fromEntries(streamResponse.headers.entries()))

      if (!streamResponse.ok) {
        const errorText = await streamResponse.text()
        console.error("=== STREAM ERROR ===")
        console.error("Status:", streamResponse.status)
        console.error("Status Text:", streamResponse.statusText)
        console.error("Response Text:", errorText)
        console.error("Response Headers:", Object.fromEntries(streamResponse.headers.entries()))
        throw new Error(`Failed to connect to chat stream: ${streamResponse.status} ${streamResponse.statusText}`)
      }

      // Handle streaming response
      const reader = streamResponse.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error("Failed to get stream reader")
      }

      let fullResponse = ""
      let buffer = "" // Add buffer to accumulate partial data

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          console.log("Stream reading completed")
          break
        }

        // Decode the chunk and add to buffer
        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        console.log("Received chunk:", chunk.substring(0, 100) + "...")

        // Process complete SSE events from buffer
        const lines = buffer.split("\n")

        // Keep the last incomplete line in buffer
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const jsonStr = line.slice(6).trim()

              // Skip empty data lines
              if (!jsonStr) continue

              const data = JSON.parse(jsonStr)
              console.log("Parsed SSE data:", data)

              if (data.text) {
                // Update the streaming message
                fullResponse += data.text
                setMessages((prev) =>
                  prev.map((msg) => (msg.id === tempMessageId ? { ...msg, content: fullResponse } : msg)),
                )
              }

              if (data.done) {
                console.log("Streaming marked as complete")
                break
              }

              if (data.error) {
                console.error("SSE error:", data.error)
                throw new Error(data.error)
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e, "Raw line:", line)
              // Don't throw here, just log and continue
            }
          }
        }
      }

      // If we didn't get any content, show a fallback message
      if (!fullResponse) {
        console.warn("No response content received")
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempMessageId
              ? { ...msg, content: "I received your message but couldn't generate a response. Please try again." }
              : msg,
          ),
        )
      } else {
        console.log("Final response length:", fullResponse.length)
      }
    } catch (error) {
      console.error("=== FULL ERROR ===")
      console.error("Error type:", typeof error)
      console.error("Error message:", error instanceof Error ? error.message : String(error))
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")

      // Update the temporary message with the error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempMessageId
            ? {
                ...msg,
                content:
                  error instanceof Error
                    ? error.message
                    : "Sorry, I encountered an error. Please try again. If you're running this in preview mode, the backend server may not be available.",
              }
            : msg,
        ),
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(e)
    }
  }

  const canSendMessage = isLoggedIn || messageCount < MAX_MESSAGES_GUEST

  return (
    <div className="h-full flex flex-col bg-[#252526]">
      {/* Clear chat button */}
      <div className="flex justify-end p-2 border-b border-[#3e3e42]">
        <Button
          onClick={clearChat}
          size="sm"
          variant="ghost"
          className="text-[#969696] hover:text-[#ffffff] hover:bg-[#3e3e42] h-6 px-2"
          disabled={isLoadingGreeting}
        >
          Clear
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 space-y-4 show-scrollbar">
        {messages.map((message) => (
          <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
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
                {/* Show loading animation for empty messages (greeting or temp) */}
                {message.content === "" && (message.id.startsWith("temp-") || message.id === "loading-greeting") ? (
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
                    <span className="text-sm">
                      {message.id === "loading-greeting" ? "Fetching greeting..." : "AI is thinking..."}
                    </span>
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
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Message limit warning */}
      {!isLoggedIn && messageCount >= MAX_MESSAGES_GUEST && (
        <div className="p-3 bg-[#2d2d30] border-t border-[#3e3e42]">
          <div className="flex items-center gap-2 text-[#ce9178] text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>You've reached the message limit. Sign in for unlimited chat!</span>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-[#3e3e42] bg-[#2d2d30]">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              canSendMessage ? "Ask me anything about the textbook content..." : "Sign in to continue chatting"
            }
            className="flex-1 bg-[#3e3e42] border-[#3e3e42] text-[#cccccc] placeholder-[#969696] focus:border-[#007acc] focus:ring-[#007acc] min-h-[40px] max-h-[120px] resize-none"
            disabled={!canSendMessage || isLoading || isLoadingGreeting}
            rows={1}
          />
          <Button
            type="submit"
            size="sm"
            className="bg-[#007acc] hover:bg-[#005a9e] text-white self-end"
            disabled={!input.trim() || !canSendMessage || isLoading || isLoadingGreeting}
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>

        {canSendMessage && (
          <div className="text-xs text-[#969696] mt-2">Press Enter to send, Shift+Enter for new line</div>
        )}
      </div>
    </div>
  )
}
