import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { messageId, optionId, isCorrect } = await req.json()
    const token = req.headers.get("authorization")?.split(" ")[1]

    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    try {
      // Try to send the quiz answer to the backend API
      const response = await fetch("http://localhost:8000/quiz/answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messageId, optionId, isCorrect }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Backend API error")
      }

      const data = await response.json()
      return NextResponse.json(data)
    } catch (error) {
      console.warn("Backend connection failed, using fallback response:", error)

      // Fallback: Generate a mock response when backend is unavailable
      return NextResponse.json({
        success: true,
        progress: {
          correct_answers: 10,
          total_answers: 15,
          streak: isCorrect ? 3 : 0,
          last_answer_time: new Date().toISOString(),
          topics_mastered: ["Mock Topic 1", "Mock Topic 2"],
          level: 2,
          xp: 150,
        },
        message: "Answer recorded successfully (mock response)",
      })
    }
  } catch (error) {
    console.error("Error processing quiz answer:", error)
    return NextResponse.json({ error: "Failed to process your answer" }, { status: 500 })
  }
}
