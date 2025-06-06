import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1]

    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    try {
      // Try to fetch user progress from the backend API
      const response = await fetch("http://localhost:8000/user/progress", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Backend API error")
      }

      const data = await response.json()
      return NextResponse.json(data)
    } catch (error) {
      console.warn("Backend connection failed, using fallback response:", error)

      // Fallback: Generate mock progress data when backend is unavailable
      return NextResponse.json({
        correct_answers: 12,
        total_answers: 20,
        streak: 4,
        last_answer_time: new Date().toISOString(),
        topics_mastered: ["Mock Topic 1", "Mock Topic 2", "Mock Topic 3"],
        level: 3,
        xp: 250,
      })
    }
  } catch (error) {
    console.error("Error fetching user progress:", error)
    return NextResponse.json({ error: "Failed to fetch progress data" }, { status: 500 })
  }
}
