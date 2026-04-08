import type { TutorialConfig } from "./types"

export const studyInterfaceTutorial: TutorialConfig = {
  id: "study-interface",
  steps: [
    {
      id: "chapter-selector",
      targetSelector: "[data-tutorial='chapter-selector']",
      title: "Chapter Navigation",
      description:
        "Browse chapters and sections of your textbook here. Click any section to jump directly to it and track your reading progress.",
      placement: "right",
      beforeShow: "expandLeftPanel",
    },
    {
      id: "pdf-viewer",
      targetSelector: "[data-tutorial='pdf-viewer']",
      title: "PDF Viewer",
      description:
        "Your textbook is displayed here. Scroll to read and use the breadcrumb bar above to track your current chapter and section.",
      placement: "bottom",
    },
    {
      id: "ai-tools-panel",
      targetSelector: "[data-tutorial='ai-tools-panel']",
      title: "AI Learning Tools",
      description:
        "Open AI Chat, Concept Checks, or Flashcards to enhance your study session. Click a tool to get started.",
      placement: "left",
      interactive: true,
      interactionEvent: "click",
      interactionTargetSelector: "[data-tutorial='tool-grid-card']",
      beforeShow: "expandRightPanel",
    },
    {
      id: "text-selection",
      targetSelector: "[data-tutorial='pdf-viewer']",
      title: "Ask AI About Any Text",
      description:
        "Highlight any text in the PDF and a popup will appear letting you ask the AI tutor about your selection.",
      placement: "top",
    },
  ],
  mobileSteps: [
    {
      id: "mobile-nav-bar",
      targetSelector: "[data-tutorial='mobile-nav-bar']",
      title: "Navigation",
      description:
        "Use these buttons to switch between Chapters, the PDF, and Learning Tools.",
      placement: "bottom",
    },
    {
      id: "mobile-pdf",
      targetSelector: "[data-tutorial='pdf-viewer']",
      title: "Your Textbook",
      description:
        "Read your textbook here. Highlight text to ask the AI questions about it.",
      placement: "bottom",
    },
    {
      id: "mobile-tools",
      targetSelector: "[data-tutorial='mobile-tools-btn']",
      title: "AI Tools",
      description:
        "Tap here to open AI Chat, Concept Checks, and Flashcards to help you study.",
      placement: "top",
      interactive: true,
      interactionEvent: "click",
    },
  ],
}
