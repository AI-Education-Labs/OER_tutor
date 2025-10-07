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
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL
    const response = await fetch(`${backendUrl}/api/textbooks/${textbook}/chapters`)

    if (!response.ok) {
      console.log(`Backend responded with status: ${response.status}`)
    }

    const data = await response.json()
    console.log("Data:", data)
    // Normalize to always return { chapters: [...] }
    const normalized = Array.isArray(data) ? { chapters: data } : data
    return NextResponse.json(normalized)
  } catch (error) {
    console.error("Error fetching chapters:", error)
    return NextResponse.json({ error: "Failed to fetch chapters" }, { status: 500 })
  }
}
