import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, token, context } = body

    console.log("=== Chat Initiate API ===")
    console.log("Message:", message)
    console.log("Token provided:", !!token)
    console.log("Token preview:", token ? `${token.substring(0, 20)}...` : "none")

    // Prepare headers for the backend request
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    // Add authorization header if token is provided
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
      console.log("Added Authorization header")
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL

    console.log("Forwarding to backend /chat/initiate...")

    const backendResponse = await fetch(`${backendUrl}/chat/initiate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message,
        context,
      }),
    })

    console.log("Backend response status:", backendResponse.status)
    console.log("Backend response headers:", Object.fromEntries(backendResponse.headers.entries()))

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text()
      console.error("Backend error response:", errorText)

      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { detail: errorText || "Unknown backend error" }
      }

      console.error("Parsed backend error:", errorData)
      return NextResponse.json({ error: errorData.detail || "Backend API error" }, { status: backendResponse.status })
    }

    const responseData = await backendResponse.json()
    console.log("Backend response data:", responseData)

    // The session_id should be in the response body
    const result = {
      session_id: responseData.session_id,
      success: responseData.success,
    }

    console.log("Returning result:", result)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error in chat initiate API:", error)
    return NextResponse.json({ error: "Failed to process your request" }, { status: 500 })
  }
}
