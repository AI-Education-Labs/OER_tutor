"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { TabItem } from "@/components/study-interface"

interface ToolGridProps {
  tutorTabs: TabItem[]
  onSelectTool: (tool: TabItem) => void
}

export function ToolGrid({ tutorTabs, onSelectTool }: ToolGridProps) {
  const [hoveredToolId, setHoveredToolId] = useState<string | null>(null)

  return (
    <div className="p-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-medium text-foreground mb-2">Learning Tools</h3>
        <p className="text-sm text-foreground-muted">Choose tools to enhance your study session</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {tutorTabs.map((tool) => (
          <Card
            key={tool.id}
            data-tutorial="tool-grid-card"
            className={`bg-background-tertiary border-border transition-colors group ${
              tool.disabled ? "opacity-50 cursor-not-allowed" : "hover:border-primary cursor-pointer"
            }`}
            onClick={() => {
              if (tool.disabled) return
              onSelectTool(tool)
            }}
            onMouseEnter={() => setHoveredToolId(tool.id)}
            onMouseLeave={() => setHoveredToolId(null)}
          >
            <CardContent className="p-4 text-center">
              <div className="flex justify-center mb-3">
                <div className="w-12 h-12 bg-background-surface rounded-lg flex items-center justify-center group-hover:bg-primary transition-colors">
                  <tool.icon className="w-6 h-6 text-foreground-secondary group-hover:text-foreground" />
                </div>
              </div>
              <h4 className="text-sm font-medium text-foreground mb-2 truncate">{tool.label}</h4>
              <p
                className={`text-xs text-foreground-muted leading-relaxed transition-all duration-200 ${
                  hoveredToolId === tool.id ? "line-clamp-none" : "line-clamp-2"
                }`}
              >
                {tool.description}
              </p>
              {tool.disabled ? (
                <div className="mt-3 text-xs text-foreground-muted">Coming soon</div>
              ) : (
                <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center justify-center gap-1 text-xs text-primary">
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 p-4 bg-background-tertiary rounded border border-border">
        <h4 className="text-sm font-medium text-foreground mb-2">Quick Start</h4>
        <div className="space-y-2 text-xs text-foreground-muted">
          <p>• Click any tool above to get started</p>
          <p>• Drag tabs to rearrange or split into groups</p>
          <p>• Highlight text in the PDF to ask questions</p>
          <p>• Use the activity bar on the left for quick access</p>
        </div>
      </div>
    </div>
  )
}
