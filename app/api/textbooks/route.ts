import { NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL

console.log("BACKEND_URL:", BACKEND_URL)

export async function GET() {
  try {
    // Forward the request to the FastAPI backend
    const response = await fetch(`${BACKEND_URL}/api/textbooks`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching textbooks:", error)
    throw new Error("Failed to fetch textbooks")
  }
}
