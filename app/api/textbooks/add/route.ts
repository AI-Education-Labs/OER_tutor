import { NextResponse, NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as any))
    const code: string = String(body?.code || "").toUpperCase().trim()

    if (!code || code.length !== 6) {
      return NextResponse.json({ ok: false, error: "Invalid code" }, { status: 400 })
    }

    const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.BACKEND_URL || "http://localhost:8000"

    // Forward to backend with auth if provided
    const token = request.headers.get("authorization") || undefined
    const upstream = await fetch(`${BACKEND_URL}/api/user_books/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: token } : {}),
      },
      body: JSON.stringify({ code }),
      cache: "no-store",
    })

    const text = await upstream.text()
    let data: any = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch (e) {
      return NextResponse.json({ ok: false, error: "Invalid response from backend" }, { status: 502 })
    }

    if (!upstream.ok) {
      const error = data?.detail || data?.error || "Backend error"
      const status = upstream.status === 404 ? 200 : upstream.status
      // If backend says not found, we treat as graceful invalid code with 200
      if (upstream.status === 404) {
        return NextResponse.json({ ok: false, error: "Invalid code" }, { status: 200 })
      }
      return NextResponse.json({ ok: false, error }, { status })
    }

    return NextResponse.json(data, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 500 })
  }
}


