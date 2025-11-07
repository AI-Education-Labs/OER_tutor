import { type NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ textbook: string }> | { textbook: string } },
) {
  try {
    const resolved = await params
    const { textbook } = resolved
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL
    const token = request.headers.get("authorization") || undefined
    const response = await fetch(`${backendUrl}/api/textbooks/${encodeURIComponent(textbook)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: token } : {}),
      },
      cache: "no-store",
    })
    if (!response.ok) {
      return NextResponse.json({ error: `Backend error ${response.status}` }, { status: response.status })
    }
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching textbook metadata:", error)
    return NextResponse.json({ error: "Failed to fetch textbook metadata" }, { status: 500 })
  }
}


