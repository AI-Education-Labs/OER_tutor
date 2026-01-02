"use client"

import { useEffect, useState } from "react"
import { Search, Plus, BookOpen, Star, Clock, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { useToast } from "@/hooks/use-toast"

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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(false)
  const [message, setMessage] = useState<string | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [codeValue, setCodeValue] = useState("")
  const { toast } = useToast()

  // Load available textbooks
  useEffect(() => {
    const loadTextbooks = async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null
        const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL
        const resp = await fetch(`${backendUrl}/api/v1/textbooks/list`, {
          cache: "no-store",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })
        if (!resp.ok) throw new Error(`Failed to fetch textbooks (${resp.status})`)
        const data = await resp.json()


        // Backend returns { textbooks: [], is_authenticated: boolean, message?: string }
        const payload = Array.isArray(data)
          ? { textbooks: data, is_authenticated: true as boolean, message: null as string | null }
          : (data as { textbooks?: any[]; is_authenticated?: boolean; message?: string | null })

        console.log("TextbookLibrary: inferred is_authenticated:", payload?.is_authenticated)
        setIsAuthenticated(Boolean(payload?.is_authenticated))
        setMessage(payload?.message ?? null)

        const textbook_list: Textbook[] = (payload?.textbooks ?? []).map((t: any) => ({
          id: String(t.id ?? ""),
          title: t.title ?? "Untitled",
          author: t.author ?? "",
          subject: t.subject ?? "",
          cover: t.cover ?? "/Physics_cover.png",
          progress: 0,
        }))
        console.log("TextbookLibrary: textbook_list:", textbook_list)
        setMyTextbooks(textbook_list)
      } catch (error) {
        console.error("TextbookLibrary: error loading textbooks:", error)
      }
    }
    loadTextbooks()
  }, [])

  const filteredTextbooks = myTextbooks.filter((book) => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    return (
      book.title.toLowerCase().includes(q) ||
      book.author.toLowerCase().includes(q) ||
      book.subject.toLowerCase().includes(q)
    )
  })

  return (
    <div className="min-h-screen bg-background text-foreground-secondary">
      {/* VSCode-style title bar */}
      <div className="h-8 bg-background-tertiary border-b border-border flex items-center px-4">
        <div className="flex-1 text-center text-sm">Textbook Library</div>
      </div>

      {/* Main content */}
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold mb-2 text-foreground">Your Learning Library</h1>
          <p className="text-foreground-muted">Search and add textbooks to start your interactive learning journey</p>
        </div>

        {/* Search bar */}
        <div className="mb-8">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground-muted" />
            <Input
              placeholder="Search textbooks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background-tertiary border-border text-foreground-secondary placeholder-foreground-muted focus:border-primary"
            />
          </div>
        </div>

        {/* My Textbooks */}
        <div className="mb-12">
          <h2 className="text-lg font-medium mb-4 text-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            My Textbooks ({filteredTextbooks.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {isAuthenticated === false && (
              <Card className="bg-background-tertiary border-border flex items-center justify-center h-48">
                <CardContent className="flex flex-col items-center justify-center text-center p-6">
                  <LogIn className="w-8 h-8 text-foreground-muted mb-2" />
                  <div className="text-sm text-foreground-secondary mb-3">{message || "Sign in to see your textbooks!"}</div>
                  <Link href="/auth">
                    <Button size="sm" className="bg-primary hover:bg-primary-hover text-white">Sign in</Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {filteredTextbooks.map((book) => (
              <Link key={book.id} href={`/study/${book.id}`}>
                <Card className="bg-background-tertiary border-border hover:border-primary transition-colors cursor-pointer group">
                  <CardContent className="p-4">
                    <div className="relative mb-3">
                      <img
                        src={book.cover}
                        alt={book.title}
                        className="w-100 h-32 object-cover rounded group-hover:scale-105 transition-transform"
                      />

                      {book.starred && <Star className="absolute top-2 right-2 w-4 h-4 text-[#ffbd2e] fill-current" />}
                    </div>

                    <h3 className="font-medium text-sm mb-1 text-foreground line-clamp-2">{book.title}</h3>
                    <p className="text-xs text-foreground-muted mb-2">{book.author}</p>
                    <p className="text-xs text-accent-teal mb-2">{book.subject}</p>

                    {book.progress !== undefined && (
                      <div className="mb-2">
                        <div className="flex justify-between text-xs text-foreground-muted mb-1">
                          <span>Progress</span>
                          <span>{book.progress}%</span>
                        </div>
                        <div className="w-full bg-background-surface rounded-full h-1">
                          <div
                            className="bg-primary h-1 rounded-full transition-all"
                            style={{ width: `${book.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {book.lastAccessed && (
                      <div className="flex items-center gap-1 text-xs text-foreground-muted">
                        <Clock className="w-3 h-3" />
                        {book.lastAccessed}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}

            {isAuthenticated && (
              <button onClick={() => setAddDialogOpen(true)} className="h-full">
                <Card className="bg-[#232326] border-dashed border-2 border-border hover:border-primary transition-colors cursor-pointer flex items-center justify-center h-48">
                  <CardContent className="flex flex-col items-center justify-center p-6">
                    <div className="w-14 h-14 rounded-full border-2 border-dashed border-border flex items-center justify-center mb-3">
                      <Plus className="w-6 h-6 text-foreground-secondary" />
                    </div>
                    <div className="text-sm text-foreground-secondary">Add a textbook</div>
                  </CardContent>
                </Card>
              </button>
            )}
          </div>
        </div>


        {/* Add Textbook Modal */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="bg-background border-border text-foreground-secondary">
            <DialogHeader>
              <DialogTitle>Enter 6-Character Textbook Code</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center py-2">
              <InputOTP
                maxLength={6}
                value={codeValue}
                onChange={(v: string) => {
                  setCodeValue(v)
                  if (v.length === 6) {
                    ;(async () => {
                      try {
                        const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null
                        const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL
                        const res = await fetch(`${backendUrl}/api/v1/textbooks/add`, {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            ...(token ? { Authorization: `Bearer ${token}` } : {}),
                          },
                          body: JSON.stringify({ code: v.toUpperCase() }),
                        })
                        const text = await res.text()
                        let data: any = {}
                        try {
                          data = text ? JSON.parse(text) : {}
                        } catch {}
                        if (res.ok && data?.ok) {
                          toast({ title: "Added to library", description: `${data?.title || "Textbook"} added.` })
                          // Refresh textbooks
                          const token2 = typeof window !== "undefined" ? localStorage.getItem("access_token") : null
                          const resp = await fetch(`${backendUrl}/api/v1/textbooks/list`, {
                            cache: "no-store",
                            headers: { ...(token2 ? { Authorization: `Bearer ${token2}` } : {}) },
                          })
                          if (resp.ok) {
                            const payload = await resp.json()
                            const pls = Array.isArray(payload)
                              ? { textbooks: payload, is_authenticated: true, message: null }
                              : payload
                            const textbook_list: Textbook[] = (pls?.textbooks ?? []).map((t: any) => ({
                              id: String(t.id ?? ""),
                              title: t.title ?? "Untitled",
                              author: t.author ?? "",
                              subject: t.subject ?? "",
                              cover: t.cover ?? "/Physics_cover.png",
                              progress: 0,
                            }))
                            setMyTextbooks(textbook_list)
                          }
                        } else {
                          const msg = data?.error || "Invalid code"
                          toast({ title: "Invalid code", description: msg })
                        }
                      } catch (e) {
                        console.error("Failed to submit code", e)
                        toast({ title: "Error", description: "Could not add textbook. Try again." })
                      } finally {
                        setAddDialogOpen(false)
                        setTimeout(() => setCodeValue(""), 200)
                      }
                    })()
                  }
                }}
              >
                <InputOTPGroup className="gap-3">
                  <InputOTPSlot
                    index={0}
                    className="h-12 w-12 rounded-md border border-black bg-white text-black text-xl font-semibold"
                  />
                  <InputOTPSlot
                    index={1}
                    className="h-12 w-12 rounded-md border border-black bg-white text-black text-xl font-semibold"
                  />
                  <InputOTPSlot
                    index={2}
                    className="h-12 w-12 rounded-md border border-black bg-white text-black text-xl font-semibold"
                  />
                  <InputOTPSlot
                    index={3}
                    className="h-12 w-12 rounded-md border border-black bg-white text-black text-xl font-semibold"
                  />
                  <InputOTPSlot
                    index={4}
                    className="h-12 w-12 rounded-md border border-black bg-white text-black text-xl font-semibold"
                  />
                  <InputOTPSlot
                    index={5}
                    className="h-12 w-12 rounded-md border border-black bg-white text-black text-xl font-semibold"
                  />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
