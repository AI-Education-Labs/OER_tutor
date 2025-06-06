"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Chapter {
  id: string
  title: string
  sections?: Section[]
  progress?: number
}

interface Section {
  id: string
  title: string
  page: number
  completed?: boolean
}

export function ChapterSelector() {
  // Change the initial expanded state to start collapsed
  const [expandedChapters, setExpandedChapters] = useState<string[]>([])
  const [hoveredChapter, setHoveredChapter] = useState<string | null>(null)
  const [hoveredSection, setHoveredSection] = useState<string | null>(null)

  const chapters: Chapter[] = [
    {
      id: "1",
      title: "What is Physics",
      progress: 5,
      sections: [
        { id: "1.1", title: "Physics: Definitions and Applications", page: 1, completed: true },
        { id: "1.2", title: "The Scientific Methods", page: 14, completed: false },
        { id: "1.3", title: "The Language of Physics: Physical Quantities and Units", page: 18, completed: false },
      ],
    },
    {

      id: "2",
      title: "Motion in One Dimension",
      progress: 0,
      sections: [
        { id: "2.1", title: "Relative Motion, Distance, and Displacement", page: 54 },
        { id: "2.2", title: "Speed and Velocity", page: 62 },
        { id: "2.3", title: "Position vs. Time Graphs", page: 67 },
        { id: "2.4", title: "Velocity vs. Time Graphs", page: 72 },
      ],
    },
    {
      id: "3",
      title: "Acceleration",
      progress: 0,
      sections: [
        { id: "3.1", title: "Acceleration", page: 93 },
        { id: "3.2", title: "Representing Acceleration with Equations and Graphs", page: 99 },
      ],
    },
  ]

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) =>
      prev.includes(chapterId) ? prev.filter((id) => id !== chapterId) : [...prev, chapterId],
    )
  }

  return (
    <div className="p-1.5 show-scrollbar">
      {chapters.map((chapter) => (
        <div key={chapter.id} className="mb-1">
          <Button
            variant="ghost"
            className="w-full justify-start p-1.5 h-auto hover:bg-[#3e3e42] text-left relative"
            onClick={() => toggleChapter(chapter.id)}
            onMouseEnter={() => setHoveredChapter(chapter.id)}
            onMouseLeave={() => setHoveredChapter(null)}
          >
            <div className="flex items-center gap-1.5 w-full">
              {expandedChapters.includes(chapter.id) ? (
                <ChevronDown className="w-3 h-3 text-[#969696] flex-shrink-0" />
              ) : (
                <ChevronRight className="w-3 h-3 text-[#969696] flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div
                  className={`text-xs text-[#cccccc] leading-tight transition-all duration-200 ${
                    hoveredChapter === chapter.id ? "whitespace-normal" : "truncate"
                  }`}
                >
                  {chapter.title}
                </div>
                {chapter.progress !== undefined && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-12 bg-[#3e3e42] rounded-full h-0.5">
                      <div className="bg-[#007acc] h-0.5 rounded-full" style={{ width: `${chapter.progress}%` }} />
                    </div>
                    <span className="text-[10px] text-[#969696] flex-shrink-0">{chapter.progress}%</span>
                  </div>
                )}
              </div>
            </div>
          </Button>

          {expandedChapters.includes(chapter.id) && chapter.sections && (
            <div className="ml-4 mt-0.5">
              {chapter.sections.map((section) => (
                <Button
                  key={section.id}
                  variant="ghost"
                  className="w-full justify-start p-1.5 h-auto hover:bg-[#3e3e42] text-left relative"
                  onMouseEnter={() => setHoveredSection(section.id)}
                  onMouseLeave={() => setHoveredSection(null)}
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <FileText className="w-2.5 h-2.5 text-[#969696] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-[11px] text-[#cccccc] leading-tight transition-all duration-200 ${
                          hoveredSection === section.id ? "whitespace-normal" : "truncate"
                        }`}
                      >
                        {section.title}
                      </div>
                      <div className="text-[10px] text-[#969696]">Page {section.page}</div>
                    </div>
                    {section.completed && <div className="w-1.5 h-1.5 bg-[#4ec9b0] rounded-full flex-shrink-0" />}
                  </div>
                </Button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
