"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, User, Lock, Eye, EyeOff } from "lucide-react"

export default function LoginForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [loginData, setLoginData] = useState({ username: "", password: "" })
  const { toast } = useToast()
  const [showLoginPassword, setShowLoginPassword] = useState(false)

  const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
    try {
      const data: any = await response.json()
      if (typeof data?.detail === "string") return data.detail
      if (typeof data?.message === "string") return data.message
      return fallback
    } catch {
      return fallback
    }
  }

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setLoginData((prev) => ({ ...prev, [name]: value }))
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL
      const response = await fetch(`${backendUrl}/api/v1/auth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          username: loginData.username,
          password: loginData.password,
        }),
      })

      if (!response.ok) {
        const message = await readErrorMessage(response, "Login failed")
        throw new Error(message || "Login failed")
      }
      const data = await response.json()
      const { access_token } = data
      if (access_token) {
        localStorage.setItem("access_token", access_token)
      }

      toast({
        title: "Login Successful",
        description: "You have been logged in successfully.",
      })

      window.location.href = "/"
    } catch (error: any) {
      console.error("Login error:", error)
      toast({
        title: "Login Failed",
        description: error?.message || "The authentication service is currently unavailable. Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="bg-background-secondary border-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-foreground text-lg">Welcome back</CardTitle>
        <CardDescription className="text-foreground-muted">
          Enter your credentials to access your account
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleLogin}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-foreground-secondary text-sm font-medium">
              Username
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-foreground-muted" />
              <Input
                id="username"
                name="username"
                value={loginData.username}
                onChange={handleLoginChange}
                className="pl-10 bg-background-surface border-border text-foreground-secondary placeholder-foreground-muted focus:border-primary focus:ring-primary"
                placeholder="Enter your username"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground-secondary text-sm font-medium">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-foreground-muted" />
              <Input
                id="password"
                name="password"
                type={showLoginPassword ? "text" : "password"}
                value={loginData.password}
                onChange={handleLoginChange}
                className="pl-10 pr-10 bg-background-surface border-border text-foreground-secondary placeholder-foreground-muted focus:border-primary focus:ring-primary"
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                aria-label={showLoginPassword ? "Hide password" : "Show password"}
                onClick={() => setShowLoginPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground-secondary"
              >
                {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="pt-4">
          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary-hover text-foreground transition-colors"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}


