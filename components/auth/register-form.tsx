"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, User, Mail, Lock, Eye, EyeOff } from "lucide-react"

export default function RegisterForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [registerData, setRegisterData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const { toast } = useToast()
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const isAlphanumeric = (value: string) => /^[A-Za-z0-9]+$/.test(value)
  const isValidEmail = (value: string) => /[^@]+@[^@]+\.[^@]+/.test(value)

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

  const validateRegistration = (): string | null => {
    const { username, email, password, confirmPassword } = registerData

    if (!isAlphanumeric(username)) {
      return "Username should only have alphanumeric characters"
    }
    if (username.length > 100) {
      return "Username should be less than 100 characters"
    }
    if (username.length < 3) {
      return "Username should be at least 3 characters"
    }
    if (email.length > 1000) {
      return "Email should be less than 1000 characters"
    }
    if (!isValidEmail(email)) {
      return "Invalid email"
    }
    if (password.length < 8) {
      return "Password should be at least 8 characters long"
    }
    if (password.length > 100) {
      return "Password should be less than 100 characters"
    }
    if (password !== confirmPassword) {
      return "Passwords don't match"
    }
    return null
  }

  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setRegisterData((prev) => ({ ...prev, [name]: value }))
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationError = validateRegistration()
    if (validationError) {
      toast({
        title: "Invalid Input",
        description: validationError,
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: registerData.username,
          email: registerData.email,
          password: registerData.password,
        }),
      })

      if (!response.ok) {
        const message = await readErrorMessage(response, "Registration failed")
        throw new Error(message || "Registration failed")
      }

      await response.json()

      toast({
        title: "Registration Successful",
        description: "Your account has been created. Please log in.",
      })

      setRegisterData({ username: "", email: "", password: "", confirmPassword: "" })
      document.getElementById("login-tab")?.click()
    } catch (error: any) {
      console.error("Registration error:", error)
      toast({
        title: "Registration Failed",
        description: error?.message || "The registration service is currently unavailable. Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="bg-[#252526] border-[#3e3e42]">
      <CardHeader className="pb-4">
        <CardTitle className="text-[#ffffff] text-lg">Create your account</CardTitle>
        <CardDescription className="text-[#969696]">
          Enter your details to get started with TextbookAI
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleRegister}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="register-username" className="text-[#cccccc] text-sm font-medium">
              Username
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#969696]" />
              <Input
                id="register-username"
                name="username"
                value={registerData.username}
                onChange={handleRegisterChange}
                className="pl-10 bg-[#3e3e42] border-[#3e3e42] text-[#cccccc] placeholder-[#969696] focus:border-[#007acc] focus:ring-[#007acc]"
                placeholder="Choose a username"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[#cccccc] text-sm font-medium">
              Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#969696]" />
              <Input
                id="email"
                name="email"
                type="email"
                value={registerData.email}
                onChange={handleRegisterChange}
                className="pl-10 bg-[#3e3e42] border-[#3e3e42] text-[#cccccc] placeholder-[#969696] focus:border-[#007acc] focus:ring-[#007acc]"
                placeholder="Enter your email"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-password" className="text-[#cccccc] text-sm font-medium">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#969696]" />
              <Input
                id="register-password"
                name="password"
                type={showRegisterPassword ? "text" : "password"}
                value={registerData.password}
                onChange={handleRegisterChange}
                className="pl-10 pr-10 bg-[#3e3e42] border-[#3e3e42] text-[#cccccc] placeholder-[#969696] focus:border-[#007acc] focus:ring-[#007acc]"
                placeholder="Create a password, minimum 8 characters"
                required
              />
              <button
                type="button"
                aria-label={showRegisterPassword ? "Hide password" : "Show password"}
                onClick={() => setShowRegisterPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#969696] hover:text-[#cccccc]"
              >
                {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-[#cccccc] text-sm font-medium">
              Confirm Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#969696]" />
              <Input
                id="confirm-password"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={registerData.confirmPassword}
                onChange={handleRegisterChange}
                className="pl-10 pr-10 bg-[#3e3e42] border-[#3e3e42] text-[#cccccc] placeholder-[#969696] focus:border-[#007acc] focus:ring-[#007acc]"
                placeholder="Confirm your password"
                required
              />
              <button
                type="button"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#969696] hover:text-[#cccccc]"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="pt-4">
          <Button
            type="submit"
            className="w-full bg-[#007acc] hover:bg-[#005a9e] text-white transition-colors"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}


