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

  const broadcastAuthChange = (type: "login" | "logout") => {
    try {
      localStorage.setItem("auth:changed", JSON.stringify({ type, at: Date.now() }))
    } catch (e) {
      // ignore (some browsers may throw in private mode)
    }
  }

  // Refresh no longer calls a server-side /status endpoint. Instead we hydrate
  // from a minimal localStorage entry (`auth:user`) that is written on login/logout.
  // The httpOnly cookie remains the source of truth server-side; the frontend
  // uses optimistic state and reacts to 401s from protected requests.
  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const raw = localStorage.getItem("auth:user")
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          setUser({ uuid: parsed.uuid, email: parsed.email })
        } catch (_) {
          setUser(null)
        }
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

    const onStorage = (e: StorageEvent) => {
      if (e.key === "auth:changed") void refresh()
    }

    const onFocus = () => {
      void refresh()
    }

    window.addEventListener("storage", onStorage)
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void refresh()
    })

    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("focus", onFocus)
    }
  }, [refresh])

  const login = useCallback(
    async (payload: { username: string; password: string }): Promise<LoginResult> => {
      const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || ""
      try {
        const res = await fetch(`${backendUrl}/api/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          setLastError(null)
          // Optimistically set authenticated state, then fetch actual user data
          const optimisticUser = { uuid: null, email: payload.username }
          setUser(optimisticUser)
          try {
            localStorage.setItem("auth:user", JSON.stringify(optimisticUser))
          } catch (_) {
            // ignore
          }

          // Fetch actual user session data from backend
          try {
            const sessionRes = await fetch(`${backendUrl}/api/v1/auth/session`, {
              method: "GET",
              credentials: "include",
            })
            if (sessionRes.ok) {
              const sessionData = await sessionRes.json()
              if (sessionData.uuid || sessionData.user_id) {
                const actualUser = { 
                  uuid: sessionData.uuid || sessionData.user_id, 
                  email: sessionData.email || payload.username 
                }
                setUser(actualUser)
                try {
                  localStorage.setItem("auth:user", JSON.stringify(actualUser))
                } catch (_) {
                  // ignore
                }
              }
            }
          } catch (_) {
            // Session fetch failed, keep optimistic state
          }

          // notify other tabs
          broadcastAuthChange("login")
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
    []
  )

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    } catch (e) {
      // ignore
    }
    setUser(null)
    setLastError(null)
    try {
      localStorage.removeItem("auth:user")
    } catch (_) {
      // ignore
    }
    broadcastAuthChange("logout")
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
