"use client"

import { HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTutorial } from "@/hooks/use-tutorial"

export function TutorialReplayButton() {
  const { replayTutorial } = useTutorial()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={replayTutorial}
      className="w-6 h-6 p-0 hover:bg-background-surface"
      title="Replay Tutorial"
    >
      <HelpCircle className="w-3.5 h-3.5 text-foreground-muted" />
    </Button>
  )
}
