import { type NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL

export async function GET(request: NextRequest) {
  try {
    const upstream = `${BACKEND_URL}/api/v1/textbooks/list`
    const token = request.headers.get("authorization") || undefined
    const response = await fetch(upstream, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: token } : {}),
      },
      cache: "no-store",
    })
    const text = await response.text()
    let data: unknown
    try {
      data = text ? JSON.parse(text) : []
    } catch (e) {
      console.error("Failed to parse upstream JSON:", e, "body:", text?.slice(0, 500))
      return NextResponse.json({ error: "Invalid JSON from backend" }, { status: 502 })
    }

    if (!response.ok) {
      console.error("Upstream error body:", data)
      return NextResponse.json({ error: "Backend error", details: data }, { status: response.status })
    }

    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error("Error fetching textbooks:", error)
    return NextResponse.json({ error: "Failed to fetch textbooks" }, { status: 500 })
  }
}
