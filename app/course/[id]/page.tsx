"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { BookOpen, LogOut, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CourseDetail } from "@/components/courses/course-detail"

function parseJwt(token: string): Record<string, any> | null {
  try {
    const base64Url = token.split(".")[1]
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

export default function CourseDetailPage() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.id as string
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userRole, setUserRole] = useState<string>("student")

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (token) {
      setIsLoggedIn(true)
      const payload = parseJwt(token)
      if (payload?.role) setUserRole(payload.role)
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("access_token")
    setIsLoggedIn(false)
    router.push("/")
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* VSCode-style Header */}
      <header className="sticky top-0 z-50 h-8 bg-background-tertiary border-b border-background-tertiary flex items-center px-4 flex-shrink-0">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push("/dashboard")}>
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground-secondary">TextbookAI</span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="h-6 px-2 text-xs text-foreground-secondary hover:text-white hover:bg-background-surface transition-colors"
              >
                <LogOut className="h-3 w-3 mr-1" />
                Sign Out
              </Button>
              <div className="w-px h-4 bg-background-surface" />
              <Avatar className="h-6 w-6">
                <AvatarImage src="/placeholder.svg?height=24&width=24" alt="User" />
                <AvatarFallback className="text-xs bg-primary text-white">
                  <User className="h-3 w-3" />
                </AvatarFallback>
              </Avatar>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/auth")}
                className="h-6 px-3 text-xs text-foreground-secondary hover:text-white hover:bg-background-surface transition-colors"
              >
                Sign In
              </Button>
              <Button
                size="sm"
                onClick={() => router.push("/auth?tab=register")}
                className="h-6 px-3 text-xs bg-primary hover:bg-primary-hover text-white transition-colors"
              >
                Sign Up
              </Button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 bg-background min-h-0">
        <CourseDetail courseId={courseId} isAuthenticated={isLoggedIn} userRole={userRole} />
      </main>
    </div>
  )
}
