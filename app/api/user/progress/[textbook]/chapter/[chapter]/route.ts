import { NextRequest, NextResponse } from "next/server"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ textbook: string; chapter: string }> | { textbook: string; chapter: string } },
) {
  try {
    const { textbook, chapter } = await (params as Promise<{ textbook: string; chapter: string }>)
    const auth = req.headers.get("authorization")
    if (!auth) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL
    const response = await fetch(
      `${backendUrl}/progress/${encodeURIComponent(textbook)}/chapter/${encodeURIComponent(chapter)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json", Authorization: auth },
        body: JSON.stringify(body),
      },
    )

    const data = await response.json().catch(() => ({}))
    return new NextResponse(JSON.stringify(data), { status: response.status })
  } catch (error) {
    console.error("PATCH /api/user/progress/[textbook]/chapter/[chapter] error", error)
    return NextResponse.json({ error: "Failed to update progress" }, { status: 500 })
  }
}


