import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { context, hint, textbook_id, chapter } = await req.json()
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL

    const payload = {
      context,
      hint,
      textbook_id,
      chapter,
    }

    const token = req.cookies.get("access_token")?.value
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (token) headers["Authorization"] = `Bearer ${token}`

    const resp = await fetch(`${backendUrl}/api/v1/study-guide/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    })

    const text = await resp.text()

    try {
      const parsed = JSON.parse(text)
      return NextResponse.json(parsed)
    } catch {
      return NextResponse.json({ raw: text })
    }
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate key concepts" }, { status: 500 })
  }
}


