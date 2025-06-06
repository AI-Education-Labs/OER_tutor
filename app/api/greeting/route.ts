import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1] || null

    // Prepare headers for the backend request
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    // Add authorization header if token is provided
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }

    try {
      // Try to send the greeting request to the backend API
      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          message:
            "Hello, please introduce yourself, how you plan to help me, and a summary of the loaded textbook, use the retriever tool to generate a summary. Make me engaged and exited to learn.",
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Backend API error")
      }

      const data = await response.json()
      return NextResponse.json(data) // Forward the backend response
    } catch (error) {
      console.warn("Backend connection failed, using fallback greeting:", error)

      // Fallback: Generate a mock greeting when backend is unavailable
      return NextResponse.json({
        response:
          "Hello! I'm your AI tutor, here to assist you with your learning journey. I can help you understand complex concepts, provide explanations, and answer your questions. Let's make learning engaging and exciting together!",
        saved: !!token,
        isQuiz: false,
      })
    }
  } catch (error) {
    console.error("Error fetching greeting:", error)
    return NextResponse.json({ error: "Failed to fetch greeting" }, { status: 500 })
  }
}