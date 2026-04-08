"use client"

import { useContext } from "react"
import { TutorialContext } from "@/components/tutorial/tutorial-provider"

export function useTutorial() {
  const context = useContext(TutorialContext)
  if (!context) {
    throw new Error("useTutorial must be used within a TutorialProvider")
  }
  return context
}
