import { type NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ textbook: string }> | { textbook: string } },
) {
  try {
    const resolved = await params
    const { textbook } = resolved
    const backendUrl = process.env.BACKEND_URL
    const response = await fetch(`${backendUrl}/api/textbooks/${encodeURIComponent(textbook)}`)
    if (!response.ok) {
      return NextResponse.json({ error: `Backend error ${response.status}` }, { status: response.status })
    }
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch textbook metadata" }, { status: 500 })
  }
}


