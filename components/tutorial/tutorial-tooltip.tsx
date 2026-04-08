"use client"

import { useState, useEffect, useCallback, useContext, useRef } from "react"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { TutorialContext } from "./tutorial-provider"
import type { StepPlacement } from "@/config/tutorial/types"

const GAP = 12
const VIEWPORT_MARGIN = 16
const TOOLTIP_WIDTH = 320
const ARROW_SIZE = 10

interface Position {
  top: number
  left: number
}

interface ArrowStyle {
  top?: number
  left?: number
  bottom?: number
  right?: number
  transform: string
  borderTop?: string
  borderLeft?: string
  borderRight?: string
  borderBottom?: string
}

function computePosition(
  targetRect: DOMRect,
  tooltipRect: { width: number; height: number },
  placement: StepPlacement
): { pos: Position; actualPlacement: StepPlacement } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  let pos: Position
  let actual = placement

  const centerX = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2
  const centerY = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2

  const tryPlacement = (p: StepPlacement): Position => {
    switch (p) {
      case "bottom":
        return { top: targetRect.bottom + GAP, left: centerX }
      case "top":
        return { top: targetRect.top - tooltipRect.height - GAP, left: centerX }
      case "right":
        return { top: centerY, left: targetRect.right + GAP }
      case "left":
        return { top: centerY, left: targetRect.left - tooltipRect.width - GAP }
    }
  }

  pos = tryPlacement(placement)

  // Flip if overflowing
  const opposites: Record<StepPlacement, StepPlacement> = {
    top: "bottom",
    bottom: "top",
    left: "right",
    right: "left",
  }

  if (
    pos.top < VIEWPORT_MARGIN ||
    pos.top + tooltipRect.height > vh - VIEWPORT_MARGIN ||
    pos.left < VIEWPORT_MARGIN ||
    pos.left + tooltipRect.width > vw - VIEWPORT_MARGIN
  ) {
    const flipped = tryPlacement(opposites[placement])
    if (
      flipped.top >= VIEWPORT_MARGIN &&
      flipped.top + tooltipRect.height <= vh - VIEWPORT_MARGIN &&
      flipped.left >= VIEWPORT_MARGIN &&
      flipped.left + tooltipRect.width <= vw - VIEWPORT_MARGIN
    ) {
      pos = flipped
      actual = opposites[placement]
    }
  }

  // Clamp to viewport
  pos.left = Math.max(VIEWPORT_MARGIN, Math.min(vw - tooltipRect.width - VIEWPORT_MARGIN, pos.left))
  pos.top = Math.max(VIEWPORT_MARGIN, Math.min(vh - tooltipRect.height - VIEWPORT_MARGIN, pos.top))

  return { pos, actualPlacement: actual }
}

function getArrowStyles(
  placement: StepPlacement,
  targetRect: DOMRect,
  tooltipPos: Position,
  tooltipWidth: number,
  tooltipHeight: number
): ArrowStyle {
  const half = ARROW_SIZE / 2

  switch (placement) {
    case "bottom": {
      // Arrow on top edge of tooltip, pointing up
      const targetCenterX = targetRect.left + targetRect.width / 2
      const arrowLeft = Math.max(12, Math.min(tooltipWidth - 12 - ARROW_SIZE, targetCenterX - tooltipPos.left - half))
      return {
        top: -half,
        left: arrowLeft,
        transform: "rotate(45deg)",
        borderTop: "1px solid var(--color-border)",
        borderLeft: "1px solid var(--color-border)",
      }
    }
    case "top": {
      // Arrow on bottom edge, pointing down
      const targetCenterX = targetRect.left + targetRect.width / 2
      const arrowLeft = Math.max(12, Math.min(tooltipWidth - 12 - ARROW_SIZE, targetCenterX - tooltipPos.left - half))
      return {
        bottom: -half,
        left: arrowLeft,
        transform: "rotate(45deg)",
        borderBottom: "1px solid var(--color-border)",
        borderRight: "1px solid var(--color-border)",
      }
    }
    case "left": {
      // Arrow on right edge, pointing right
      const targetCenterY = targetRect.top + targetRect.height / 2
      const arrowTop = Math.max(12, Math.min(tooltipHeight - 12 - ARROW_SIZE, targetCenterY - tooltipPos.top - half))
      return {
        right: -half,
        top: arrowTop,
        transform: "rotate(45deg)",
        borderTop: "1px solid var(--color-border)",
        borderRight: "1px solid var(--color-border)",
      }
    }
    case "right": {
      // Arrow on left edge, pointing left
      const targetCenterY = targetRect.top + targetRect.height / 2
      const arrowTop = Math.max(12, Math.min(tooltipHeight - 12 - ARROW_SIZE, targetCenterY - tooltipPos.top - half))
      return {
        left: -half,
        top: arrowTop,
        transform: "rotate(45deg)",
        borderBottom: "1px solid var(--color-border)",
        borderLeft: "1px solid var(--color-border)",
      }
    }
  }
}

export function TutorialTooltip() {
  const ctx = useContext(TutorialContext)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<Position>({ top: 0, left: 0 })
  const [actualPlacement, setActualPlacement] = useState<StepPlacement>("bottom")
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const reposition = useCallback(() => {
    if (!ctx?.currentStep || !tooltipRef.current) return

    const el = document.querySelector(ctx.currentStep.targetSelector)
    if (!el) return

    const tRect = el.getBoundingClientRect()
    setTargetRect(tRect)

    const tooltipEl = tooltipRef.current
    const { pos, actualPlacement: ap } = computePosition(
      tRect,
      { width: tooltipEl.offsetWidth, height: tooltipEl.offsetHeight },
      ctx.currentStep.placement
    )
    setPosition(pos)
    setActualPlacement(ap)
  }, [ctx?.currentStep])

  // Reposition when step changes
  useEffect(() => {
    if (ctx?.phase !== "active" || !ctx.currentStep) return
    // Use rAF to ensure the tooltip DOM is rendered before measuring
    const frame = requestAnimationFrame(() => reposition())
    return () => cancelAnimationFrame(frame)
  }, [ctx?.phase, ctx?.currentStep, reposition])

  // Reposition on scroll/resize
  useEffect(() => {
    if (ctx?.phase !== "active") return

    const onScroll = () => reposition()
    const onResize = () => reposition()

    window.addEventListener("scroll", onScroll, { passive: true, capture: true })
    window.addEventListener("resize", onResize)

    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true })
      window.removeEventListener("resize", onResize)
    }
  }, [ctx?.phase, reposition])

  if (!mounted || ctx?.phase !== "active" || !ctx.currentStep) return null

  const { currentStep, currentStepNumber, totalSteps, interactionComplete, nextStep, prevStep, skipTutorial } = ctx
  const isFirst = currentStepNumber === 1
  const isLast = currentStepNumber === totalSteps
  const nextDisabled = currentStep.interactive && !interactionComplete

  const tooltipEl = tooltipRef.current
  const arrowStyles = targetRect && tooltipEl
    ? getArrowStyles(actualPlacement, targetRect, position, tooltipEl.offsetWidth, tooltipEl.offsetHeight)
    : null

  return createPortal(
    <div
      ref={tooltipRef}
      className="fixed bg-background-secondary border border-border rounded-lg shadow-2xl"
      style={{
        zIndex: 202,
        top: position.top,
        left: position.left,
        width: TOOLTIP_WIDTH,
        maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
      }}
    >
      {/* Arrow */}
      {arrowStyles && (
        <div
          className="absolute bg-background-secondary"
          style={{
            width: ARROW_SIZE,
            height: ARROW_SIZE,
            ...arrowStyles,
          }}
        />
      )}

      <div className="p-4">
        {/* Step counter */}
        <div className="text-xs text-foreground-muted mb-2">
          Step {currentStepNumber} of {totalSteps}
        </div>

        {/* Title */}
        <h3 className="text-sm font-medium text-foreground mb-1">
          {currentStep.title}
        </h3>

        {/* Description */}
        <p className="text-xs text-foreground-muted leading-relaxed mb-4">
          {currentStep.description}
        </p>

        {/* Interactive step hint */}
        {currentStep.interactive && !interactionComplete && (
          <p className="text-xs text-primary mb-3 italic">
            Try it out to continue...
          </p>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={prevStep}
            disabled={isFirst}
            className={cn(
              "h-7 px-2 text-xs text-foreground-secondary",
              isFirst && "opacity-0 pointer-events-none"
            )}
          >
            <ChevronLeft className="w-3 h-3 mr-1" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => skipTutorial(true)}
              className="h-7 px-2 text-xs text-foreground-muted hover:text-foreground"
            >
              Skip
            </Button>

            <Button
              size="sm"
              onClick={nextStep}
              disabled={nextDisabled}
              className={cn(
                "h-7 px-3 text-xs bg-primary hover:bg-primary-hover text-white",
                nextDisabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {isLast ? "Got it" : "Next"}
              {!isLast && <ChevronRight className="w-3 h-3 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
