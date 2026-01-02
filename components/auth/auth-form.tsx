"use client"

import { useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BookOpen } from "lucide-react"
import LoginForm from "@/components/auth/login-form"
import RegisterForm from "@/components/auth/register-form"
import Link from "next/link"

export default function AuthForm() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const [tab, setTab] = useState(tabParam === "register" ? "register" : "login")

  // Keep tab in sync when user manually changes URL
  useEffect(() => {
    if (tabParam && tabParam !== tab) {
      setTab(tabParam)
    }
  }, [tabParam])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" aria-label="Go to home" className="flex items-center justify-center gap-2 mb-4">
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-semibold text-foreground">TextbookAI</h1>
          </Link>
          <p className="text-foreground-muted text-sm">Access your interactive learning platform</p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-background-tertiary border border-border p-1">
            <TabsTrigger
              value="login"
              className="data-[state=active]:bg-primary data-[state=active]:text-foreground text-foreground-secondary hover:text-foreground transition-colors"
            >
              Sign In
            </TabsTrigger>
            <TabsTrigger
              value="register"
              className="data-[state=active]:bg-primary data-[state=active]:text-foreground text-foreground-secondary hover:text-foreground transition-colors"
            >
              Sign Up
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-6">
            <LoginForm />
          </TabsContent>

          <TabsContent value="register" className="mt-6">
            <RegisterForm />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
