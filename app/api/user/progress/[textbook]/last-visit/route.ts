import { NextRequest, NextResponse } from "next/server"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ textbook: string }> | { textbook: string } },
) {
  try {
    const { textbook } = await (params as Promise<{ textbook: string }>)
    const auth = req.headers.get("authorization")
    if (!auth) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL
    const response = await fetch(`${backendUrl}/api/v1/progress/${encodeURIComponent(textbook)}/last-visit`, {
      method: "PATCH",
      headers: { "content-type": "application/json", Authorization: auth },
      body: JSON.stringify(body),
    })

    const data = await response.json().catch(() => ({}))
    return new NextResponse(JSON.stringify(data), { status: response.status })
  } catch (error) {
    console.error("PATCH /api/user/progress/[textbook]/last-visit error", error)
    return NextResponse.json({ error: "Failed to update last visit" }, { status: 500 })
  }
}


