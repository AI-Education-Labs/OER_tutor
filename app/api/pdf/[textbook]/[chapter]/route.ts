import { type NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ textbook: string; chapter: string }> | { textbook: string; chapter: string } },
) {
  try {
    // Await params before destructuring as suggested by the error message
    const resolvedParams = await params
    const textbook = resolvedParams.textbook
    const chapter = resolvedParams.chapter

    console.log(`Fetching PDF for textbook: ${textbook}, chapter: ${chapter}`)

    // Forward the request to the FastAPI backend
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL
    const response = await fetch(`${backendUrl}/api/pdf/${textbook}/${chapter}`)

    if (!response.ok) {
      console.error(`Backend PDF fetch failed: ${response.status} ${response.statusText}`)

      // For development/demo purposes, return a mock PDF response
      // In production, you would want to handle this error differently
      return NextResponse.json({ error: `Failed to fetch PDF: ${response.statusText}` }, { status: response.status })
    }

    // Get the PDF content
    const pdfBuffer = await response.arrayBuffer()

    // Return the PDF with appropriate headers
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${textbook}_chapter_${chapter}.pdf"`,
      },
    })
  } catch (error) {
    console.error("Error fetching PDF:", error)

    // Return a more detailed error response
    return NextResponse.json(
      { error: "Failed to fetch PDF from backend", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
