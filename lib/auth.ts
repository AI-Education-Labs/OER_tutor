export function parseJwt(token: string): Record<string, any> | null {
  try {
    const base64Url = token.split(".")[1]
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

export function getValidTokenPayload(): Record<string, any> | null {
  if (typeof window === "undefined") return null
  const token = localStorage.getItem("access_token")
  if (!token) return null
  const payload = parseJwt(token)
  if (!payload || typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) {
    localStorage.removeItem("access_token")
    return null
  }
  return payload
}
