"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowLeft, ArrowRight, Globe, Lock, BookOpen, Plus, X,
  Loader2, Upload, Search, Check, ChevronLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"

const SUBJECT_OPTIONS = [
  "Mathematics", "Computer Science", "Physics", "Chemistry",
  "Biology", "Engineering", "Business", "Economics",
  "Humanities", "Social Sciences", "Languages",
  "Medicine", "Health Sciences", "Other",
] as const

const STEPS = ["basic-info", "visibility", "textbooks", "review"] as const
type StepId = (typeof STEPS)[number]

interface TextbookItem {
  id: string
  title: string
  author?: string
  code?: string
  isNew?: boolean
}

interface CourseFormData {
  title: string
  description: string
  subject: string
  instructorName: string
  viewType: "public" | "private"
  textbooks: TextbookItem[]
}

interface CreateCourseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCourseCreated: () => void
}

// ── Progress Dots ────────────────────────────────────────────────────────

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-2 w-2 rounded-full transition-colors",
            i === current ? "bg-primary" : "bg-border",
          )}
        />
      ))}
    </div>
  )
}

// ── Step 1: Basic Info ───────────────────────────────────────────────────

function StepBasicInfo({
  data,
  onChange,
}: {
  data: CourseFormData
  onChange: (field: keyof CourseFormData, value: any) => void
}) {
  return (
    <>
      <CardHeader className="pb-4">
        <CardTitle className="text-foreground text-lg">Course Details</CardTitle>
        <CardDescription className="text-foreground-muted">
          Set up the basics of your course
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-foreground-secondary text-sm font-medium">Course Title</Label>
          <Input
            value={data.title}
            onChange={(e) => onChange("title", e.target.value)}
            className="bg-background-surface border-border text-foreground-secondary placeholder-foreground-muted focus:border-primary"
            placeholder="e.g., Introduction to Computer Science"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-foreground-secondary text-sm font-medium">Instructor Display Name</Label>
          <Input
            value={data.instructorName}
            onChange={(e) => onChange("instructorName", e.target.value)}
            className="bg-background-surface border-border text-foreground-secondary placeholder-foreground-muted focus:border-primary"
            placeholder="Professor Smith"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-foreground-secondary text-sm font-medium">Description</Label>
          <Textarea
            value={data.description}
            onChange={(e) => onChange("description", e.target.value)}
            className="bg-background-surface border-border text-foreground-secondary placeholder-foreground-muted focus:border-primary min-h-[80px]"
            placeholder="Describe what students will learn..."
          />
        </div>

        <div className="space-y-2">
          <Label className="text-foreground-secondary text-sm font-medium">Subject Tags</Label>
          <div className="flex flex-wrap gap-2">
            {SUBJECT_OPTIONS.map((subject) => (
              <button
                key={subject}
                type="button"
                onClick={() => onChange("subject", data.subject === subject ? "" : subject)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  data.subject === subject
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background-surface text-foreground-secondary hover:border-primary/50",
                )}
              >
                {subject}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </>
  )
}

// ── Step 2: Visibility ───────────────────────────────────────────────────

function StepVisibility({
  viewType,
  onSelect,
}: {
  viewType: "public" | "private"
  onSelect: (v: "public" | "private") => void
}) {
  return (
    <>
      <CardHeader className="pb-4">
        <CardTitle className="text-foreground text-lg">Course Visibility</CardTitle>
        <CardDescription className="text-foreground-muted">
          Choose who can discover your course
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <button
          type="button"
          onClick={() => onSelect("public")}
          className={cn(
            "w-full flex items-center gap-4 rounded-lg border p-4 text-left transition-colors",
            viewType === "public"
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border bg-background-surface text-foreground-secondary hover:border-primary/50",
          )}
        >
          <Globe className="h-6 w-6 shrink-0" />
          <div>
            <p className="font-medium">Public</p>
            <p className="text-sm text-foreground-muted">
              Anyone can browse and enroll in this course
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onSelect("private")}
          className={cn(
            "w-full flex items-center gap-4 rounded-lg border p-4 text-left transition-colors",
            viewType === "private"
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border bg-background-surface text-foreground-secondary hover:border-primary/50",
          )}
        >
          <Lock className="h-6 w-6 shrink-0" />
          <div>
            <p className="font-medium">Private</p>
            <p className="text-sm text-foreground-muted">
              Students need a 6-character invite code to join
            </p>
          </div>
        </button>
      </CardContent>
    </>
  )
}

// ── Step 3: Textbooks ────────────────────────────────────────────────────

function StepTextbooks({
  textbooks,
  onAdd,
  onRemove,
}: {
  textbooks: TextbookItem[]
  onAdd: (tb: TextbookItem) => void
  onRemove: (id: string) => void
}) {
  const [mode, setMode] = useState<"menu" | "search" | "code" | "upload">("menu")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<TextbookItem[]>([])
  const [searching, setSearching] = useState(false)
  const [codeValue, setCodeValue] = useState("")
  const [codeLooking, setCodeLooking] = useState(false)
  const [uploadForm, setUploadForm] = useState({ title: "", author: "", subject: "" })
  const [uploading, setUploading] = useState(false)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const { toast } = useToast()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL
  const getToken = () =>
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null

  const fetchSearchResults = async (query: string) => {
    setSearching(true)
    try {
      const token = getToken()
      const resp = await fetch(
        `${backendUrl}/api/v1/textbooks/search?q=${encodeURIComponent(query)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      )
      if (!resp.ok) {
        setSearchResults([])
        return
      }
      const data = await resp.json()
      setSearchResults(
        (data.textbooks || []).map((t: any) => ({
          id: t.id,
          title: t.title,
          author: t.author,
          code: t.code,
        }))
      )
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleSearchInput = (value: string) => {
    setSearchQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 3) {
      setSearchResults([])
      return
    }
    debounceRef.current = setTimeout(() => fetchSearchResults(value.trim()), 500)
  }

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  const handleCodeSubmit = async () => {
    const code = codeValue.trim().toUpperCase()
    if (code.length !== 6) {
      toast({ title: "Invalid code", description: "Please enter a full 6-character code.", variant: "destructive" })
      return
    }
    setCodeLooking(true)
    try {
      const token = getToken()
      const resp = await fetch(
        `${backendUrl}/api/v1/textbooks/search?q=${encodeURIComponent(code)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      )
      if (!resp.ok) {
        toast({ title: "Lookup failed", description: "Could not look up textbook code. Please try again.", variant: "destructive" })
        return
      }
      const data = await resp.json()
      const match = (data.textbooks || [])[0]
      if (match) {
        onAdd({ id: match.id, title: match.title, author: match.author, code: match.code })
        toast({ title: "Textbook added", description: match.title })
        setCodeValue("")
        setMode("menu")
      } else {
        toast({ title: "Not found", description: "No textbook matches that code. Check the code and try again.", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to look up textbook", variant: "destructive" })
    } finally {
      setCodeLooking(false)
    }
  }

  const handleUpload = async () => {
    if (!uploadForm.title.trim()) {
      toast({ title: "Missing title", description: "Please enter a title", variant: "destructive" })
      return
    }
    setUploading(true)
    try {
      const token = getToken()
      const resp = await fetch(`${backendUrl}/api/v1/textbooks/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: uploadForm.title,
          author: uploadForm.author || null,
          subject: uploadForm.subject || null,
        }),
      })
      if (!resp.ok) throw new Error("Upload failed")
      const data = await resp.json()

      // Upload the PDF if one was selected
      if (pdfFile && data.upload_url) {
        await fetch(data.upload_url, {
          method: "PUT",
          headers: { "Content-Type": "application/pdf" },
          body: pdfFile,
        })
      }

      onAdd({
        id: data.textbook_id,
        title: uploadForm.title,
        author: uploadForm.author,
        code: data.code,
        isNew: true,
      })
      toast({ title: "Textbook created", description: `Code: ${data.code}` })
      setUploadForm({ title: "", author: "", subject: "" })
      setPdfFile(null)
      setMode("menu")
    } catch {
      toast({ title: "Error", description: "Failed to create textbook", variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <CardHeader className="pb-4">
        <CardTitle className="text-foreground text-lg">Add Textbooks</CardTitle>
        <CardDescription className="text-foreground-muted">
          Add existing textbooks or upload new ones to your course
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Added textbooks */}
        {textbooks.length > 0 && (
          <div className="space-y-2">
            <Label className="text-foreground-secondary text-sm font-medium">
              Added ({textbooks.length})
            </Label>
            {textbooks.map((tb) => (
              <div
                key={tb.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background-surface px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm text-foreground truncate">{tb.title}</span>
                  {tb.code && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-background-tertiary rounded text-foreground-muted">
                      {tb.code}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(tb.id)}
                  className="text-foreground-muted hover:text-foreground-secondary ml-2"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Action menu */}
        {mode === "menu" && (
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => setMode("search")}
              className="flex items-center gap-3 rounded-lg border border-border bg-background-surface p-3 text-left hover:border-primary/50 transition-colors"
            >
              <Search className="h-5 w-5 text-foreground-muted" />
              <div>
                <p className="text-sm font-medium text-foreground-secondary">Search existing textbooks</p>
                <p className="text-xs text-foreground-muted">Find by title or author</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMode("code")}
              className="flex items-center gap-3 rounded-lg border border-border bg-background-surface p-3 text-left hover:border-primary/50 transition-colors"
            >
              <BookOpen className="h-5 w-5 text-foreground-muted" />
              <div>
                <p className="text-sm font-medium text-foreground-secondary">Enter textbook code</p>
                <p className="text-xs text-foreground-muted">6-character code</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMode("upload")}
              className="flex items-center gap-3 rounded-lg border border-border bg-background-surface p-3 text-left hover:border-primary/50 transition-colors"
            >
              <Upload className="h-5 w-5 text-foreground-muted" />
              <div>
                <p className="text-sm font-medium text-foreground-secondary">Upload new textbook</p>
                <p className="text-xs text-foreground-muted">Create a new textbook with PDF</p>
              </div>
            </button>
          </div>
        )}

        {/* Search mode */}
        {mode === "search" && (
          <div className="space-y-3">
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
                <Input
                  placeholder="Type at least 3 characters to search..."
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  autoFocus
                  className="bg-background-surface border-border text-foreground-secondary placeholder-foreground-muted focus:border-primary pl-9"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-foreground-muted" />
                )}
              </div>

              {/* Dropdown results */}
              {searchQuery.trim().length >= 3 && (
                <div className="mt-1 rounded-lg border border-border bg-background-surface shadow-lg max-h-48 overflow-y-auto">
                  {searching && searchResults.length === 0 && (
                    <div className="px-3 py-4 text-center text-sm text-foreground-muted">
                      Searching...
                    </div>
                  )}
                  {!searching && searchResults.length === 0 && (
                    <div className="px-3 py-4 text-center text-sm text-foreground-muted">
                      No textbooks found
                    </div>
                  )}
                  {searchResults.map((tb) => {
                    const alreadyAdded = textbooks.some((t) => t.id === tb.id)
                    return (
                      <button
                        key={tb.id}
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => { onAdd(tb); setSearchResults([]); setSearchQuery("") }}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors border-b border-border last:border-b-0",
                          alreadyAdded
                            ? "bg-primary/5 opacity-60 cursor-not-allowed"
                            : "hover:bg-background-tertiary cursor-pointer",
                        )}
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">{tb.title}</p>
                          <div className="flex items-center gap-2">
                            {tb.author && <p className="text-xs text-foreground-muted">{tb.author}</p>}
                            {tb.code && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-background-tertiary rounded text-foreground-muted">
                                {tb.code}
                              </span>
                            )}
                          </div>
                        </div>
                        {alreadyAdded && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setMode("menu"); setSearchResults([]); setSearchQuery("") }}
              className="text-foreground-muted"
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </div>
        )}

        {/* Code entry mode */}
        {mode === "code" && (
          <div className="space-y-3">
            <div className="flex justify-center py-2">
              <InputOTP
                maxLength={6}
                value={codeValue}
                onChange={(v: string) => setCodeValue(v.toUpperCase())}
              >
                <InputOTPGroup className="gap-3">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className="h-12 w-12 rounded-md border border-black bg-white text-black text-xl font-semibold uppercase"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setMode("menu"); setCodeValue("") }}
                className="text-foreground-muted"
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <div className="flex-1" />
              <Button
                type="button"
                size="sm"
                onClick={handleCodeSubmit}
                disabled={codeValue.length !== 6 || codeLooking}
                className="bg-primary hover:bg-primary-hover text-white"
              >
                {codeLooking ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Looking up...</>
                ) : (
                  "Add Textbook"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Upload mode */}
        {mode === "upload" && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-foreground-secondary text-sm">Title *</Label>
              <Input
                value={uploadForm.title}
                onChange={(e) => setUploadForm((p) => ({ ...p, title: e.target.value }))}
                className="bg-background-surface border-border text-foreground-secondary placeholder-foreground-muted focus:border-primary"
                placeholder="Textbook title"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground-secondary text-sm">Author</Label>
              <Input
                value={uploadForm.author}
                onChange={(e) => setUploadForm((p) => ({ ...p, author: e.target.value }))}
                className="bg-background-surface border-border text-foreground-secondary placeholder-foreground-muted focus:border-primary"
                placeholder="Author name"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground-secondary text-sm">Subject</Label>
              <Input
                value={uploadForm.subject}
                onChange={(e) => setUploadForm((p) => ({ ...p, subject: e.target.value }))}
                className="bg-background-surface border-border text-foreground-secondary placeholder-foreground-muted focus:border-primary"
                placeholder="e.g., Physics"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground-secondary text-sm">PDF File</Label>
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                className="bg-background-surface border-border text-foreground-secondary file:text-foreground-secondary"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMode("menu")}
                className="text-foreground-muted"
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleUpload}
                disabled={uploading}
                className="bg-primary hover:bg-primary-hover text-white"
              >
                {uploading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Uploading...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-1" /> Create Textbook</>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </>
  )
}

// ── Step 4: Review ───────────────────────────────────────────────────────

function StepReview({ data }: { data: CourseFormData }) {
  return (
    <>
      <CardHeader className="pb-4">
        <CardTitle className="text-foreground text-lg">Review Your Course</CardTitle>
        <CardDescription className="text-foreground-muted">
          Confirm the details before creating
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border bg-background-surface p-4 space-y-3">
          <div>
            <p className="text-xs text-foreground-muted">Title</p>
            <p className="text-sm text-foreground font-medium">{data.title || "—"}</p>
          </div>
          {data.description && (
            <div>
              <p className="text-xs text-foreground-muted">Description</p>
              <p className="text-sm text-foreground-secondary">{data.description}</p>
            </div>
          )}
          {data.subject && (
            <div>
              <p className="text-xs text-foreground-muted">Subject Tags</p>
              <p className="text-sm text-foreground-secondary">{data.subject}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-foreground-muted">Instructor</p>
            <p className="text-sm text-foreground-secondary">{data.instructorName || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-foreground-muted">Visibility</p>
            <p className="text-sm text-foreground-secondary capitalize">{data.viewType}</p>
          </div>
          <div>
            <p className="text-xs text-foreground-muted">Textbooks ({data.textbooks.length})</p>
            {data.textbooks.length === 0 ? (
              <p className="text-sm text-foreground-muted italic">None added</p>
            ) : (
              <ul className="text-sm text-foreground-secondary space-y-1 mt-1">
                {data.textbooks.map((tb) => (
                  <li key={tb.id} className="flex items-center gap-2">
                    <BookOpen className="h-3 w-3 text-primary" />
                    {tb.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </CardContent>
    </>
  )
}

// ── Main Dialog ──────────────────────────────────────────────────────────

export function CreateCourseDialog({ open, onOpenChange, onCourseCreated }: CreateCourseDialogProps) {
  const { toast } = useToast()
  const [step, setStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState<CourseFormData>({
    title: "",
    description: "",
    subject: "",
    instructorName: "",
    viewType: "public",
    textbooks: [],
  })

  const currentStep = STEPS[step]
  const isFirst = step === 0
  const isLast = step === STEPS.length - 1

  const handleChange = (field: keyof CourseFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const addTextbook = (tb: TextbookItem) => {
    setFormData((prev) => {
      if (prev.textbooks.some((t) => t.id === tb.id)) return prev
      return { ...prev, textbooks: [...prev.textbooks, tb] }
    })
  }

  const removeTextbook = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      textbooks: prev.textbooks.filter((t) => t.id !== id),
    }))
  }

  const canAdvance = () => {
    if (currentStep === "basic-info") {
      return formData.title.trim().length > 0 && formData.instructorName.trim().length > 0
    }
    return true
  }

  const goNext = () => {
    if (!isLast && canAdvance()) setStep((s) => s + 1)
  }

  const goBack = () => {
    if (!isFirst) setStep((s) => s - 1)
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null
      const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL

      const body = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        subject: formData.subject || null,
        view_type: formData.viewType,
        instructor_name: formData.instructorName.trim(),
        textbooks: formData.textbooks.map((t) => t.id),
      }

      const resp = await fetch(`${backendUrl}/api/v1/courses/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.detail || "Failed to create course")
      }

      const result = await resp.json()
      const inviteMsg = result.invite_code
        ? ` Invite code: ${result.invite_code}`
        : ""

      toast({
        title: "Course Created",
        description: `"${formData.title}" has been created.${inviteMsg}`,
      })

      onCourseCreated()
      onOpenChange(false)

      // Reset form
      setStep(0)
      setFormData({
        title: "",
        description: "",
        subject: "",
        instructorName: "",
        viewType: "public",
        textbooks: [],
      })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case "basic-info":
        return <StepBasicInfo data={formData} onChange={handleChange} />
      case "visibility":
        return (
          <StepVisibility
            viewType={formData.viewType}
            onSelect={(v) => handleChange("viewType", v)}
          />
        )
      case "textbooks":
        return (
          <StepTextbooks
            textbooks={formData.textbooks}
            onAdd={addTextbook}
            onRemove={removeTextbook}
          />
        )
      case "review":
        return <StepReview data={formData} />
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border text-foreground-secondary p-0 max-w-lg [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">Create New Course</DialogTitle>
        <Card className="bg-transparent border-0 shadow-none">
          {/* Back caret + progress dots */}
          <div className="flex items-center px-6 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-foreground-muted hover:text-foreground-secondary transition-colors"
              aria-label="Close"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex-1" />
            <ProgressDots current={step} total={STEPS.length} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (isLast) handleSubmit()
              else goNext()
            }}
          >
            {renderStep()}

            <CardFooter className="pt-4 flex items-center gap-2">
              {!isFirst && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={goBack}
                  className="border-border text-foreground-secondary hover:text-foreground"
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
              )}

              <div className="flex-1" />

              {isLast ? (
                <Button
                  type="submit"
                  className="bg-primary hover:bg-primary-hover text-foreground transition-colors"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
                  ) : (
                    "Create Course"
                  )}
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="bg-primary hover:bg-primary-hover text-foreground transition-colors"
                  disabled={!canAdvance()}
                >
                  Next
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </CardFooter>
          </form>
        </Card>
      </DialogContent>
    </Dialog>
  )
}
