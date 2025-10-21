import { Suspense } from "react"
import AuthForm from "@/components/auth/auth-form"

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm />
    </Suspense>
  )
}

