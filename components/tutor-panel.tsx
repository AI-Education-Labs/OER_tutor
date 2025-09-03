"use client"

import type React from "react"

import { useEffect, useState } from "react"
import {
  ChevronRight,
  ChevronDown,
  Lightbulb,
  ArrowRight,
  BookOpen,
  Plus,
  Target,
  Edit3,
  Save,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AiChatPanel } from "@/components/ai-chat-panel"
import type { ChatContext } from "@/types/chat"
import { QuizPanel } from "@/components/quiz-panel"
import { FlashcardPanel } from "@/components/flashcard-panel"
import { KeyConceptsPanel } from "@/components/key-concepts-panel"

interface TutorPanelProps {
  activeTab: string
  textbookId?: string
  selectedChapterId?: string
}

interface DialogueNode {
  id: string
  content: string
  type: "question" | "explanation" | "insight" | "challenge" | "system"
  source?: {
    page: number
    paragraph: string
    highlight: string
  }
  children?: DialogueNode[]
  expanded?: boolean
  selected?: boolean
}

interface DialogueTree {
  id: string
  topic: string
  rootNode: DialogueNode
  expanded: boolean
}

interface StudyNote {
  id: string
  title: string
  content: string
  highlightedText: string
  aiGenerated: boolean
  timestamp: string
  tags: string[]
}

export function TutorPanel({ activeTab, textbookId, selectedChapterId }: TutorPanelProps) {
  const [userInput, setUserInput] = useState("")
  const [activeTree, setActiveTree] = useState<string>("limits")
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [hoveredTreeId, setHoveredTreeId] = useState<string | null>(null)
  const [hoveredHighlightId, setHoveredHighlightId] = useState<string | null>(null)
  const [hoveredQuestionIndex, setHoveredQuestionIndex] = useState<string | null>(null)
  const [tooltipInfo, setTooltipInfo] = useState<{
    id: string
    text: string
    position: { x: number; y: number }
  } | null>(null)

  const [dialogueTrees, setDialogueTrees] = useState<DialogueTree[]>([
    {
      id: "limits",
      topic: "Understanding Limits",
      expanded: false,
      rootNode: {
        id: "limits-root",
        content: "Let's explore the concept of limits. What would you like to understand about them?",
        type: "system",
        expanded: true,
        children: [
          {
            id: "limits-intuition",
            content: "What's the intuitive meaning of a limit?",
            type: "question",
            expanded: true,
            children: [
              {
                id: "limits-intuition-response",
                content:
                  "A limit describes the value that a function approaches as the input approaches some value. Think of it as predicting where a function is heading, even if it doesn't actually reach that point.",
                type: "explanation",
                source: {
                  page: 23,
                  paragraph: "Introduction to Limits",
                  highlight: "The limit of f(x) as x approaches a is the value that f(x) gets arbitrarily close to...",
                },
                expanded: true,
                children: [
                  {
                    id: "limits-intuition-followup1",
                    content: "Can you give me a real-world example?",
                    type: "question",
                    expanded: false,
                    children: [
                      {
                        id: "limits-intuition-example",
                        content:
                          "Imagine approaching a speed limit sign on a highway. As you get closer to the sign, your distance to it approaches zero. The limit is zero, even though you'll never actually reach zero distance (you'd crash into the sign!).",
                        type: "explanation",
                        expanded: false,
                      },
                    ],
                  },
                  {
                    id: "limits-intuition-followup2",
                    content: "How is this different from just evaluating the function?",
                    type: "question",
                    expanded: false,
                    children: [
                      {
                        id: "limits-intuition-difference",
                        content:
                          "Great question! When we evaluate f(a), we're finding the actual value at exactly x = a. But with limits, we're looking at the behavior as x gets closer and closer to a, without actually reaching a. This is crucial for functions that are undefined at x = a.",
                        type: "explanation",
                        source: {
                          page: 24,
                          paragraph: "Limits vs. Function Evaluation",
                          highlight:
                            "The limit may exist even when f(a) is undefined, making limits more versatile for analyzing function behavior.",
                        },
                        expanded: false,
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: "limits-calculation",
            content: "How do we calculate limits?",
            type: "question",
            expanded: false,
            children: [
              {
                id: "limits-calculation-response",
                content:
                  "There are several techniques for calculating limits:\n\n1. Direct substitution (when the function is continuous at that point)\n2. Factoring and simplifying\n3. Rationalization (for certain radical expressions)\n4. Using special limit laws\n5. L'Hôpital's rule (for certain indeterminate forms)",
                type: "explanation",
                source: {
                  page: 31,
                  paragraph: "Calculating Limits",
                  highlight: "The following techniques can be used to evaluate limits...",
                },
                expanded: false,
              },
            ],
          },
          {
            id: "limits-challenge",
            content: "I'd like to try solving a limit problem",
            type: "challenge",
            expanded: false,
            children: [
              {
                id: "limits-challenge-problem",
                content: "Calculate lim[x→2] (x² + 3x - 1)",
                type: "challenge",
                expanded: false,
                children: [
                  {
                    id: "limits-challenge-hint",
                    content:
                      "Since this function is a polynomial, it's continuous everywhere. What does that tell you about how to approach this limit?",
                    type: "insight",
                    expanded: false,
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      id: "derivatives",
      topic: "Introduction to Derivatives",
      expanded: false,
      rootNode: {
        id: "derivatives-root",
        content: "Let's explore derivatives. What aspect would you like to understand?",
        type: "system",
        expanded: true,
        children: [],
      },
    },
  ])

  const [highlightedText, setHighlightedText] = useState([
    {
      id: "highlight-1",
      text: "The limit of f(x) as x approaches a is the value that f(x) gets arbitrarily close to...",
      page: 23,
      concept: "Limit Definition",
      questions: ["What does 'arbitrarily close' mean?", "Why do we need limits in calculus?"],
    },
    {
      id: "highlight-2",
      text: "The derivative of a function represents the rate of change or slope of the function at a given point.",
      page: 45,
      concept: "Derivative Concept",
      questions: ["How is the derivative related to velocity?", "What's the geometric interpretation?"],
    },
  ])

  const [studyNotes, setStudyNotes] = useState<StudyNote[]>([
    {
      id: "note-1",
      title: "Limit Definition",
      content:
        "This is the fundamental definition of a limit. It describes the behavior of a function as the input approaches a specific value, without necessarily reaching that value. This concept is crucial for understanding continuity and derivatives.\n\nKey points:\n• The limit describes approaching behavior\n• The function doesn't need to be defined at the point\n• Essential for calculus foundations",
      highlightedText: "The limit of f(x) as x approaches a is the value that f(x) gets arbitrarily close to...",
      aiGenerated: true,
      timestamp: "2 hours ago",
      tags: ["limits", "definition", "fundamentals"],
    },
  ])

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState("")

  const [keyConcepts] = useState([
    {
      id: "concept-1",
      title: "Limit Definition",
      description: "The fundamental concept of limits in calculus",
      mastery: 85,
      lastReviewed: "Today",
    },
    {
      id: "concept-2",
      title: "Continuity",
      description: "When a function has no breaks or jumps",
      mastery: 70,
      lastReviewed: "Yesterday",
    },
    {
      id: "concept-3",
      title: "Squeeze Theorem",
      description: "A technique for evaluating limits using bounds",
      mastery: 45,
      lastReviewed: "3 days ago",
    },
  ])

  const [chatContext, setChatContext] = useState<ChatContext>({
    currentChapter: "Chapter 1: What is Physics?",
    currentSection: "Physics: Definitions and Applications",
    pageNumber: 1,
  })

  const handleElementHover = (e: React.MouseEvent, id: string, text: string, selector = ".truncated-text") => {
    const element = e.currentTarget as HTMLElement
    const textElement = element.querySelector(selector) as HTMLElement

    if (!textElement) return

    const isTextTruncated =
      textElement.scrollWidth > textElement.clientWidth || textElement.scrollHeight > textElement.clientHeight

    if (isTextTruncated) {
      const rect = element.getBoundingClientRect()
      setTooltipInfo({
        id,
        text,
        position: {
          x: rect.left + rect.width / 2,
          y: rect.bottom + 4,
        },
      })
    }
  }

  const handleElementLeave = () => {
    setTooltipInfo(null)
  }

  const toggleNodeExpansion = (treeId: string, nodeId: string) => {
    setDialogueTrees((prev) =>
      prev.map((tree) => {
        if (tree.id !== treeId) return tree

        const updateNode = (node: DialogueNode): DialogueNode => {
          if (node.id === nodeId) {
            return { ...node, expanded: !node.expanded }
          }

          if (node.children) {
            return {
              ...node,
              children: node.children.map(updateNode),
            }
          }

          return node
        }

        return {
          ...tree,
          rootNode: updateNode(tree.rootNode),
        }
      }),
    )
  }

  const toggleTreeExpansion = (treeId: string) => {
    setDialogueTrees((prev) => prev.map((tree) => (tree.id === treeId ? { ...tree, expanded: !tree.expanded } : tree)))
  }

  const addUserQuestion = () => {
    if (!userInput.trim()) return

    setDialogueTrees((prev) =>
      prev.map((tree) => {
        if (tree.id !== activeTree) return tree

        return {
          ...tree,
          rootNode: {
            ...tree.rootNode,
            children: [
              ...(tree.rootNode.children || []),
              {
                id: `user-question-${Date.now()}`,
                content: userInput,
                type: "question",
                expanded: true,
                children: [
                  {
                    id: `ai-response-${Date.now()}`,
                    content:
                      "That's an excellent question! Let me guide you through this step by step...\n\nThe key insight is to consider how the function behaves as we approach the point in question. Let's break this down further...",
                    type: "explanation",
                    expanded: true,
                  },
                ],
              },
            ],
          },
        }
      }),
    )

    setUserInput("")
  }

  const startEditingNote = (note: StudyNote) => {
    setEditingNoteId(note.id)
    setEditingContent(note.content)
  }

  const saveNote = (noteId: string) => {
    setStudyNotes((prev) => prev.map((note) => (note.id === noteId ? { ...note, content: editingContent } : note)))
    setEditingNoteId(null)
    setEditingContent("")
  }

  const cancelEditing = () => {
    setEditingNoteId(null)
    setEditingContent("")
  }

  const renderDialogueNode = (node: DialogueNode, treeId: string, depth = 0) => {
    const nodeTypeStyles = {
      question: "bg-[#2d2d30] border-l-4 border-[#569cd6]",
      explanation: "bg-[#252526] border-l-4 border-[#4ec9b0]",
      insight: "bg-[#252526] border-l-4 border-[#dcdcaa]",
      challenge: "bg-[#252526] border-l-4 border-[#ce9178]",
      system: "bg-[#252526] border-l-4 border-[#808080]",
    }

    const nodeTypeIcons = {
      question: <ChevronRight className="w-4 h-4 text-[#569cd6]" />,
      explanation: <BookOpen className="w-4 h-4 text-[#4ec9b0]" />,
      insight: <Lightbulb className="w-4 h-4 text-[#dcdcaa]" />,
      challenge: <ArrowRight className="w-4 h-4 text-[#ce9178]" />,
      system: null,
    }

    return (
      <div key={node.id} className={`mb-2 ${depth > 0 ? "ml-6" : ""}`}>
        <div
          className={`p-3 rounded ${nodeTypeStyles[node.type]} ${
            node.type === "question" ? "cursor-pointer hover:bg-[#3e3e42]" : ""
          }`}
          onClick={() => {
            if (node.type === "question") {
              toggleNodeExpansion(treeId, node.id)
            }
          }}
          onMouseEnter={(e) => handleElementHover(e, node.id, node.content, ".node-content")}
          onMouseLeave={handleElementLeave}
        >
          <div className="flex items-start gap-2">
            {node.children && node.children.length > 0 && node.type === "question" ? (
              <div className="mt-1">
                {node.expanded ? (
                  <ChevronDown className="w-4 h-4 text-[#569cd6]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#569cd6]" />
                )}
              </div>
            ) : (
              <div className="mt-1">{nodeTypeIcons[node.type]}</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="node-content text-sm whitespace-pre-wrap line-clamp-2">{node.content}</div>

              {node.source && (
                <div
                  className={`mt-2 text-xs bg-[#3e3e42] p-2 rounded flex items-center gap-2 cursor-pointer hover:bg-[#4e4e52] min-w-0`}
                  onClick={(e) => {
                    e.stopPropagation()
                    console.log("Navigate to source:", node.source)
                  }}
                  onMouseEnter={(e) => e.stopPropagation()}
                  onMouseLeave={(e) => e.stopPropagation()}
                >
                  <BookOpen className="w-3 h-3 text-[#569cd6] flex-shrink-0" />
                  <span className="truncate">
                    Source: Page {node.source.page} - {node.source.paragraph}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {node.expanded && node.children && node.children.length > 0 && (
          <div className="mt-2">
            {node.children.map((childNode) => renderDialogueNode(childNode, treeId, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const renderSocraticDialogue = () => (
    <div className="flex flex-col h-full relative">
      <div className="flex-1 overflow-auto p-3 show-scrollbar">
        {dialogueTrees.map((tree) => (
          <div key={tree.id} className="mb-4">
            <div
              className="flex items-center gap-2 p-2 bg-[#3e3e42] rounded cursor-pointer hover:bg-[#4e4e52] min-w-0"
              onClick={() => {
                toggleTreeExpansion(tree.id)
                setActiveTree(tree.id)
              }}
              onMouseEnter={(e) => handleElementHover(e, tree.id, tree.topic, ".tree-title")}
              onMouseLeave={handleElementLeave}
            >
              {tree.expanded ? (
                <ChevronDown className="w-4 h-4 text-[#cccccc] flex-shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[#cccccc] flex-shrink-0" />
              )}
              <span className="tree-title text-sm font-medium min-w-0 truncate">{tree.topic}</span>
            </div>

            {tree.expanded && (
              <div className="mt-2">
                {renderDialogueNode(tree.rootNode, tree.id)}
                <div className="mt-4 p-2 border border-dashed border-[#3e3e42] rounded text-center text-xs text-[#808080] hover:border-[#569cd6] hover:text-[#569cd6] cursor-pointer">
                  <span>Explore more aspects of this topic...</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-[#3e3e42]">
        <div className="flex flex-col gap-2">
          <Textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Ask a question to explore further..."
            className="bg-[#3e3e42] border-[#3e3e42] text-[#cccccc] placeholder-[#969696] min-h-[80px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.ctrlKey) {
                e.preventDefault()
                addUserQuestion()
              }
            }}
          />
          <div className="flex justify-between items-center">
            <div className="text-xs text-[#808080]">Press Ctrl+Enter to ask</div>
            <Button onClick={addUserQuestion} size="sm" className="bg-[#007acc] hover:bg-[#005a9e]">
              Explore
            </Button>
          </div>
        </div>
      </div>

      {/* Floating tooltip for any truncated text */}
      {tooltipInfo && (
        <div
          className="fixed bg-[#2d2d30] text-[#cccccc] text-xs px-3 py-2 rounded border border-[#3e3e42] shadow-lg z-50 pointer-events-none max-w-xs"
          style={{
            left: `${tooltipInfo.position.x}px`,
            top: `${tooltipInfo.position.y}px`,
            transform: "translateX(-50%)",
          }}
        >
          {tooltipInfo.text}
        </div>
      )}
    </div>
  )

  const renderHighlightsTab = () => (
    <div className="h-full flex flex-col relative">
      <div className="flex-1 overflow-auto p-4 space-y-4 show-scrollbar">
        <h3 className="text-[#ffffff] text-sm font-medium">Highlighted Concepts</h3>

        {highlightedText.map((highlight) => (
          <Card
            key={highlight.id}
            className="bg-[#2d2d30] border-[#3e3e42] max-w-full"
            onMouseEnter={() => setHoveredHighlightId(highlight.id)}
            onMouseLeave={() => setHoveredHighlightId(null)}
          >
            <CardContent className="p-3">
              <div className="flex justify-between items-start mb-2">
                <div
                  className="flex-1 mr-2 min-w-0" // Added min-w-0 to ensure proper truncation
                  onMouseEnter={(e) => {
                    // Force tooltip for testing
                    const rect = e.currentTarget.getBoundingClientRect()
                    setTooltipInfo({
                      id: `${highlight.id}-title`,
                      text: highlight.concept,
                      position: {
                        x: rect.left + rect.width / 2,
                        y: rect.bottom + 4,
                      },
                    })
                  }}
                  onMouseLeave={handleElementLeave}
                >
                  <h4 className="highlight-title text-[#ffffff] text-sm font-medium truncate">{highlight.concept}</h4>
                </div>
                <span className="text-xs text-[#969696] flex-shrink-0 whitespace-nowrap">Page {highlight.page}</span>
              </div>
              <div
                className="mb-3"
                onMouseEnter={(e) => {
                  // Force tooltip for testing
                  const rect = e.currentTarget.getBoundingClientRect()
                  setTooltipInfo({
                    id: `${highlight.id}-text`,
                    text: highlight.text,
                    position: {
                      x: rect.left + rect.width / 2,
                      y: rect.bottom + 4,
                    },
                  })
                }}
                onMouseLeave={handleElementLeave}
              >
                <p className="highlight-text text-xs text-[#969696] italic line-clamp-2">"{highlight.text}"</p>
              </div>

              <div className="space-y-2">
                {highlight.questions.map((question, index) => {
                  const questionId = `${highlight.id}-q${index}`
                  return (
                    <Button
                      key={questionId}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-left bg-[#3e3e42] border-[#4e4e52] text-[#cccccc] hover:bg-[#4e4e52] hover:text-[#ffffff] min-w-0 h-auto py-2"
                      onMouseEnter={(e) => handleElementHover(e, questionId, question, ".truncated-text")}
                      onMouseLeave={handleElementLeave}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Lightbulb className="w-3 h-3 text-[#dcdcaa] flex-shrink-0" />
                        <span className="truncated-text text-xs truncate">{question}</span>
                      </div>
                    </Button>
                  )
                })}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-left text-[#569cd6] hover:bg-[#3e3e42] hover:text-[#569cd6] h-auto py-2"
                  onMouseEnter={(e) =>
                    handleElementHover(
                      e,
                      `${highlight.id}-add`,
                      "Ask your own question about this concept",
                      ".truncated-text",
                    )
                  }
                  onMouseLeave={handleElementLeave}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Plus className="w-3 h-3 flex-shrink-0" />
                    <span className="truncated-text text-xs truncate">Ask your own question about this concept</span>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Floating tooltip */}
      {tooltipInfo && (
        <div
          className="fixed bg-[#2d2d30] text-[#cccccc] text-xs px-3 py-2 rounded border border-[#3e3e42] shadow-lg z-50 pointer-events-none max-w-xs"
          style={{
            left: `${tooltipInfo.position.x}px`,
            top: `${tooltipInfo.position.y}px`,
            transform: "translateX(-50%)",
          }}
        >
          {tooltipInfo.text}
        </div>
      )}
    </div>
  )

  const renderQuizTab = () => <QuizPanel textbookId={textbookId} selectedChapterId={selectedChapterId} />

  const renderFlashcardsTab = () => <FlashcardPanel textbookId={textbookId} selectedChapterId={selectedChapterId} />

  const renderNotesTab = () => (
    <div className="h-full flex flex-col relative">
      <div className="flex-1 overflow-auto p-4 space-y-4 show-scrollbar">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[#ffffff] text-sm font-medium">Study Notes</h3>
          <Button
            size="sm"
            variant="outline"
            className="border-[#3e3e42] text-[#cccccc] text-xs hover:text-[#ffffff] bg-transparent"
          >
            <Plus className="w-3 h-3 mr-1" />
            New Note
          </Button>
        </div>

        {studyNotes.map((note) => (
          <Card key={note.id} className="bg-[#2d2d30] border-[#3e3e42]">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-[#ffffff] text-sm font-medium truncate">{note.title}</h4>
                    {note.aiGenerated && (
                      <span className="text-xs bg-[#007acc] text-white px-2 py-0.5 rounded">AI</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#969696]">
                    <span>{note.timestamp}</span>
                    <span>•</span>
                    <div className="flex gap-1">
                      {note.tags.map((tag) => (
                        <span key={tag} className="bg-[#3e3e42] px-1.5 py-0.5 rounded text-[10px]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-8 h-8 p-0 hover:bg-[#3e3e42]"
                  onClick={() => startEditingNote(note)}
                >
                  <Edit3 className="w-3 h-3" />
                </Button>
              </div>

              {note.highlightedText && (
                <div className="mb-3 p-2 bg-[#252526] rounded border-l-2 border-[#ce9178]">
                  <div className="text-xs text-[#969696] italic">Highlighted: "{note.highlightedText}"</div>
                </div>
              )}

              {editingNoteId === note.id ? (
                <div className="space-y-3">
                  <Textarea
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    className="bg-[#3e3e42] border-[#3e3e42] text-[#cccccc] min-h-[120px] resize-none"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-[#007acc] hover:bg-[#005a9e]" onClick={() => saveNote(note.id)}>
                      <Save className="w-3 h-3 mr-1" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#3e3e42] text-[#cccccc] hover:text-[#ffffff] bg-transparent"
                      onClick={cancelEditing}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[#cccccc] whitespace-pre-wrap">{note.content}</div>
              )}

              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-[#3e3e42] border-[#4e4e52] hover:bg-[#4e4e52] flex-1"
                >
                  <BookOpen className="w-3 h-3 mr-1" />
                  Ask about this
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Floating tooltip */}
      {tooltipInfo && (
        <div
          className="fixed bg-[#2d2d30] text-[#cccccc] text-xs px-3 py-2 rounded border border-[#3e3e42] shadow-lg z-50 pointer-events-none max-w-xs"
          style={{
            left: `${tooltipInfo.position.x}px`,
            top: `${tooltipInfo.position.y}px`,
            transform: "translateX(-50%)",
          }}
        >
          {tooltipInfo.text}
        </div>
      )}
    </div>
  )

  const renderKeyConceptsTab = () => (
    <KeyConceptsPanel textbookId={textbookId} />
  )

  const tabContent = {
    "ai-chat": () => <AiChatPanel context={chatContext} />,
    chat: renderSocraticDialogue,
    quiz: renderQuizTab,
    flashcards: renderFlashcardsTab,
    notes: renderNotesTab,
    concepts: renderKeyConceptsTab,
    practice: renderQuizTab,
    progress: () => <div>Progress</div>,
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">{tabContent[activeTab as keyof typeof tabContent]?.()}</div>
  )
}
