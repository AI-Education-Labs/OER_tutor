"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { BookOpen, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CourseDashboard } from "@/components/courses/course-dashboard"
import { TutorialProvider } from "@/components/tutorial/tutorial-provider"
import { TutorialReplayButton } from "@/components/tutorial/tutorial-replay-button"
import { dashboardTutorial } from "@/config/tutorial/dashboard-steps"
import { getValidTokenPayload } from "@/lib/auth"
import type { UserRole } from "@/config/tutorial/types"

const AVATAR_COLORS = ["#ef4444", "#f97316", "#3b82f6", "#22c55e", "#a855f7"] as const

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  const raw = name || "??"
  const first = raw[0].toUpperCase()
  const second = raw.length > 1 ? raw[1].toLowerCase() : ""
  return first + second
}

export default function DashboardPage() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userRole, setUserRole] = useState<string>("student")
  const [userName, setUserName] = useState<string>("")

  useEffect(() => {
    const payload = getValidTokenPayload()
    if (payload) {
      setIsLoggedIn(true)
      if (payload.role) setUserRole(payload.role)
      if (payload.username) setUserName(payload.username)
    }
  }, [])

  const handleLogin = () => {
    router.push("/auth")
  }

  const handleLogout = () => {
    localStorage.removeItem("access_token")
    setIsLoggedIn(false)
    router.push("/")
  }

  const avatarColor = getAvatarColor(userName)

  return (
    <TutorialProvider
      tutorialConfig={dashboardTutorial}
      userRole={userRole as UserRole}
      beforeShowHandlers={{}}
    >
    <div className="flex min-h-screen flex-col">
      {/* VSCode-style Header */}
      <header className="sticky top-0 z-50 h-8 bg-background-tertiary border-b border-background-tertiary flex items-center px-4 flex-shrink-0">
        {/* Left side - App icon and title */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push("/")}>
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground-secondary">TextbookAI</span>
        </div>

        {/* Center */}
        <div className="flex-1" />

        {/* Right side - Auth buttons */}
        <div className="flex items-center gap-2">
          {isLoggedIn && <TutorialReplayButton />}
          {isLoggedIn ? (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 focus:ring-offset-background-tertiary"
                  style={{
                    background: `linear-gradient(135deg, ${avatarColor}50, white)`,
                  }}
                >
                  {getInitials(userName)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[140px]">
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogin}
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

      {/* Main Content */}
      <main className="flex-1 bg-background min-h-0">
        <CourseDashboard isAuthenticated={isLoggedIn} userRole={userRole} />
      </main>
    </div>
    </TutorialProvider>
  )
}
