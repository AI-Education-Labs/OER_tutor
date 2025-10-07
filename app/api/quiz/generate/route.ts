import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { context, hint, num_questions, chapter, textbook_id } = await req.json()
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL

    const payload = {
      context,
      textbook_id,
      chapter,
      hint,
      num_questions: typeof num_questions === "number" ? num_questions : 5,
    }

    const resp = await fetch(`${backendUrl}/llm/api/quiz/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const text = await resp.text()

    // The backend returns response.output_text which may be a JSON string
    try {
      const parsed = JSON.parse(text)
      return NextResponse.json(parsed)
    } catch {
      // If not JSON, return as-is wrapped for visibility
      return NextResponse.json({ raw: text })
    }
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate quiz" }, { status: 500 })
  }
}


