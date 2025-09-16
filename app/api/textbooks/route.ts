import { NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000"

console.log("BACKEND_URL:", BACKEND_URL)

export async function GET() {
  try {
    const upstream = `${BACKEND_URL}/api/textbooks`
    const response = await fetch(upstream, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    })

    console.log("/api/textbooks upstream status:", response.status)

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

    const length = Array.isArray(data) ? data.length : 0
    console.log("/api/textbooks returned items:", length)
    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error("Error fetching textbooks:", error)
    return NextResponse.json({ error: "Failed to fetch textbooks" }, { status: 500 })
  }
}
