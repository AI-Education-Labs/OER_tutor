"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import {
  Loader2, User, Mail, Lock, Eye, EyeOff,
  GraduationCap, BookOpen, ArrowLeft, ArrowRight, SkipForward,
  Trophy, Brain, RotateCcw, Compass,
  Clock, Zap, Flame, Rocket,
} from "lucide-react"
import { cn } from "@/lib/utils"

// --- Step definitions per role ---
const STUDENT_STEPS = ["role-selection", "learning-goals", "time-commitment", "subject-selection", "choose-username", "choose-email", "choose-password"] as const
const PROFESSOR_STEPS = ["role-selection", "course-teaser", "choose-username", "choose-email", "choose-password"] as const

type StepId = (typeof STUDENT_STEPS)[number] | (typeof PROFESSOR_STEPS)[number]

const GOAL_OPTIONS = [
  { id: "head_start", label: "Get a head start on the semester", icon: Compass },
  { id: "learn_efficiently", label: "Learn more efficiently", icon: Brain },
  { id: "review_practice", label: "Review and practice exams", icon: Trophy },
  { id: "get_unstuck", label: "Get unstuck on material", icon: RotateCcw },
] as const

const TIME_OPTIONS = [
  { id: "relaxed", label: "Relaxed", description: "< 1 hr / week", icon: Clock },
  { id: "moderate", label: "Moderate", description: "1–5 hrs / week", icon: Zap },
  { id: "dedicated", label: "Dedicated", description: "5–20 hrs / week", icon: Flame },
  { id: "intensive", label: "Intensive", description: "20+ hrs / week", icon: Rocket },
] as const

const SUBJECT_OPTIONS = [
  "Mathematics", "Computer Science", "Physics", "Chemistry",
  "Biology", "Engineering", "Business", "Economics",
  "Humanities", "Social Sciences", "Languages",
  "Medicine", "Health Sciences", "Other",
] as const

interface FormData {
  role: "student" | "professor"
  goals: string[]
  timeCommitment: string
  subjects: string[]
  username: string
  email: string
  password: string
  confirmPassword: string
}

// --- Progress Dots ---
function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-2 w-2 rounded-full transition-colors",
            i === current ? "bg-primary" : "bg-border",
          )}
        />
      ))}
    </div>
  )
}

// --- Step: Role Selection ---
function StepRoleSelection({
  role,
  onSelect,
}: {
  role: FormData["role"]
  onSelect: (r: FormData["role"]) => void
}) {
  return (
    <>
      <CardHeader className="pb-4">
        <CardTitle className="text-foreground text-lg">What type of user are you?</CardTitle>
        <CardDescription className="text-foreground-muted">
          Select your role to personalize your experience
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <button
          type="button"
          onClick={() => onSelect("student")}
          className={cn(
            "w-full flex items-center gap-4 rounded-lg border p-4 text-left transition-colors",
            role === "student"
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border bg-background-surface text-foreground-secondary hover:border-primary/50",
          )}
        >
          <GraduationCap className="h-6 w-6 shrink-0" />
          <div>
            <p className="font-medium">Student</p>
            <p className="text-sm text-foreground-muted">I&apos;m here to learn and study</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onSelect("professor")}
          className={cn(
            "w-full flex items-center gap-4 rounded-lg border p-4 text-left transition-colors",
            role === "professor"
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border bg-background-surface text-foreground-secondary hover:border-primary/50",
          )}
        >
          <BookOpen className="h-6 w-6 shrink-0" />
          <div>
            <p className="font-medium">Professor</p>
            <p className="text-sm text-foreground-muted">I&apos;m here to teach and manage courses</p>
          </div>
        </button>
      </CardContent>
    </>
  )
}

// --- Step: Learning Goals (multi-select) ---
function StepLearningGoals({
  selected,
  onToggle,
}: {
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <>
      <CardHeader className="pb-4">
        <CardTitle className="text-foreground text-lg">What are your learning goals?</CardTitle>
        <CardDescription className="text-foreground-muted">
          Select all that apply
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {GOAL_OPTIONS.map(({ id, label, icon: Icon }) => {
          const active = selected.includes(id)
          return (
            <button
              key={id}
              type="button"
              onClick={() => onToggle(id)}
              className={cn(
                "w-full flex items-center gap-4 rounded-lg border p-4 text-left transition-colors",
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background-surface text-foreground-secondary hover:border-primary/50",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="font-medium">{label}</span>
            </button>
          )
        })}
      </CardContent>
    </>
  )
}

// --- Step: Time Commitment (single select) ---
function StepTimeCommitment({
  selected,
  onSelect,
}: {
  selected: string
  onSelect: (id: string) => void
}) {
  return (
    <>
      <CardHeader className="pb-4">
        <CardTitle className="text-foreground text-lg">How much time do you study each week?</CardTitle>
        <CardDescription className="text-foreground-muted">
          This helps us tailor your study plans
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        {TIME_OPTIONS.map(({ id, label, description, icon: Icon }) => {
          const active = selected === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors",
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background-surface text-foreground-secondary hover:border-primary/50",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium text-sm">{label}</span>
              <span className="text-xs text-foreground-muted">{description}</span>
            </button>
          )
        })}
      </CardContent>
    </>
  )
}

// --- Step: Subject Selection (multi-select chips) ---
function StepSubjectSelection({
  selected,
  onToggle,
}: {
  selected: string[]
  onToggle: (subject: string) => void
}) {
  return (
    <>
      <CardHeader className="pb-4">
        <CardTitle className="text-foreground text-lg">What subjects are you interested in?</CardTitle>
        <CardDescription className="text-foreground-muted">
          Select all that apply
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {SUBJECT_OPTIONS.map((subject) => {
            const active = selected.includes(subject)
            return (
              <button
                key={subject}
                type="button"
                onClick={() => onToggle(subject)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background-surface text-foreground-secondary hover:border-primary/50",
                )}
              >
                {subject}
              </button>
            )
          })}
        </div>
      </CardContent>
    </>
  )
}

// --- Step: Course Teaser (Professor - Coming Soon) ---
function StepCourseTeaser() {
  return (
    <>
      <CardHeader className="pb-4">
        <CardTitle className="text-foreground text-lg">Load your courses</CardTitle>
        <CardDescription className="text-foreground-muted">
          Manage your courses and students in one place
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-background-surface p-8 text-center">
          <BookOpen className="h-12 w-12 text-foreground-muted" />
          <span className="inline-block rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
            Coming Soon
          </span>
          <p className="text-sm text-foreground-muted max-w-xs">
            You&apos;ll be able to upload textbooks, create courses, and track student progress.
            We&apos;ll notify you when this feature is ready.
          </p>
        </div>
      </CardContent>
    </>
  )
}

// --- Step: Choose Username ---
function StepChooseUsername({
  value,
  onChange,
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <>
      <CardHeader className="pb-4">
        <CardTitle className="text-foreground text-lg">Choose a username</CardTitle>
        <CardDescription className="text-foreground-muted">
          This is how others will see you on TextbookAI
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="register-username" className="text-foreground-secondary text-sm font-medium">
            Username
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-foreground-muted" />
            <Input
              id="register-username"
              name="username"
              value={value}
              onChange={onChange}
              className="pl-10 bg-background-surface border-border text-foreground-secondary placeholder-foreground-muted focus:border-primary focus:ring-primary"
              placeholder="Choose a username"
              required
            />
          </div>
        </div>
      </CardContent>
    </>
  )
}

// --- Step: Choose Email ---
function StepChooseEmail({
  value,
  onChange,
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <>
      <CardHeader className="pb-4">
        <CardTitle className="text-foreground text-lg">Enter your email</CardTitle>
        <CardDescription className="text-foreground-muted">
          We&apos;ll use this to keep your account secure
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-foreground-secondary text-sm font-medium">
            Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-foreground-muted" />
            <Input
              id="email"
              name="email"
              type="email"
              value={value}
              onChange={onChange}
              className="pl-10 bg-background-surface border-border text-foreground-secondary placeholder-foreground-muted focus:border-primary focus:ring-primary"
              placeholder="Enter your email"
              required
            />
          </div>
        </div>
      </CardContent>
    </>
  )
}

// --- Step: Choose Password ---
function StepChoosePassword({
  password,
  confirmPassword,
  onChange,
  showPassword,
  showConfirm,
  onTogglePassword,
  onToggleConfirm,
}: {
  password: string
  confirmPassword: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  showPassword: boolean
  showConfirm: boolean
  onTogglePassword: () => void
  onToggleConfirm: () => void
}) {
  return (
    <>
      <CardHeader className="pb-4">
        <CardTitle className="text-foreground text-lg">Create a password</CardTitle>
        <CardDescription className="text-foreground-muted">
          Must be at least 8 characters long
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="register-password" className="text-foreground-secondary text-sm font-medium">
            Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-foreground-muted" />
            <Input
              id="register-password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={onChange}
              className="pl-10 pr-10 bg-background-surface border-border text-foreground-secondary placeholder-foreground-muted focus:border-primary focus:ring-primary"
              placeholder="Create a password"
              required
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={onTogglePassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground-secondary"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password" className="text-foreground-secondary text-sm font-medium">
            Confirm Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-foreground-muted" />
            <Input
              id="confirm-password"
              name="confirmPassword"
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={onChange}
              className="pl-10 pr-10 bg-background-surface border-border text-foreground-secondary placeholder-foreground-muted focus:border-primary focus:ring-primary"
              placeholder="Confirm your password"
              required
            />
            <button
              type="button"
              aria-label={showConfirm ? "Hide password" : "Show password"}
              onClick={onToggleConfirm}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground-secondary"
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </CardContent>
    </>
  )
}

// ============================================================
// Main multi-step RegisterForm
// ============================================================

export default function RegisterForm() {
  const { toast } = useToast()

  const [step, setStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [formData, setFormData] = useState<FormData>({
    role: "student",
    goals: [],
    timeCommitment: "",
    subjects: [],
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  })

  // Derive step list from selected role
  const steps: readonly StepId[] = formData.role === "professor" ? PROFESSOR_STEPS : STUDENT_STEPS
  const totalSteps = steps.length
  const currentStepId = steps[step] as StepId
  const isFirstStep = step === 0
  const isLastStep = step === totalSteps - 1

  // Personalization screens are skippable; role selection and credential screens are not
  const nonSkippableSteps: StepId[] = ["role-selection", "choose-username", "choose-email", "choose-password"]
  const isSkippable = !nonSkippableSteps.includes(currentStepId)

  // --- Helpers ---
  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const toggleGoal = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      goals: prev.goals.includes(id) ? prev.goals.filter((g) => g !== id) : [...prev.goals, id],
    }))
  }

  const toggleSubject = (subject: string) => {
    setFormData((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter((s) => s !== subject)
        : [...prev.subjects, subject],
    }))
  }

  const selectRole = (role: FormData["role"]) => {
    setFormData((prev) => ({ ...prev, role }))
    // Reset step to 0 when role changes (they're on step 0 anyway)
  }

  const goNext = () => {
    if (!isLastStep) setStep((s) => s + 1)
  }

  const goBack = () => {
    if (!isFirstStep) setStep((s) => s - 1)
  }

  // --- Validation (account details only) ---
  const isAlphanumeric = (value: string) => /^[A-Za-z0-9]+$/.test(value)
  const isValidEmail = (value: string) => /[^@]+@[^@]+\.[^@]+/.test(value)

  const validateRegistration = (): string | null => {
    const { username, email, password, confirmPassword } = formData

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

  // --- Submit ---
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationError = validateRegistration()
    if (validationError) {
      toast({ title: "Invalid Input", description: validationError, variant: "destructive" })
      return
    }

    setIsLoading(true)

    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL

      const onboarding =
        formData.role === "student"
          ? {
              goals: formData.goals.length > 0 ? formData.goals : undefined,
              time_commitment: formData.timeCommitment || undefined,
              subjects: formData.subjects.length > 0 ? formData.subjects : undefined,
            }
          : undefined

      const response = await fetch(`${backendUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          onboarding: onboarding,
        }),
      })

      if (!response.ok) {
        const message = await readErrorMessage(response, "Registration failed")
        throw new Error(message || "Registration failed")
      }

      await response.json()

      // Auto-login after successful registration
      const loginResponse = await fetch(`${backendUrl}/api/v1/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          username: formData.username,
          password: formData.password,
        }),
      })

      if (!loginResponse.ok) {
        toast({
          title: "Registration Successful",
          description: "Your account has been created. Please log in.",
        })
        document.getElementById("login-tab")?.click()
        return
      }

      const loginData = await loginResponse.json()
      if (loginData.access_token) {
        localStorage.setItem("access_token", loginData.access_token)
      }

      toast({
        title: "Welcome!",
        description: "Your account has been created and you're now logged in.",
      })

      window.location.href = "/dashboard"
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

  // --- Render current step content ---
  const renderStep = () => {
    switch (currentStepId) {
      case "role-selection":
        return <StepRoleSelection role={formData.role} onSelect={selectRole} />
      case "learning-goals":
        return <StepLearningGoals selected={formData.goals} onToggle={toggleGoal} />
      case "time-commitment":
        return (
          <StepTimeCommitment
            selected={formData.timeCommitment}
            onSelect={(id) => setFormData((prev) => ({ ...prev, timeCommitment: id }))}
          />
        )
      case "subject-selection":
        return <StepSubjectSelection selected={formData.subjects} onToggle={toggleSubject} />
      case "course-teaser":
        return <StepCourseTeaser />
      case "choose-username":
        return <StepChooseUsername value={formData.username} onChange={handleFieldChange} />
      case "choose-email":
        return <StepChooseEmail value={formData.email} onChange={handleFieldChange} />
      case "choose-password":
        return (
          <StepChoosePassword
            password={formData.password}
            confirmPassword={formData.confirmPassword}
            onChange={handleFieldChange}
            showPassword={showRegisterPassword}
            showConfirm={showConfirmPassword}
            onTogglePassword={() => setShowRegisterPassword((v) => !v)}
            onToggleConfirm={() => setShowConfirmPassword((v) => !v)}
          />
        )
      default:
        return null
    }
  }

  return (
    <Card className="bg-background-secondary border-border">
      {/* Progress dots — top right, hidden on role selection since total is unknown */}
      {currentStepId !== "role-selection" && (
        <div className="flex justify-end px-6 pt-4">
          <ProgressDots current={step - 1} total={totalSteps - 1} />
        </div>
      )}

      <form onSubmit={isLastStep ? handleRegister : (e) => { e.preventDefault(); goNext() }}>
        {renderStep()}

        {/* Navigation footer */}
        <CardFooter className="pt-4 flex items-center gap-2">
          {!isFirstStep && (
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              className="border-border text-foreground-secondary hover:text-foreground"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          )}

          <div className="flex-1" />

          {isSkippable && (
            <Button
              type="button"
              variant="ghost"
              onClick={goNext}
              className="text-foreground-muted hover:text-foreground-secondary"
            >
              Skip
              <SkipForward className="ml-1 h-4 w-4" />
            </Button>
          )}

          {isLastStep ? (
            <Button
              type="submit"
              className="bg-primary hover:bg-primary-hover text-foreground transition-colors"
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
          ) : (
            <Button
              type="submit"
              className="bg-primary hover:bg-primary-hover text-foreground transition-colors"
            >
              Next
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </CardFooter>
      </form>
    </Card>
  )
}
