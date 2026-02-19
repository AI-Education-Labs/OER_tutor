"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  BookOpen, Users, ArrowLeft, Globe, Lock,
  Pencil, Trash2, Plus, LogOut as LeaveIcon,
  Loader2, User, Link2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

interface CourseData {
  id: string
  title: string
  description?: string
  subject?: string
  view_type: string
  invite_code?: string
  instructor_id: string
  instructor_name: string
  textbooks: string[]
  student_count: number
  textbook_count: number
  is_enrolled: boolean
  is_owner: boolean
  created_at?: string
}

interface TextbookInfo {
  id: string
  title: string
  author?: string
  subject?: string
  cover?: string
}

interface StudentInfo {
  id: string
  username: string
  email: string
  role: string
}

interface CourseDetailProps {
  courseId: string
  isAuthenticated: boolean
  userRole: string
}

export function CourseDetail({ courseId, isAuthenticated, userRole }: CourseDetailProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [course, setCourse] = useState<CourseData | null>(null)
  const [textbooks, setTextbooks] = useState<TextbookInfo[]>([])
  const [students, setStudents] = useState<StudentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [showStudents, setShowStudents] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [addTextbookDialogOpen, setAddTextbookDialogOpen] = useState(false)
  const [addTextbookCode, setAddTextbookCode] = useState("")

  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    subject: "",
    instructor_name: "",
    view_type: "",
  })

  const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL
  const getToken = () =>
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null
  const authHeaders = (): Record<string, string> => {
    const token = getToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  const loadCourse = async () => {
    try {
      const resp = await fetch(`${backendUrl}/api/v1/courses/${courseId}`, {
        headers: authHeaders(),
      })
      if (!resp.ok) throw new Error("Course not found")
      const data = await resp.json()
      setCourse(data)

      setEditForm({
        title: data.title || "",
        description: data.description || "",
        subject: data.subject || "",
        instructor_name: data.instructor_name || "",
        view_type: data.view_type || "public",
      })

      // Load textbook details
      if (data.textbooks?.length > 0) {
        const tbPromises = data.textbooks.map((tbId: string) =>
          fetch(`${backendUrl}/api/v1/textbooks/${tbId}`, { headers: authHeaders() })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        )
        const tbResults = await Promise.all(tbPromises)
        setTextbooks(
          tbResults
            .filter(Boolean)
            .map((t: any) => ({
              id: t.id,
              title: t.title,
              author: t.author,
              subject: t.subject,
              cover: t.cover,
            }))
        )
      } else {
        setTextbooks([])
      }
    } catch (e) {
      console.error("Failed to load course", e)
      toast({ title: "Error", description: "Failed to load course", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const loadStudents = async () => {
    try {
      const resp = await fetch(`${backendUrl}/api/v1/courses/${courseId}/students`, {
        headers: authHeaders(),
      })
      if (resp.ok) {
        const data = await resp.json()
        setStudents(data.students || [])
      }
    } catch (e) {
      console.error("Failed to load students", e)
    }
  }

  useEffect(() => {
    loadCourse()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  const handleEnroll = async () => {
    setEnrolling(true)
    try {
      const resp = await fetch(`${backendUrl}/api/v1/courses/${courseId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
      })
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.detail || "Failed to enroll")
      }
      toast({ title: "Enrolled!", description: "You are now enrolled in this course." })
      await loadCourse()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setEnrolling(false)
    }
  }

  const handleUnenroll = async () => {
    try {
      const resp = await fetch(`${backendUrl}/api/v1/courses/${courseId}/unenroll`, {
        method: "DELETE",
        headers: authHeaders(),
      })
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.detail || "Failed to leave course")
      }
      toast({ title: "Left course", description: "You have left this course." })
      router.push("/dashboard")
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const handleEditSubmit = async () => {
    try {
      const body: Record<string, any> = {}
      if (editForm.title !== course?.title) body.title = editForm.title
      if (editForm.description !== (course?.description || "")) body.description = editForm.description
      if (editForm.subject !== (course?.subject || "")) body.subject = editForm.subject
      if (editForm.instructor_name !== course?.instructor_name) body.instructor_name = editForm.instructor_name
      if (editForm.view_type !== course?.view_type) body.view_type = editForm.view_type

      if (Object.keys(body).length === 0) {
        setEditDialogOpen(false)
        return
      }

      const resp = await fetch(`${backendUrl}/api/v1/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      })
      if (!resp.ok) throw new Error("Failed to update course")
      toast({ title: "Updated", description: "Course updated successfully." })
      setEditDialogOpen(false)
      await loadCourse()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const handleAddTextbook = async () => {
    const code = addTextbookCode.trim().toUpperCase()
    if (!code) return
    try {
      // Look up textbook by code via search
      const searchResp = await fetch(
        `${backendUrl}/api/v1/textbooks/search?q=${encodeURIComponent(code)}`,
        { headers: authHeaders() }
      )
      if (!searchResp.ok) throw new Error("Search failed")
      const searchData = await searchResp.json()
      const match = (searchData.textbooks || []).find((t: any) => t.code === code)
      if (!match) {
        toast({ title: "Not found", description: "No textbook found with that code", variant: "destructive" })
        return
      }

      const resp = await fetch(`${backendUrl}/api/v1/courses/${courseId}/textbooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ textbook_id: match.id }),
      })
      if (!resp.ok) throw new Error("Failed to add textbook")
      toast({ title: "Added", description: `${match.title} added to course.` })
      setAddTextbookDialogOpen(false)
      setAddTextbookCode("")
      await loadCourse()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const handleRemoveTextbook = async (textbookId: string) => {
    try {
      const resp = await fetch(`${backendUrl}/api/v1/courses/${courseId}/textbooks/${textbookId}`, {
        method: "DELETE",
        headers: authHeaders(),
      })
      if (!resp.ok) throw new Error("Failed to remove textbook")
      toast({ title: "Removed", description: "Textbook removed from course." })
      await loadCourse()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-foreground-muted">
        <BookOpen className="h-12 w-12 mb-4" />
        <p className="text-lg">Course not found</p>
        <Button variant="ghost" className="mt-4" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground-secondary">
      {/* Back button bar */}
      <div className="h-8 bg-background-tertiary border-b border-border flex items-center px-4">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground-secondary transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Dashboard
        </button>
        <div className="flex-1 text-center text-sm">{course.title}</div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {/* Course header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-semibold text-foreground">{course.title}</h1>
                {course.view_type === "private" ? (
                  <Lock className="h-4 w-4 text-foreground-muted" />
                ) : (
                  <Globe className="h-4 w-4 text-foreground-muted" />
                )}
              </div>
              <p className="text-sm text-foreground-muted mb-1">{course.instructor_name}</p>
              {course.subject && (
                <span className="text-xs text-accent-teal">{course.subject}</span>
              )}
            </div>

            <div className="flex items-center gap-3 text-sm text-foreground-muted">
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {course.student_count} students
              </span>
              <span className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                {course.textbook_count} textbooks
              </span>
            </div>
          </div>

          {/* Invite code (owner only) */}
          {course.is_owner && course.invite_code && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-background-surface border border-border px-3 py-1.5">
              <span className="text-xs text-foreground-muted">Invite Code:</span>
              <span className="text-sm font-mono font-semibold text-foreground">{course.invite_code}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(course.invite_code!)
                  toast({ title: "Copied!", description: `Invite code "${course.invite_code}" copied to clipboard.` })
                }}
                className="p-1.5 rounded-full hover:bg-primary/10 text-foreground-muted hover:text-primary transition-colors"
                title="Copy invite code"
              >
                <Link2 className="w-3.5 h-3.5 rotate-[-45deg]" />
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            {/* Enroll button (unenrolled students) */}
            {isAuthenticated && !course.is_enrolled && !course.is_owner && (
              <Button
                onClick={handleEnroll}
                disabled={enrolling}
                className="bg-primary hover:bg-primary-hover text-white"
              >
                {enrolling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enroll in Course
              </Button>
            )}

            {/* Enrolled indicator + leave */}
            {isAuthenticated && course.is_enrolled && !course.is_owner && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-primary font-medium">Enrolled</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnenroll}
                  className="border-border text-foreground-muted hover:text-red-400 hover:border-red-400"
                >
                  <LeaveIcon className="h-3 w-3 mr-1" />
                  Leave Course
                </Button>
              </div>
            )}

            {/* Professor actions */}
            {course.is_owner && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditDialogOpen(true)}
                  className="border-border text-foreground-secondary"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit Course
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowStudents(true); loadStudents() }}
                  className="border-border text-foreground-secondary"
                >
                  <Users className="h-3 w-3 mr-1" />
                  View Students
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        {course.description && (
          <div className="mb-8">
            <h2 className="text-lg font-medium text-foreground mb-2">About this course</h2>
            <div className="rounded-lg border border-border bg-background-surface p-4">
              <p className="text-sm text-foreground-secondary whitespace-pre-wrap">{course.description}</p>
            </div>
          </div>
        )}

        {/* Textbooks */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-foreground flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Course Textbooks ({textbooks.length})
            </h2>
            {course.is_owner && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddTextbookDialogOpen(true)}
                className="border-border text-foreground-secondary"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Textbook
              </Button>
            )}
          </div>

          {textbooks.length === 0 ? (
            <Card className="bg-background-tertiary border-border">
              <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                <BookOpen className="w-8 h-8 text-foreground-muted mb-2" />
                <p className="text-sm text-foreground-muted">No textbooks added yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {textbooks.map((tb) => (
                <div key={tb.id} className="relative group">
                  <Link href={`/study/${tb.id}`}>
                    <Card className="bg-background-tertiary border-border hover:border-primary transition-colors cursor-pointer">
                      <CardContent className="p-4">
                        {tb.cover && (
                          <img
                            src={tb.cover}
                            alt={tb.title}
                            className="w-full h-28 object-cover rounded mb-3 group-hover:scale-105 transition-transform"
                          />
                        )}
                        <h3 className="font-medium text-sm text-foreground line-clamp-2">{tb.title}</h3>
                        {tb.author && <p className="text-xs text-foreground-muted mt-1">{tb.author}</p>}
                        {tb.subject && <p className="text-xs text-accent-teal mt-1">{tb.subject}</p>}
                      </CardContent>
                    </Card>
                  </Link>
                  {course.is_owner && (
                    <button
                      onClick={() => handleRemoveTextbook(tb.id)}
                      className="absolute top-2 right-2 p-1 rounded bg-background/80 text-foreground-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Course Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-background border-border text-foreground-secondary">
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Title</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                className="bg-background-surface border-border text-foreground-secondary"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Instructor Name</Label>
              <Input
                value={editForm.instructor_name}
                onChange={(e) => setEditForm((p) => ({ ...p, instructor_name: e.target.value }))}
                className="bg-background-surface border-border text-foreground-secondary"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Description</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                className="bg-background-surface border-border text-foreground-secondary min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Subject Tags</Label>
              <Input
                value={editForm.subject}
                onChange={(e) => setEditForm((p) => ({ ...p, subject: e.target.value }))}
                className="bg-background-surface border-border text-foreground-secondary"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Visibility</Label>
              <div className="flex gap-2">
                {(["public", "private"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setEditForm((p) => ({ ...p, view_type: v }))}
                    className={`px-3 py-1.5 text-sm rounded-md border transition-colors capitalize ${
                      editForm.view_type === v
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background-surface text-foreground-secondary hover:border-primary/50"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="border-border">
              Cancel
            </Button>
            <Button onClick={handleEditSubmit} className="bg-primary hover:bg-primary-hover text-white">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Textbook Dialog */}
      <Dialog open={addTextbookDialogOpen} onOpenChange={setAddTextbookDialogOpen}>
        <DialogContent className="bg-background border-border text-foreground-secondary">
          <DialogHeader>
            <DialogTitle>Add Textbook by Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Textbook Code</Label>
              <Input
                value={addTextbookCode}
                onChange={(e) => setAddTextbookCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="Enter 6-character code"
                className="bg-background-surface border-border text-foreground-secondary font-mono text-center text-lg tracking-wider"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTextbookDialogOpen(false)} className="border-border">
              Cancel
            </Button>
            <Button
              onClick={handleAddTextbook}
              disabled={addTextbookCode.length !== 6}
              className="bg-primary hover:bg-primary-hover text-white"
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Students Dialog */}
      <Dialog open={showStudents} onOpenChange={setShowStudents}>
        <DialogContent className="bg-background border-border text-foreground-secondary max-w-md">
          <DialogHeader>
            <DialogTitle>Enrolled Students ({students.length})</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {students.length === 0 ? (
              <p className="text-sm text-foreground-muted text-center py-4">No students enrolled yet</p>
            ) : (
              students.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background-surface px-3 py-2"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-foreground font-medium truncate">{s.username}</p>
                    <p className="text-xs text-foreground-muted truncate">{s.email}</p>
                  </div>
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-background-tertiary text-foreground-muted capitalize">
                    {s.role}
                  </span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
