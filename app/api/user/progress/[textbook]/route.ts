import { NextRequest, NextResponse } from "next/server"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ textbook: string }> | { textbook: string } },
) {
  try {
    const { textbook } = await (params as Promise<{ textbook: string }>)
    const auth = req.headers.get("authorization")
    if (!auth) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL
    const response = await fetch(`${backendUrl}/progress/${encodeURIComponent(textbook)}`, {
      headers: { Authorization: auth },
      cache: "no-store",
    })

    const data = await response.json().catch(() => ({}))
    return new NextResponse(JSON.stringify(data), { status: response.status })
  } catch (error) {
    console.error("GET /api/user/progress/[textbook] error", error)
    return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 })
  }
}


