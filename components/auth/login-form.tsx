"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, User, Lock, Eye, EyeOff } from "lucide-react"
import useAuth from "@/hooks/use-auth"

export default function LoginForm() {
  const { login, lastError } = useAuth()
  const [loading, setLoading] = useState(false)
  const [loginData, setLoginData] = useState({ username: "", password: "" })
  const { toast } = useToast()
  const [localError, setLocalError] = useState<string | null>(null)
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setLocalError
    const result = await login({
          username: loginData.username,
          password: loginData.password,
      })
    
    setLoading(false)
    if (result.success) {
      toast({
        title: "Login Successful",
        description: "You have been logged in successfully.",
      })
      // wait a second so http cookie can be applied
      setTimeout(() => window.location.href = "/", 2000) // TODO: Redirect with built in router? not sure whats needed for auth issues
    }

    if (result.error) {
      toast({
        title: "Login Failed",
        variant: "destructive",
      })
    }

  }

  return (
    <Card className="bg-[#252526] border-[#3e3e42]">
      <CardHeader className="pb-4">
        <CardTitle className="text-[#ffffff] text-lg">Welcome back</CardTitle>
        <CardDescription className="text-[#969696]">
          Enter your credentials to access your account
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-[#cccccc] text-sm font-medium">
              Username
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#969696]" />
              <Input
                id="username"
                name="username"
                value={loginData.username}
                onChange={handleLoginChange}
                className="pl-10 bg-[#3e3e42] border-[#3e3e42] text-[#cccccc] placeholder-[#969696] focus:border-[#007acc] focus:ring-[#007acc]"
                placeholder="Enter your username"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-[#cccccc] text-sm font-medium">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#969696]" />
              <Input
                id="password"
                name="password"
                type={showLoginPassword ? "text" : "password"}
                value={loginData.password}
                onChange={handleLoginChange}
                className="pl-10 pr-10 bg-[#3e3e42] border-[#3e3e42] text-[#cccccc] placeholder-[#969696] focus:border-[#007acc] focus:ring-[#007acc]"
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                aria-label={showLoginPassword ? "Hide password" : "Show password"}
                onClick={() => setShowLoginPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#969696] hover:text-[#cccccc]"
              >
                {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="pt-4">
          <Button
            type="submit"
            className="w-full bg-[#007acc] hover:bg-[#005a9e] text-white transition-colors"
            disabled={loading}
          >
            {loading? (
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
