import { type NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir, readFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { v4 as uuidv4 } from "uuid"

const METADATA_PATH = path.join(process.cwd(), "data", "books.json")

async function saveBookMetadata(newBook: any) {
  let books = []

  if (existsSync(METADATA_PATH)) {
    const raw = await readFile(METADATA_PATH, "utf-8")
    books = JSON.parse(raw)
  }

  books.push(newBook)
  await writeFile(METADATA_PATH, JSON.stringify(books, null, 2))
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File
    const title = formData.get("title")?.toString() || file.name
    const author = formData.get("author")?.toString() || "Unknown"

    if (!file || file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const filename = `${uuidv4()}.pdf`
    const uploadPath = path.join(process.cwd(), "public", "uploads", filename)

    if (!existsSync(path.join(process.cwd(), "public", "uploads"))) {
      await mkdir(path.join(process.cwd(), "public", "uploads"), { recursive: true })
    }

    await writeFile(uploadPath, buffer)

    // ✅ RIGHT HERE — build textbook metadata
    const textbook = {
      id: uuidv4(),
      title,
      author,
      uploadDate: new Date(),
      pages: 300,
      thumbnail: "/placeholder.svg?height=100&width=80",
      fileUrl: `/uploads/${filename}`,
    }

    // ✅ Save it to books.json
    await saveBookMetadata(textbook)

    return NextResponse.json({
      success: true,
      message: "Textbook uploaded successfully",
      textbook,
    })
  } catch (error) {
    console.error("Error uploading textbook:", error)
    return NextResponse.json({ error: "Failed to upload textbook" }, { status: 500 })
  }
}
