import {
  MessageSquareText,
  Brain,
  CreditCard,
  BookOpen,
  Target,
  BarChart3,
  MessageSquare,
  FileText,
} from "lucide-react"
import type { TabItem } from "@/components/study-interface"

export function useTutorTabs(): TabItem[] {
  return [
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
      disabled: true,
    },
    {
      id: "progress",
      label: "Progress",
      icon: BarChart3,
      content: "progress",
      description: "Monitor your learning progress and analytics",
      disabled: true,
    },
    {
      id: "chat",
      label: "Socratic Dialogue",
      icon: MessageSquare,
      content: "chat",
      description: "Explore concepts through guided questions and discovery",
      disabled: true,
    },
    {
      id: "notes",
      label: "Study Notes",
      icon: FileText,
      content: "notes",
      description: "AI-generated and personal study notes",
      disabled: true,
    },
  ]
}
