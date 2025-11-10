import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL
    const token = req.cookies.get("access_token")?.value
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (token) headers["Authorization"] = `Bearer ${token}`

    const resp = await fetch(`${backendUrl}/api/v1/flashcards/list`, { headers, cache: "no-store" })
    const text = await resp.text()
    try {
      const parsed = JSON.parse(text)
      return NextResponse.json(parsed, { status: resp.status })
    } catch {
      return NextResponse.json({ raw: text }, { status: resp.status })
    }
  } catch (error) {
    return NextResponse.json({ error: "Failed to list flashcards" }, { status: 500 })
  }
}


