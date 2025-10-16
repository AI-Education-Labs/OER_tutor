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
    <div className="min-h-screen bg-[#1e1e1e] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" aria-label="Go to home" className="flex items-center justify-center gap-2 mb-4">
            <BookOpen className="h-8 w-8 text-[#007acc]" />
            <h1 className="text-2xl font-semibold text-[#ffffff]">TextbookAI</h1>
          </Link>
          <p className="text-[#969696] text-sm">Access your interactive learning platform</p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-[#2d2d30] border border-[#3e3e42] p-1">
            <TabsTrigger
              value="login"
              className="data-[state=active]:bg-[#007acc] data-[state=active]:text-white text-[#cccccc] hover:text-white transition-colors"
            >
              Sign In
            </TabsTrigger>
            <TabsTrigger
              value="register"
              className="data-[state=active]:bg-[#007acc] data-[state=active]:text-white text-[#cccccc] hover:text-white transition-colors"
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
