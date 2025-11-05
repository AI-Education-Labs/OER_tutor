import type { NextRequest } from "next/server"
// TODO: this isn't used anymore by the frontend, it directly uses backend
export async function POST(req: NextRequest) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL
    const streamUrl = `${backendUrl}/api/v1/chat/stream`

    // Pass through auth header if present
    const authHeader = req.headers.get("authorization")

    const headers: Record<string, string> = {
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
      "Content-Type": "application/json",
    }
    if (authHeader) {
      headers["Authorization"] = authHeader
    }

    const body = await req.text()

    console.log("Forwarding stream request to backend:", streamUrl)

    const backendResponse = await fetch(streamUrl, {
      method: "POST",
      headers,
      body,
    })

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text()
      console.error("Backend stream error:", backendResponse.status, errorText)

      return new Response(
        `data: ${JSON.stringify({ error: "Failed to connect to backend stream", done: true })}\n\n`,
        {
          status: 502,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        },
      )
    }

    return new Response(backendResponse.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("Error in stream proxy:", error)
    return new Response(`data: ${JSON.stringify({ error: "Internal server error", done: true })}\n\n`, {
      status: 500,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  }
}
