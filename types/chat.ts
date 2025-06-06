export interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

export interface ChatContext {
  currentChapter?: string
  currentSection?: string
  highlightedText?: string
  pageNumber?: number
}
