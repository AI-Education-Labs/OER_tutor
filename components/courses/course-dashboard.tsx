"use client"

import { useEffect, useState } from "react"
import { Search, Plus, BookOpen, Users, LogIn, KeyRound, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { CreateCourseDialog } from "@/components/courses/create-course-dialog"

interface CourseCard {
  id: string
  title: string
  description?: string
  subject?: string
  view_type: string
  invite_code?: string
  instructor_name: string
  student_count: number
  textbook_count: number
  cover_url?: string
  is_enrolled: boolean
  is_owner?: boolean
}

interface CourseDashboardProps {
  isAuthenticated: boolean
  userRole: string
}

export function CourseDashboard({ isAuthenticated, userRole }: CourseDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [myCourses, setMyCourses] = useState<CourseCard[]>([])
  const [browseCourses, setBrowseCourses] = useState<CourseCard[]>([])
  const [loading, setLoading] = useState(true)
  const [joinDialogOpen, setJoinDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [codeValue, setCodeValue] = useState("")
  const [activeTab, setActiveTab] = useState(isAuthenticated ? "my-courses" : "browse")
  const { toast } = useToast()

  const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL

  const getToken = () =>
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null

  const authHeaders = (): Record<string, string> => {
    const token = getToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  const loadMyCourses = async () => {
    if (!isAuthenticated) return
    try {
      const resp = await fetch(`${backendUrl}/api/v1/courses/my-courses`, {
        headers: authHeaders(),
      })
      if (!resp.ok) return
      const data = await resp.json()
      setMyCourses(data.courses || [])
    } catch (e) {
      console.error("Failed to load my courses", e)
    }
  }

  const loadBrowseCourses = async () => {
    try {
      const resp = await fetch(`${backendUrl}/api/v1/courses/list`, {
        headers: authHeaders(),
      })
      if (!resp.ok) return
      const data = await resp.json()
      setBrowseCourses(data.courses || [])
    } catch (e) {
      console.error("Failed to load browse courses", e)
    }
  }

  useEffect(() => {
    if (isAuthenticated) setActiveTab("my-courses")
  }, [isAuthenticated])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([loadMyCourses(), loadBrowseCourses()])
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  const filterCourses = (courses: CourseCard[]) => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return courses
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.subject || "").toLowerCase().includes(q) ||
        c.instructor_name.toLowerCase().includes(q)
    )
  }

  const handleEnroll = async (courseId: string) => {
    try {
      const resp = await fetch(`${backendUrl}/api/v1/courses/${courseId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
      })
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.detail || "Failed to enroll")
      }
      toast({ title: "Enrolled!", description: "You have been enrolled in the course." })
      await Promise.all([loadMyCourses(), loadBrowseCourses()])
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const handleJoinByCode = async (code: string) => {
    try {
      const resp = await fetch(`${backendUrl}/api/v1/courses/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ code: code.toUpperCase() }),
      })
      const data = await resp.json().catch(() => ({}))
      if (resp.ok && data.ok) {
        toast({ title: "Joined!", description: `Joined "${data.course_title || "course"}" successfully.` })
        await Promise.all([loadMyCourses(), loadBrowseCourses()])
      } else {
        toast({ title: "Invalid code", description: data.detail || "Could not join course.", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Could not join course. Try again.", variant: "destructive" })
    } finally {
      setJoinDialogOpen(false)
      setTimeout(() => setCodeValue(""), 200)
    }
  }

  const handleCourseCreated = () => {
    loadMyCourses()
    loadBrowseCourses()
  }

  const handleCopyInviteCode = (e: React.MouseEvent, code: string) => {
    e.preventDefault()
    e.stopPropagation()
    navigator.clipboard.writeText(code)
    toast({ title: "Copied!", description: `Invite code "${code}" copied to clipboard.` })
  }

  const renderCourseCard = (course: CourseCard, showEnroll = false) => (
    <Link key={course.id} href={`/course/${course.id}`}>
      <Card className="bg-background-tertiary border-border hover:border-primary transition-colors cursor-pointer group h-full overflow-hidden">
        <CardContent className="p-0 flex h-full">
          {/* Left: course details */}
          <div className="flex-1 p-4 flex flex-col min-w-0">
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-medium text-sm text-foreground line-clamp-2 flex-1">{course.title}</h3>
              <span className="flex items-center gap-1 text-xs text-foreground-muted ml-2 shrink-0">
                <Users className="w-3 h-3" />
                {course.student_count}
              </span>
            </div>

            {course.description && (
              <p className="text-xs text-foreground-muted mb-2 line-clamp-2">{course.description}</p>
            )}

            <p className="text-xs text-foreground-muted mb-1">{course.instructor_name}</p>

            <div className="mt-auto flex items-center justify-between pt-2">
              {course.subject ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                  {course.subject}
                </span>
              ) : (
                <span />
              )}
              {course.is_owner && course.invite_code && (
                <button
                  onClick={(e) => handleCopyInviteCode(e, course.invite_code!)}
                  className="p-1.5 rounded-full text-foreground-muted hover:bg-primary/10 hover:text-primary transition-colors"
                  title="Copy invite code"
                >
                  <Link2 className="w-3.5 h-3.5 rotate-[-45deg]" />
                </button>
              )}
            </div>

            {showEnroll && !course.is_enrolled && !course.is_owner && isAuthenticated && (
              <Button
                size="sm"
                className="mt-3 w-full bg-primary hover:bg-primary-hover text-white text-xs"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleEnroll(course.id)
                }}
              >
                Enroll
              </Button>
            )}
          </div>

          {/* Right: textbook cover */}
          <div className="w-28 shrink-0 overflow-hidden">
            {course.cover_url ? (
              <img
                src={course.cover_url}
                alt={course.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-full h-full bg-background-surface flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-foreground-muted/30" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )

  return (
    <div className="min-h-screen bg-background text-foreground-secondary">
      {/* Main content */}
      <div className="p-6">

        {/* Search + action buttons */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground-muted" />
            <Input
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background-tertiary border-border text-foreground-secondary placeholder-foreground-muted focus:border-primary"
            />
          </div>

          <div className="flex gap-2">
            {isAuthenticated && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setJoinDialogOpen(true)}
                className="border-border text-foreground-secondary hover:border-primary"
              >
                <KeyRound className="w-4 h-4 mr-1" />
                Join Course
              </Button>
            )}

            {isAuthenticated && userRole === "professor" && (
              <Button
                size="sm"
                onClick={() => setCreateDialogOpen(true)}
                className="bg-primary hover:bg-primary-hover text-white"
              >
                <Plus className="w-4 h-4 mr-1" />
                Create Course
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-background-tertiary border border-border">
            {isAuthenticated && (
              <TabsTrigger value="my-courses" className="data-[state=active]:bg-background-surface">
                My Courses
              </TabsTrigger>
            )}
            <TabsTrigger value="browse" className="data-[state=active]:bg-background-surface">
              Browse Courses
            </TabsTrigger>
          </TabsList>

          {/* My Courses tab */}
          {isAuthenticated && (
            <TabsContent value="my-courses">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                {!loading && filterCourses(myCourses).length === 0 && (
                  <Card className="bg-background-tertiary border-border flex items-center justify-center h-48">
                    <CardContent className="flex flex-col items-center justify-center text-center p-6">
                      <BookOpen className="w-8 h-8 text-foreground-muted mb-2" />
                      <div className="text-sm text-foreground-secondary mb-1">No courses yet</div>
                      <div className="text-xs text-foreground-muted">
                        Browse courses or join with an invite code
                      </div>
                    </CardContent>
                  </Card>
                )}

                {filterCourses(myCourses).map((c) => renderCourseCard(c))}

                {userRole === "professor" && (
                  <button onClick={() => setCreateDialogOpen(true)} className="h-full min-h-[12rem]">
                    <Card className="bg-[#232326] border-dashed border-2 border-border hover:border-primary transition-colors cursor-pointer flex items-center justify-center h-full">
                      <CardContent className="flex flex-col items-center justify-center p-6">
                        <div className="w-14 h-14 rounded-full border-2 border-dashed border-border flex items-center justify-center mb-3">
                          <Plus className="w-6 h-6 text-foreground-secondary" />
                        </div>
                        <div className="text-sm text-foreground-secondary">Create a course</div>
                      </CardContent>
                    </Card>
                  </button>
                )}
              </div>
            </TabsContent>
          )}

          {/* Browse Courses tab */}
          <TabsContent value="browse">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              {!isAuthenticated && (
                <Card className="bg-background-tertiary border-border flex items-center justify-center h-48">
                  <CardContent className="flex flex-col items-center justify-center text-center p-6">
                    <LogIn className="w-8 h-8 text-foreground-muted mb-2" />
                    <div className="text-sm text-foreground-secondary mb-3">Sign in to enroll in courses</div>
                    <Link href="/auth">
                      <Button size="sm" className="bg-primary hover:bg-primary-hover text-white">Sign in</Button>
                    </Link>
                  </CardContent>
                </Card>
              )}

              {!loading && filterCourses(browseCourses).length === 0 && isAuthenticated && (
                <Card className="bg-background-tertiary border-border flex items-center justify-center h-48">
                  <CardContent className="flex flex-col items-center justify-center text-center p-6">
                    <BookOpen className="w-8 h-8 text-foreground-muted mb-2" />
                    <div className="text-sm text-foreground-secondary">No public courses available yet</div>
                  </CardContent>
                </Card>
              )}

              {filterCourses(browseCourses).map((c) => renderCourseCard(c, true))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Join Course Dialog */}
      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent className="bg-background border-border text-foreground-secondary">
          <DialogHeader>
            <DialogTitle>Enter 6-Character Invite Code</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-2">
            <InputOTP
              maxLength={6}
              value={codeValue}
              onChange={(v: string) => {
                setCodeValue(v)
                if (v.length === 6) {
                  handleJoinByCode(v)
                }
              }}
            >
              <InputOTPGroup className="gap-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="h-12 w-12 rounded-md border border-black bg-white text-black text-xl font-semibold"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Course Dialog */}
      <CreateCourseDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCourseCreated={handleCourseCreated}
      />
    </div>
  )
}
