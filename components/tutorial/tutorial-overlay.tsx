"use client"

import { useState, useEffect, useCallback, useContext } from "react"
import { createPortal } from "react-dom"
import { TutorialContext } from "./tutorial-provider"

interface CutoutRect {
  x: number
  y: number
  width: number
  height: number
}

const PADDING = 6
const BORDER_RADIUS = 8

export function TutorialOverlay() {
  const ctx = useContext(TutorialContext)
  const [cutout, setCutout] = useState<CutoutRect | null>(null)
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 })

  const measure = useCallback(() => {
    if (!ctx?.currentStep) {
      setCutout(null)
      return
    }
    const el = document.querySelector(ctx.currentStep.targetSelector)
    if (!el) {
      setCutout(null)
      return
    }
    const rect = el.getBoundingClientRect()
    setCutout({
      x: rect.left - PADDING,
      y: rect.top - PADDING,
      width: rect.width + PADDING * 2,
      height: rect.height + PADDING * 2,
    })
    setViewportSize({ w: window.innerWidth, h: window.innerHeight })
  }, [ctx?.currentStep])

  // Re-measure when step changes
  useEffect(() => {
    if (ctx?.phase !== "active") {
      setCutout(null)
      return
    }
    measure()
  }, [ctx?.phase, ctx?.currentStep, measure])

  // Re-measure on scroll and resize
  useEffect(() => {
    if (ctx?.phase !== "active") return

    const onScroll = () => measure()
    const onResize = () => measure()

    window.addEventListener("scroll", onScroll, { passive: true, capture: true })
    window.addEventListener("resize", onResize)

    const observer = new ResizeObserver(() => measure())
    observer.observe(document.body)

    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true })
      window.removeEventListener("resize", onResize)
      observer.disconnect()
    }
  }, [ctx?.phase, measure])

  if (ctx?.phase !== "active" || !cutout) return null

  const { x, y, width, height } = cutout
  const { w: vw, h: vh } = viewportSize

  // SVG clip-path for click blocker: solid everywhere except the cutout hole
  const clipPath = `path(evenodd, "M 0 0 H ${vw} V ${vh} H 0 Z M ${x} ${y} h ${width} v ${height} h ${-width} Z")`

  return createPortal(
    <>
      {/* Layer 1: Click blocker — blocks clicks on dark areas, passes through cutout */}
      <div
        className="fixed inset-0"
        style={{
          zIndex: 200,
          pointerEvents: "all",
          clipPath,
        }}
      />

      {/* Layer 2: Visual overlay with cutout + glow */}
      <svg
        className="fixed inset-0 w-full h-full"
        style={{ zIndex: 201, pointerEvents: "none" }}
        viewBox={`0 0 ${vw} ${vh}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="tutorial-cutout-mask">
            <rect x="0" y="0" width={vw} height={vh} fill="white" />
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              rx={BORDER_RADIUS}
              fill="black"
            />
          </mask>
          <filter id="tutorial-glow">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {/* Dark overlay with hole */}
        <rect
          x="0"
          y="0"
          width={vw}
          height={vh}
          fill="black"
          opacity="0.55"
          mask="url(#tutorial-cutout-mask)"
        />

        {/* Glow border around cutout */}
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={BORDER_RADIUS}
          fill="none"
          stroke="rgba(100, 180, 255, 0.35)"
          strokeWidth="2"
          filter="url(#tutorial-glow)"
        />
        {/* Sharper inner border for definition */}
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={BORDER_RADIUS}
          fill="none"
          stroke="rgba(100, 180, 255, 0.2)"
          strokeWidth="1"
        />
      </svg>
    </>,
    document.body
  )
}
