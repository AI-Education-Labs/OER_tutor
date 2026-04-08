"use client"

import { useContext } from "react"
import { BookOpen } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { TutorialContext } from "./tutorial-provider"
import type { TutorialId } from "@/config/tutorial/types"

const WELCOME_CONTENT: Record<TutorialId, { title: string; description: string }> = {
  "study-interface": {
    title: "Welcome to the Study Interface!",
    description:
      "Let us give you a quick tour. We'll walk you through the key features so you can get the most out of your study session.",
  },
  dashboard: {
    title: "Welcome to TextbookAI!",
    description:
      "Let us show you around. This quick tour will help you find courses, join classes, and start studying right away.",
  },
}

interface TutorialWelcomeModalProps {
  tutorialId: TutorialId
}

export function TutorialWelcomeModal({ tutorialId }: TutorialWelcomeModalProps) {
  const ctx = useContext(TutorialContext)

  if (!ctx || ctx.phase !== "welcome") return null

  const content = WELCOME_CONTENT[tutorialId]

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) ctx.skipTutorial(true)
      }}
    >
      <DialogContent className="sm:max-w-md bg-background-secondary border-border" style={{ zIndex: 202 }}>
        <DialogHeader className="items-center text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3 mx-auto">
            <BookOpen className="w-7 h-7 text-primary" />
          </div>
          <DialogTitle className="text-foreground text-lg">
            {content.title}
          </DialogTitle>
          <DialogDescription className="text-foreground-muted text-sm leading-relaxed">
            {content.description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="sm:justify-center gap-2">
          <Button
            variant="ghost"
            onClick={() => ctx.skipTutorial(true)}
            className="text-foreground-muted hover:text-foreground"
          >
            Skip Tour
          </Button>
          <Button
            onClick={ctx.startTutorial}
            className="bg-primary hover:bg-primary-hover text-white"
          >
            Start Tour
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
