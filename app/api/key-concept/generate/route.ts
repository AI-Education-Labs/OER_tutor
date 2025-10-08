import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { context, hint } = await req.json()
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL

    const payload = {
      context,
      hint,
    }

    const resp = await fetch(`${backendUrl}/llm/api/key-concept/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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


