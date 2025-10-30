"use client"

import React, { createContext, useCallback, useContext, useEffect, useState } from "react"

type User = { uuid?: string; email?: string } | null

type AuthError = { status?: number; message?: string } | null

type LoginResult = {
  success: boolean
  status?: number
  error?: string | null
  data?: any
}

type AuthContextType = {
  isLoading: boolean
  isAuthenticated: boolean
  user: User
  lastError: AuthError
  refresh: () => Promise<void>
  login: (payload: { username: string; password: string }) => Promise<LoginResult>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * AuthProvider
 * - queries `/api/auth/status` using credentials: 'include' to detect cookie-based auth
 * - exposes convenience login/logout that call the app/backend endpoints and refresh state
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<User>(null)
  const [lastError, setLastError] = useState<AuthError>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/status", { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        // backend may return { user_uuid } or a richer object
        const resolvedUser: User = data && data.user_uuid
        setUser(resolvedUser)
      } else {
        setUser(null)
      }
    } catch (err) {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(
    async (payload: { username: string; password: string }): Promise<LoginResult> => {
      try {
        const params = new URLSearchParams({
          username: payload.username,
          password: payload.password,
        })

        const res = await fetch(`/api/auth/login`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        })

        if (res.ok) {
          setLastError(null)
          await refresh() // Refresh user state after successful login
          return { success: true, status: res.status }
        }

        const message = "Login failed"
        const result: LoginResult = { success: false, status: res.status, error: message }
        setLastError({ status: res.status, message })
        return result
      } catch (e: any) {
        const message = e?.message || "Network error"
        setLastError({ message })
        return { success: false, error: message }
      }
    },
    [refresh]
  )

  const logout = useCallback(async () => {
    try {
      // call backend logout which should clear the httpOnly cookie
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    } catch (e) {
      // ignore
    }
    setUser(null)
    setLastError(null)
  }, [])

  return (
    <AuthContext.Provider value={{ isLoading, isAuthenticated: !!user, user, lastError, refresh, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside an AuthProvider")
  return ctx
}

export default useAuth
