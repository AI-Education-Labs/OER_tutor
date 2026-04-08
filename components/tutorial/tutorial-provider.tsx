"use client"

import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  createLocalPersistence,
  type TutorialPersistence,
} from "@/lib/tutorial-persistence"
import type { TutorialConfig, TutorialStep, UserRole } from "@/config/tutorial/types"
import { TutorialOverlay } from "./tutorial-overlay"
import { TutorialTooltip } from "./tutorial-tooltip"
import { TutorialWelcomeModal } from "./tutorial-welcome-modal"

export type TutorialPhase = "idle" | "welcome" | "active"

export interface TutorialContextValue {
  phase: TutorialPhase
  currentStep: TutorialStep | null
  currentStepNumber: number
  totalSteps: number
  interactionComplete: boolean
  startTutorial: () => void
  nextStep: () => void
  prevStep: () => void
  skipTutorial: (dontShowAgain: boolean) => void
  replayTutorial: () => void
}

export const TutorialContext = createContext<TutorialContextValue | null>(null)

interface TutorialProviderProps {
  children: ReactNode
  tutorialConfig: TutorialConfig
  userRole?: UserRole
  beforeShowHandlers?: Record<string, () => void>
  persistence?: TutorialPersistence
}

export function TutorialProvider({
  children,
  tutorialConfig,
  userRole,
  beforeShowHandlers = {},
  persistence: externalPersistence,
}: TutorialProviderProps) {
  const isMobile = useIsMobile()
  const persistence = useMemo(
    () => externalPersistence ?? createLocalPersistence(),
    [externalPersistence]
  )

  const [phase, setPhase] = useState<TutorialPhase>("idle")
  const [stepIndex, setStepIndex] = useState(0)
  const [interactionComplete, setInteractionComplete] = useState(false)

  // Filter steps by role and platform
  const filteredSteps = useMemo(() => {
    const baseSteps =
      isMobile && tutorialConfig.mobileSteps
        ? tutorialConfig.mobileSteps
        : tutorialConfig.steps

    return baseSteps.filter(
      (step) => !step.role || step.role === userRole
    )
  }, [tutorialConfig, userRole, isMobile])

  // Find the next valid step index (skipping steps whose target is missing when skipIfMissing is set)
  const findValidStepIndex = useCallback(
    (fromIndex: number, direction: 1 | -1): number => {
      let idx = fromIndex
      while (idx >= 0 && idx < filteredSteps.length) {
        const step = filteredSteps[idx]
        if (step.skipIfMissing && !document.querySelector(step.targetSelector)) {
          idx += direction
          continue
        }
        return idx
      }
      return -1 // no valid step found
    },
    [filteredSteps]
  )

  const currentStep = phase === "active" ? filteredSteps[stepIndex] ?? null : null

  // Run beforeShow handler and wait for target element to appear
  const prepareStep = useCallback(
    (step: TutorialStep): Promise<void> => {
      return new Promise((resolve) => {
        if (step.beforeShow && beforeShowHandlers[step.beforeShow]) {
          beforeShowHandlers[step.beforeShow]()
        }

        // Poll for the target element (max 10 animation frames ~160ms)
        let attempts = 0
        const poll = () => {
          if (document.querySelector(step.targetSelector) || attempts >= 10) {
            resolve()
            return
          }
          attempts++
          requestAnimationFrame(poll)
        }
        requestAnimationFrame(poll)
      })
    },
    [beforeShowHandlers]
  )

  // Navigate to a specific step
  const goToStep = useCallback(
    async (index: number) => {
      const validIndex = findValidStepIndex(index, 1)
      if (validIndex === -1) {
        // No more valid steps — end tutorial
        setPhase("idle")
        return
      }
      const step = filteredSteps[validIndex]
      await prepareStep(step)
      setStepIndex(validIndex)
      setInteractionComplete(!step.interactive)
    },
    [filteredSteps, findValidStepIndex, prepareStep]
  )

  const startTutorial = useCallback(() => {
    setPhase("active")
    goToStep(0)
  }, [goToStep])

  const nextStep = useCallback(() => {
    if (currentStep?.interactive && !interactionComplete) return
    const next = findValidStepIndex(stepIndex + 1, 1)
    if (next === -1) {
      setPhase("idle")
      return
    }
    goToStep(next)
  }, [currentStep, interactionComplete, stepIndex, findValidStepIndex, goToStep])

  const prevStep = useCallback(() => {
    const prev = findValidStepIndex(stepIndex - 1, -1)
    if (prev === -1) return
    goToStep(prev)
  }, [stepIndex, findValidStepIndex, goToStep])

  const skipTutorial = useCallback(
    (dontShowAgain: boolean) => {
      setPhase("idle")
      if (dontShowAgain) {
        persistence.markTutorialSeen(tutorialConfig.id)
      }
    },
    [persistence, tutorialConfig.id]
  )

  const replayTutorial = useCallback(() => {
    setPhase("welcome")
  }, [])

  // Auto-trigger on first visit
  useEffect(() => {
    if (persistence.hasSeenTutorial(tutorialConfig.id)) return
    const timer = setTimeout(() => {
      setPhase("welcome")
    }, 500)
    return () => clearTimeout(timer)
  }, [persistence, tutorialConfig.id])

  // Interactive step: listen for interaction event on target
  useEffect(() => {
    if (phase !== "active" || !currentStep?.interactive || interactionComplete) return

    const targetSelector =
      currentStep.interactionTargetSelector ?? currentStep.targetSelector
    const eventType = currentStep.interactionEvent ?? "click"

    const el = document.querySelector(targetSelector)
    if (!el) return

    const handler = () => setInteractionComplete(true)
    el.addEventListener(eventType, handler, { once: true })
    return () => el.removeEventListener(eventType, handler)
  }, [phase, currentStep, interactionComplete])

  // Keyboard navigation
  useEffect(() => {
    if (phase !== "active") return

    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault()
          e.stopPropagation()
          nextStep()
          break
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault()
          e.stopPropagation()
          prevStep()
          break
        case "Escape":
          e.preventDefault()
          e.stopPropagation()
          skipTutorial(false)
          break
        case "Enter":
          if (currentStep?.interactive && interactionComplete) {
            e.preventDefault()
            e.stopPropagation()
            nextStep()
          }
          break
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [phase, nextStep, prevStep, skipTutorial, currentStep, interactionComplete])

  const contextValue = useMemo<TutorialContextValue>(
    () => ({
      phase,
      currentStep,
      currentStepNumber: stepIndex + 1,
      totalSteps: filteredSteps.length,
      interactionComplete,
      startTutorial,
      nextStep,
      prevStep,
      skipTutorial,
      replayTutorial,
    }),
    [
      phase,
      currentStep,
      stepIndex,
      filteredSteps.length,
      interactionComplete,
      startTutorial,
      nextStep,
      prevStep,
      skipTutorial,
      replayTutorial,
    ]
  )

  return (
    <TutorialContext.Provider value={contextValue}>
      {children}
      <TutorialWelcomeModal tutorialId={tutorialConfig.id} />
      <TutorialOverlay />
      <TutorialTooltip />
    </TutorialContext.Provider>
  )
}
