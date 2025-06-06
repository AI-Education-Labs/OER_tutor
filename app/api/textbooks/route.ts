import { NextResponse } from "next/server"

// The FastAPI backend URL - update this to match your backend
const BACKEND_URL = "http://localhost:8000"

export async function GET() {
  try {
    // Forward the request to the FastAPI backend
    const response = await fetch(`${BACKEND_URL}/api/textbooks`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching textbooks:", error)

    // Return mock data as fallback
    const mockTextbooks = [
      {
        id: "Physics",
        title: "Physics Textbook",
        chapters: [
          { id: 1, title: "Introduction", file: "/api/pdf/Physics/1" },
          { id: 2, title: "Basic Concepts", file: "/api/pdf/Physics/2" },
          { id: 3, title: "Advanced Topics", file: "/api/pdf/Physics/3" },
          { id: 4, title: "Case Studies", file: "/api/pdf/Physics/4" },
          { id: 5, title: "Practical Applications", file: "/api/pdf/Physics/5" },
        ],
      },
    ]

    return NextResponse.json(mockTextbooks)
  }
}
