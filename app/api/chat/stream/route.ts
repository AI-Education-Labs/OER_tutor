import type { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  try {
    // Get the session ID from the query parameters
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get("sessionId")

    console.log("=== Chat Stream API ===")
    console.log("Session ID:", sessionId)

    if (!sessionId) {
      console.error("No session ID provided")
      return new Response(`data: ${JSON.stringify({ error: "Session ID is required", done: true })}\n\n`, {
        status: 400,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Cache-Control",
        },
      })
    }

    // Get the authentication token from the request
    const authHeader = req.headers.get("authorization")
    const token = authHeader?.split(" ")[1] || null

    console.log("Auth header:", authHeader)
    console.log("Token extracted:", !!token)

    // Prepare headers for the backend request
    const headers: Record<string, string> = {
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
    }

    // Add authorization header if token is provided
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
      console.log("Added Authorization header to backend request")
    }

    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000"
    const streamUrl = `${backendUrl}/chat/stream/${sessionId}`

    console.log("Connecting to backend stream:", streamUrl)
    console.log("Request headers:", headers)

    // Connect to the backend SSE endpoint
    const backendResponse = await fetch(streamUrl, {
      headers,
    })

    console.log("Backend stream response status:", backendResponse.status)
    console.log("Backend stream response headers:", Object.fromEntries(backendResponse.headers.entries()))

    if (!backendResponse.ok) {
      console.error("Backend stream failed with status:", backendResponse.status)
      const errorText = await backendResponse.text()
      console.error("Backend stream error:", errorText)

      return new Response(
        `data: ${JSON.stringify({
          error: "Failed to connect to backend stream",
          done: true,
        })}\n\n`,
        {
          status: 502,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control",
          },
        },
      )
    }

    console.log("Successfully connected to backend stream, forwarding...")

    // Forward the SSE stream from the backend to the client
    // The backend EventSourceResponse handles proper SSE formatting
    return new Response(backendResponse.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Cache-Control",
      },
    })
  } catch (error) {
    console.error("Error in SSE stream:", error)

    return new Response(
      `data: ${JSON.stringify({
        error: "Internal server error",
        done: true,
      })}\n\n`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Cache-Control",
        },
      },
    )
  }
}