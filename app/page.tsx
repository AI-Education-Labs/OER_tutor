"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { BookOpen, LogOut, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { TextbookLibrary } from "@/components/textbook-library"

export default function HomePage() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    fetch("/api/auth/status", {
      method: "GET",
      credentials: "include",
    })
      .then((response) => {
        if (response.status === 200) {
          setIsLoggedIn(true)
        } else {
          setIsLoggedIn(false)
        }
      })
      .catch((error) => {
        console.error("Error checking auth status:", error)
        setIsLoggedIn(false)
      })
  }, [])

  const handleLogin = () => {
    router.push("/auth")
  }

  const handleLogout = () => {
    fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    })
      .then((response) => {
        if (response.ok) {
          window.location.href = '/'
        } else {
          console.error("Logout failed")
        }
      })
      .catch((error) => {
        console.error("Error during logout:", error)
      })
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* VSCode-style Header */}
      <header className="sticky top-0 z-50 h-8 bg-[#323233] border-b border-[#2d2d30] flex items-center px-4 flex-shrink-0">
        {/* Left side - App icon and title */}
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[#007acc]" />
          <span className="text-sm font-medium text-[#cccccc]">TextbookAI</span>
        </div>

        {/* Center - Empty for now, could add breadcrumbs later */}
        <div className="flex-1" />

        {/* Right side - Auth buttons */}
        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="h-6 px-2 text-xs text-[#cccccc] hover:text-white hover:bg-[#3e3e42] transition-colors"
              >
                <LogOut className="h-3 w-3 mr-1" />
                Sign Out
              </Button>
              <div className="w-px h-4 bg-[#3e3e42]" />
              <Avatar className="h-6 w-6">
                <AvatarImage src="/placeholder.svg?height=24&width=24" alt="User" />
                <AvatarFallback className="text-xs bg-[#007acc] text-white">
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
                className="h-6 px-3 text-xs text-[#cccccc] hover:text-white hover:bg-[#3e3e42] transition-colors"
              >
                Sign In
              </Button>
              <Button
                size="sm"
                onClick={() => router.push("/auth?tab=register")}
                className="h-6 px-3 text-xs bg-[#007acc] hover:bg-[#005a9e] text-white transition-colors"
              >
                Sign Up
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 bg-[#1e1e1e] min-h-0">
        <TextbookLibrary />
      </main>
    </div>
  )
}
