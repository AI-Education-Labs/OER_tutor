import { type NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ textbook: string }> | { textbook: string } },
) {
  try {
    // Await params before destructuring
    const resolvedParams = await params
    const textbook = resolvedParams.textbook

    console.log(`Fetching chapters for textbook: ${textbook}`)

    // Forward the request to the FastAPI backend
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000"
    const response = await fetch(`${backendUrl}/api/textbooks/${textbook}/chapters`)

    if (!response.ok) {
      console.log(`Backend responded with status: ${response.status}`)

      // Instead of throwing an error, return fallback data for development/demo
      // In production, you might want to handle this differently
      return NextResponse.json({
        chapters: [
          { id: 1, title: "Introduction", file: `/api/pdf/${textbook}/1` },
          { id: 2, title: "Basic Concepts", file: `/api/pdf/${textbook}/2` },
          { id: 3, title: "Advanced Topics", file: `/api/pdf/${textbook}/3` },
          { id: 4, title: "Case Studies", file: `/api/pdf/${textbook}/4` },
          { id: 5, title: "Practical Applications", file: `/api/pdf/${textbook}/5` },
        ],
      })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching chapters:", error)

    // Return fallback data even in case of errors
    const resolvedParams = await params
    const textbook = resolvedParams.textbook
    return NextResponse.json({
      chapters: [
        { id: 1, title: "Introduction", file: `/api/pdf/${textbook}/1` },
        { id: 2, title: "Basic Concepts", file: `/api/pdf/${textbook}/2` },
        { id: 3, title: "Advanced Topics", file: `/api/pdf/${textbook}/3` },
        { id: 4, title: "Case Studies", file: `/api/pdf/${textbook}/4` },
        { id: 5, title: "Practical Applications", file: `/api/pdf/${textbook}/5` },
      ],
    })
  }
}
