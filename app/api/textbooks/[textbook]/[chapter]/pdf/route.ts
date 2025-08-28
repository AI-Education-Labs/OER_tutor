import { type NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; chapterId: string }> | { id: string; chapterId: string } },
) {
  try {
    console.log("Fetching chapter PDF with params:",params)
    const resolved = await params
    const { id: textbook, chapterId } = resolved

    const backendUrl = process.env.BACKEND_URL
    if (!backendUrl) {
      return NextResponse.json({ error: "Backend URL not configured" }, { status: 500 })
    }

    const response = await fetch(
      `${backendUrl}/api/textbooks/${encodeURIComponent(textbook)}/chapters/${encodeURIComponent(chapterId)}/pdf`,
    )

    if (!response.ok) {
      return NextResponse.json({ error: `Backend error ${response.status}` }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching chapter PDF:", error)
    return NextResponse.json({ error: "Failed to fetch chapter PDF" }, { status: 500 })
  }
}
