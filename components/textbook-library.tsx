"use client"

import { useEffect, useState } from "react"
import { Search, Plus, BookOpen, Star, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"

interface Textbook {
  id: string
  title: string
  author: string
  subject: string
  cover: string
  progress?: number
  lastAccessed?: string
  starred?: boolean
}

export function TextbookLibrary() {
  const [searchQuery, setSearchQuery] = useState("")
  const [myTextbooks, setMyTextbooks] = useState<Textbook[]>([])

  // Load available textbooks from API and use the UUID (`_id`) from metadata.json as the id
  useEffect(() => {
    const loadTextbooks = async () => {
      try {
        const resp = await fetch("/api/textbooks")
        if (!resp.ok) throw new Error(`Failed to fetch textbooks (${resp.status})`)
        const data = await resp.json()

        const textbook_list: Textbook[] = []

        for (const t of data) {
          textbook_list.push({
            id: String(t.id ?? ""),
            title: t.title ?? "Untitled",
            author: t.author ?? "",
            subject: t.subject ?? "",
            cover: t.cover ?? "/Physics_cover.png",
            progress: 0,
          })
        }

        setMyTextbooks(textbook_list)
      } catch (error) {
        console.error("Error loading textbooks:", error)
      }
    }
    loadTextbooks()
  }, [])

  const searchResults = [
    {
      id: "3",
      title: "Organic Chemistry",
      author: "Paula Bruice",
      subject: "Chemistry",
      cover: "/placeholder.svg?height=200&width=150&query=organic chemistry textbook",
    },
    {
      id: "4",
      title: "Physics for Scientists and Engineers",
      author: "Raymond Serway",
      subject: "Physics",
      cover: "/placeholder.svg?height=200&width=150&query=physics textbook",
    },
  ]

  const addTextbook = (textbook: Textbook) => {
    setMyTextbooks([...myTextbooks, { ...textbook, progress: 0 }])
  }

  return (
    <div className="min-h-screen bg-[#1e1e1e] text-[#cccccc]">
      {/* VSCode-style title bar */}
      <div className="h-8 bg-[#323233] border-b border-[#2d2d30] flex items-center px-4">
        <div className="flex-1 text-center text-sm">Textbook Library</div>
      </div>

      {/* Main content */}
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold mb-2 text-[#ffffff]">Your Learning Library</h1>
          <p className="text-[#969696]">Search and add textbooks to start your interactive learning journey</p>
        </div>

        {/* Search bar */}
        <div className="mb-8">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#969696]" />
            <Input
              placeholder="Search textbooks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#2d2d30] border-[#3e3e42] text-[#cccccc] placeholder-[#969696] focus:border-[#007acc]"
            />
          </div>
        </div>

        {/* My Textbooks */}
        <div className="mb-12">
          <h2 className="text-lg font-medium mb-4 text-[#ffffff] flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            My Textbooks ({myTextbooks.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {myTextbooks.map((book) => (
              <Link key={book.id} href={`/study/${book.id}`}>
                <Card className="bg-[#2d2d30] border-[#3e3e42] hover:border-[#007acc] transition-colors cursor-pointer group">
                  <CardContent className="p-4">
                    <div className="relative mb-3">
                      <img
                        src={book.cover}
                        alt={book.title}
                        className="w-100 h-32 object-cover rounded group-hover:scale-105 transition-transform"
                      />
          
                      {book.starred && <Star className="absolute top-2 right-2 w-4 h-4 text-[#ffbd2e] fill-current" />}
                    </div>

                    <h3 className="font-medium text-sm mb-1 text-[#ffffff] line-clamp-2">{book.title}</h3>
                    <p className="text-xs text-[#969696] mb-2">{book.author}</p>
                    <p className="text-xs text-[#4ec9b0] mb-2">{book.subject}</p>

                    {book.progress !== undefined && (
                      <div className="mb-2">
                        <div className="flex justify-between text-xs text-[#969696] mb-1">
                          <span>Progress</span>
                          <span>{book.progress}%</span>
                        </div>
                        <div className="w-full bg-[#3e3e42] rounded-full h-1">
                          <div
                            className="bg-[#007acc] h-1 rounded-full transition-all"
                            style={{ width: `${book.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {book.lastAccessed && (
                      <div className="flex items-center gap-1 text-xs text-[#969696]">
                        <Clock className="w-3 h-3" />
                        {book.lastAccessed}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Search Results */}
        {searchQuery && (
          <div>
            <h2 className="text-lg font-medium mb-4 text-[#ffffff] flex items-center gap-2">
              <Search className="w-5 h-5" />
              Search Results
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {searchResults
                .filter(
                  (book) =>
                    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    book.subject.toLowerCase().includes(searchQuery.toLowerCase()),
                )
                .map((book) => (
                  <Card
                    key={book.id}
                    className="bg-[#2d2d30] border-[#3e3e42] hover:border-[#007acc] transition-colors"
                  >
                    <CardContent className="p-4">
                      <img
                        src={book.cover || "/placeholder.svg"}
                        alt={book.title}
                        className="w-full h-32 object-cover rounded mb-3"
                      />

                      <h3 className="font-medium text-sm mb-1 text-[#ffffff] line-clamp-2">{book.title}</h3>
                      <p className="text-xs text-[#969696] mb-2">{book.author}</p>
                      <p className="text-xs text-[#4ec9b0] mb-3">{book.subject}</p>

                      <Button
                        onClick={() => addTextbook(book)}
                        size="sm"
                        className="w-full bg-[#007acc] hover:bg-[#005a9e] text-white text-xs"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add to Library
                      </Button>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
