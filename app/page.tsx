"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { BookOpen, LogOut, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LandingPage } from "@/components/landing-page"

export default function HomePage() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (token) {
      setIsLoggedIn(true)
      router.push("/dashboard")
    }
  }, [router])

  const handleLogin = () => {
    router.push("/auth")
  }

  const handleLogout = () => {
    localStorage.removeItem("access_token")
    setIsLoggedIn(false)
    window.location.reload()
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* VSCode-style Header */}
      <header className="sticky top-0 z-50 h-8 bg-background-tertiary border-b border-background-tertiary flex items-center px-4 flex-shrink-0">
        {/* Left side - App icon and title */}
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground-secondary">TextbookAI</span>
        </div>

        {/* Center */}
        <div className="flex-1" />

        {/* Right side - Auth buttons */}
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
        <LandingPage />
      </main>
    </div>
  )
}
