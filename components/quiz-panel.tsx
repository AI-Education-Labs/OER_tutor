"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/use-toast"

interface GeneratedQuestion {
  question: string
  choices: string[]
  answer: number
}

interface QuizPanelProps {
  textbookId?: string
  selectedChapterId?: string
}

export function QuizPanel({ textbookId, selectedChapterId }: QuizPanelProps) {
  const [stage, setStage] = useState<"menu" | "loading" | "quiz" | "summary">("menu")
  const [subchapters, setSubchapters] = useState<string[]>([])
  const [selectedSubchapter, setSelectedSubchapter] = useState<string>("")
  const [contextText, setContextText] = useState<string>("")
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([])
  const [answers, setAnswers] = useState<number[]>([])
  const [showCorrectAnswers, setShowCorrectAnswers] = useState<boolean>(false)
  const [timedEnabled, setTimedEnabled] = useState<boolean>(false)
  const [timeMinutes, setTimeMinutes] = useState<number>(5)
  const [timeSeconds, setTimeSeconds] = useState<number>(0)
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const [numQuestions, setNumQuestions] = useState<number>(5)
  const [previousQuizzes, setPreviousQuizzes] = useState<any[]>([])
  const [prevLoading, setPrevLoading] = useState<boolean>(false)
  const [prevError, setPrevError] = useState<string>("")

  function MenuButton({ id, kind, item, onOptimisticRemove, onFailureRestore }: { id: string; kind: "flashcards" | "quizzes" | "notes"; item: any; onOptimisticRemove: (id: string, item: any) => void; onFailureRestore: (id: string, item: any) => void }) {
    const handleDelete = async (e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        onOptimisticRemove(id, item)
        const resp = await fetch(`/api/${kind}/${encodeURIComponent(id)}`, { method: "DELETE" })
        if (!resp.ok) {
          onFailureRestore(id, item)
          toast({ title: "Delete failed", description: `Could not delete. Please try again. (${resp.status})` })
        }
      } catch {
        onFailureRestore(id, item)
        toast({ title: "Delete failed", description: "Could not delete. Please try again." })
      }
    }
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="w-6 h-6 rounded hover:bg-[#4b4b4b] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
            aria-label="More options"
            title="More options"
          >
            <span className="block w-[2px] h-[14px] bg-[#9e9e9e] relative">
              <span className="absolute left-0 top-0 w-[2px] h-[2px] bg-[#9e9e9e]"></span>
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[2px] bg-[#9e9e9e]"></span>
              <span className="absolute left-0 bottom-0 w-[2px] h-[2px] bg-[#9e9e9e]"></span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-[#2d2d30] border-[#3e3e42] text-[#cccccc]">
          <DropdownMenuItem onClick={handleDelete} className="text-red-400 focus:bg-[#3e3e42]">
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Load subchapters for the currently selected chapter
  useEffect(() => {
    let isCancelled = false
    const load = async () => {
      try {
        if (!textbookId || !selectedChapterId) return
        // 1) Load metadata for subchapters of selected chapter
        const metaResp = await fetch(`/api/textbooks/${encodeURIComponent(textbookId)}`, { cache: "no-store" })
        if (metaResp.ok) {
          const meta = await metaResp.json()
          let current_chapter: any = null
          const chapters = Array.isArray(meta?.chapters) ? meta.chapters : []
          for (const chapter of chapters) {
            if (String(chapter?.id) === String(selectedChapterId)) {
              current_chapter = chapter
              break
            }
          }
          const rawSubs = current_chapter?.sub_chapters ?? []
          const subs: string[] = Array.isArray(rawSubs)
            ? rawSubs.map((s: any) => (typeof s === "string" ? (s === "Introduction" ? '' : s) 
            : String(s?.title === "Introduction" ? "" : String(s?.title ?? "")))).filter((s: string) => s)
            : []
          if (!isCancelled) {
            setSubchapters(subs)
            setContextText(`context-ready:${selectedChapterId}`)
            // if (!selectedSubchapter && subs.length > 0) {
            //   setSelectedSubchapter(subs[0])
            // }
          }
        }
      } catch {
        // ignore
      }
    }
    load()
    return () => {
      isCancelled = true
    }
  }, [textbookId, selectedChapterId])

  // Load user's previous quizzes when in menu
  useEffect(() => {
    let isCancelled = false
    if (stage !== "menu") return
    const load = async () => {
      try {
        setPrevLoading(true)
        setPrevError("")
        const resp = await fetch("/api/quiz/list", { credentials: "include" })
        if (!resp.ok) {
          if (resp.status === 401 || resp.status === 403) {
            if (!isCancelled) {
              setPreviousQuizzes([])
              setPrevError("Your session has expired. Please log in again.")
            }
            return
          }
          throw new Error()
        }
        const data = await resp.json()
        if (!isCancelled) setPreviousQuizzes(Array.isArray(data) ? data : [])
      } catch {
        if (!isCancelled) {
          setPreviousQuizzes([])
          setPrevError("Could not load previous quizzes. Make sure you are logged in.")
        }
      } finally {
        if (!isCancelled) setPrevLoading(false)
      }
    }
    load()
    return () => { isCancelled = true }
  }, [stage])

  const loadQuiz = (doc: any) => {
    try {
      const list = Array.isArray(doc?.quiz) ? doc.quiz : []
      if (!list.length) return
      setQuestions(list)
      setAnswers(new Array(list.length).fill(-1))
      setStage("quiz")
    } catch {}
  }

  const startGeneration = async () => {
    setStage("loading")
    try {
      const context = ""
      const focusHint = selectedSubchapter ? `${selectedSubchapter}` : ""

      const resp = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, hint: focusHint, num_questions: numQuestions, chapter: selectedChapterId, textbook_id: textbookId }),
      })

      if (!resp.ok) {
        throw new Error(`Failed to generate quiz (${resp.status})`)
      }

      const payload = await resp.json()
      const data: GeneratedQuestion[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.quiz)
          ? payload.quiz
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.raw)
              ? payload.raw
              : []

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("Quiz generation returned no questions")
      }

      setQuestions(data as GeneratedQuestion[])
      setAnswers(new Array(data.length).fill(-1))
      setStage("quiz")
    } catch {
      setStage("menu")
    }
  }

  const submitQuiz = () => {
    setStage("summary")
  }

  const retryQuiz = () => {
    setAnswers((prev) => new Array(prev.length).fill(-1))
    setShowCorrectAnswers(false)
    setStage("quiz")
  }

  const score = questions.reduce((acc, q, idx) => (answers[idx] === q.answer ? acc + 1 : acc), 0)

  // Initialize timer on entering quiz stage, and clear when leaving
  useEffect(() => {
    if (stage === "quiz" && timedEnabled) {
      setRemainingSeconds(Math.max(0, timeMinutes * 60 + timeSeconds))
    } else {
      setRemainingSeconds(null)
    }
  }, [stage, timedEnabled])

  // Countdown effect
  useEffect(() => {
    if (stage !== "quiz" || !timedEnabled) return
    if (remainingSeconds === null) return
    if (remainingSeconds <= 0) {
      submitQuiz()
      return
    }
    const id = setInterval(() => {
      setRemainingSeconds((s) => (s !== null ? s - 1 : s))
    }, 1000)
    return () => clearInterval(id)
  }, [stage, timedEnabled, remainingSeconds])

  const formatTime = (total: number) => {
    const m = Math.floor(total / 60)
    const s = total % 60
    const mm = m.toString().padStart(2, "0")
    const ss = s.toString().padStart(2, "0")
    return `${mm}:${ss}`
  }

  if (stage === "menu") {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-[#3e3e42]">
          <h3 className="text-sm font-medium text-[#ffffff]">Concept Check</h3>
          <p className="text-xs text-[#969696]">Choose a subchapter to focus your quiz.</p>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-4 show-scrollbar">
          <div>
            <label className="block text-xs text-[#cccccc] mb-2">Subchapter</label>
            <Select onValueChange={(v: string) => setSelectedSubchapter(v)}>
              <SelectTrigger className="w-full bg-[#2d2d30] border-[#3e3e42] text-[#cccccc]">
                <SelectValue placeholder="Select a subchapter" />
              </SelectTrigger>
              <SelectContent className="bg-[#2d2d30] border-[#3e3e42] text-[#cccccc] max-h-60 overflow-auto">
                {subchapters.length === 0 ? (
                  <div className="px-2 py-1 text-xs text-[#969696]">No subchapters detected</div>
                ) : (
                  subchapters.map((s, i) => (
                    <SelectItem key={`${s}-${i}`} value={s} className="focus:bg-[#3e3e42]">
                      {s}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Quiz options */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-[#cccccc]">
                <input
                  type="checkbox"
                  checked={timedEnabled}
                  onChange={(e) => setTimedEnabled(e.target.checked)}
                />
                Timed Quiz
              </label>
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={timeMinutes}
                  onChange={(e) => {
                    const v = Number.isNaN(parseInt(e.target.value)) ? 0 : parseInt(e.target.value)
                    const clamped = Math.max(0, Math.min(59, v))
                    setTimeMinutes(clamped)
                  }}
                  disabled={!timedEnabled}
                  className="w-14 bg-[#2d2d30] border border-[#3e3e42] text-[#cccccc] rounded px-2 py-1 disabled:opacity-50"
                />
                <span className="text-[#cccccc]">:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={timeSeconds}
                  onChange={(e) => {
                    const v = Number.isNaN(parseInt(e.target.value)) ? 0 : parseInt(e.target.value)
                    const clamped = Math.max(0, Math.min(59, v))
                    setTimeSeconds(clamped)
                  }}
                  disabled={!timedEnabled}
                  className="w-14 bg-[#2d2d30] border border-[#3e3e42] text-[#cccccc] rounded px-2 py-1 disabled:opacity-50"
                />
                <span className="text-[#969696]">mm:ss</span>
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#cccccc] mb-2">Number of Questions</label>
              <Select onValueChange={(v: string) => setNumQuestions(parseInt(v))} value={String(numQuestions)}>
                <SelectTrigger className="w-full bg-[#2d2d30] border-[#3e3e42] text-[#cccccc]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2d2d30] border-[#3e3e42] text-[#cccccc] max-h-60 overflow-auto">
                  {Array.from({ length: 18 }, (_, i) => i + 3).map((n) => (
                    <SelectItem key={n} value={String(n)} className="focus:bg-[#3e3e42]">
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 justify-center">
            <Button className="bg-[#007acc] hover:bg-[#005a9e]" onClick={startGeneration} disabled={!selectedSubchapter}>
              Generate Quiz
            </Button>
          </div>
          {!contextText && <div className="text-xs text-[#969696]">Select a chapter to get started!</div>}
        <div className="pt-2 border-t border-[#3e3e42]">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-[#ffffff]">Previous Quizzes</h4>
            {prevLoading && (
              <div className="text-[10px] text-[#969696] flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading
              </div>
            )}
          </div>
          {prevError && <div className="text-[10px] text-[#ff6b6b] mb-2">{prevError}</div>}
          {(!previousQuizzes || previousQuizzes.length === 0) && !prevLoading ? (
            <div className="text-xs text-[#969696]">No saved quizzes yet</div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-auto pr-1 show-scrollbar">
              {previousQuizzes.map((d, idx) => (
                <div key={d?._id || idx} className="group relative">
                  <div
                    role="button"
                    tabIndex={0}
                    className="w-full text-left px-3 py-2 rounded bg-[#2d2d30] hover:bg-[#3e3e42] border border-[#3e3e42]"
                    onClick={() => loadQuiz(d)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); loadQuiz(d) } }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-[#ffffff] truncate">{d?.hint || "Untitled quiz"}</div>
                        <div className="text-[10px] text-[#969696] truncate">{new Date((d?.created_time ?? 0) * 1000).toLocaleString()}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-[11px] text-[#cccccc] whitespace-nowrap">{Array.isArray(d?.quiz) ? d.quiz.length : 0} questions</div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MenuButton
                            id={d?._id}
                            kind="quizzes"
                            item={d}
                            onOptimisticRemove={(id) => setPreviousQuizzes((prev) => prev.filter((x) => x?._id !== id))}
                            onFailureRestore={(id, item) => setPreviousQuizzes((prev) => [item, ...prev])}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>
    )
  }

  if (stage === "loading") {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-[#cccccc]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Generating your quiz…</span>
        </div>
      </div>
    )
  }

  if (stage === "quiz") {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-[#3e3e42] flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="px-2 py-1 bg-[#2d2d30] text-[#cccccc] hover:bg-[#3e3e42] rounded"
            onClick={() => setStage("menu")}
          >
            Back
          </Button>
          {selectedSubchapter && <span className="ml-2 text-xs text-[#969696] truncate">{selectedSubchapter}</span>}
          {timedEnabled && (
            <div className="ml-auto text-xs px-2 py-1 rounded bg-[#3e3e42] text-[#ffffff]">
              {formatTime(remainingSeconds ?? timeMinutes * 60 + timeSeconds)}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-4 show-scrollbar">
          {questions.map((q, qi) => (
            <Card key={qi} className="bg-[#2d2d30] border-[#3e3e42]">
              <CardContent className="p-3">
                <div className="text-sm text-[#ffffff] mb-3 whitespace-pre-wrap break-words">{qi + 1}. {q.question}</div>
                <div className="space-y-2">
                  {q.choices.map((choice, ci) => {
                    const active = answers[qi] === ci
                    return (
                      <Button
                        key={ci}
                        variant={active ? "default" : "outline"}
                        className={`w-full justify-start h-auto py-2 text-left whitespace-normal break-words ${active ? "bg-[#007acc] hover:bg-[#005a9e]" : "bg-[#2d2d30] border-[#3e3e42] text-[#cccccc] hover:bg-[#3e3e42] hover:text-[#ffffff]"}`}
                        onClick={() => setAnswers((prev) => prev.map((a, idx) => (idx === qi ? ci : a)))}
                      >
                        <div className="flex items-start gap-2 min-w-0 w-full">
                          <span className="flex-shrink-0">{String.fromCharCode(65 + ci)}.</span>
                          <span className="min-w-0 whitespace-normal break-words text-left">{choice}</span>
                        </div>
                      </Button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="p-3 border-t border-[#3e3e42] flex justify-end">
          <Button className="bg-[#4ec9b0] hover:bg-[#3a9b85]" onClick={submitQuiz} disabled={answers.some((a) => a < 0)}>
            Submit
          </Button>
        </div>
      </div>
    )
  }

  // summary
  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-[#3e3e42] flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="px-2 py-1 bg-[#2d2d30] text-[#cccccc] hover:bg-[#3e3e42] rounded"
          onClick={() => setStage("menu")}
        >
          Back
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="px-2 py-1 bg-[#2d2d30] text-[#cccccc] hover:bg-[#3e3e42] rounded"
            onClick={() => setShowCorrectAnswers((v) => !v)}
          >
            {showCorrectAnswers ? "Hide Answers" : "Show Answers"}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4 show-scrollbar">
        <Card className="bg-[#2d2d30] border-[#3e3e42]">
          <CardContent className="p-4">
            <div className="text-[#ffffff] text-sm mb-2">Your Score</div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-2xl font-bold text-[#4ec9b0]">{score} / {questions.length}</div>
              <Button className="bg-[#007acc] hover:bg-[#005a9e]" size="sm" onClick={retryQuiz}>Retry Quiz</Button>
            </div>
          </CardContent>
        </Card>

        {questions.map((q, qi) => {
          const user = answers[qi]
          const correct = q.answer
          const isCorrect = user === correct
          return (
            <Card key={qi} className="bg-[#2d2d30] border-[#3e3e42]">
              <CardContent className="p-3">
                <div className="text-sm text-[#ffffff] mb-2 whitespace-pre-wrap break-words">{qi + 1}. {q.question}</div>
                <div className="grid grid-cols-1 gap-1">
                  {q.choices.map((c, ci) => {
                    const show = showCorrectAnswers
                    const base = "text-xs px-2 py-1 rounded whitespace-normal break-words"
                    const cls = show
                      ? (ci === correct
                        ? `${base} bg-[#1e3a2f] text-[#4ec9b0]`
                        : ci === user
                          ? (isCorrect ? `${base} bg-[#1e3a2f] text-[#4ec9b0]` : `${base} bg-[#3a1e1e] text-[#f28b82]`)
                          : `${base} text-[#cccccc]`)
                      : (ci === user ? `${base} bg-[#3e3e42] text-[#cccccc]` : `${base} text-[#cccccc]`)
                    return (
                      <div key={ci} className={cls}>
                        <div className="flex items-start gap-2 min-w-0 w-full">
                          <span className="flex-shrink-0">{String.fromCharCode(65 + ci)}.</span>
                          <span className="min-w-0 whitespace-normal break-words text-left">{c}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}


