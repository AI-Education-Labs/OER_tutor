"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  BookOpen,
  MessageSquare,
  Layers,
  CheckCircle,
  FileText,
  BarChart3,
  GraduationCap,
  ArrowRight,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

function useFadeInOnScroll() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("opacity-100", "translate-y-0")
          el.classList.remove("opacity-0", "translate-y-8")
          observer.unobserve(el)
        }
      },
      { threshold: 0.15 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return ref
}

const CAROUSEL_SLIDES = [
  { id: 1, label: "AI Tutor Demo" },
  { id: 2, label: "Flashcard Generation" },
  { id: 3, label: "Concept Check Quiz" },
  { id: 4, label: "Study Guide Preview" },
  { id: 5, label: "Progress Dashboard" },
]

const FEATURES = [
  {
    icon: MessageSquare,
    title: "AI Socratic Tutor",
    description:
      "Ask questions about your textbook and get guided to understanding through intelligent dialogue — not just answers.",
  },
  {
    icon: Layers,
    title: "Smart Flashcards",
    description:
      "AI-generated flashcards built from your chapter content with spaced repetition to lock in key concepts.",
  },
  {
    icon: CheckCircle,
    title: "Concept Checks",
    description:
      "Auto-generated quizzes that test your understanding and highlight areas that need more attention.",
  },
  {
    icon: FileText,
    title: "Study Guides",
    description:
      "AI-condensed notes with worked examples, key takeaways, and step-by-step explanations.",
  },
  {
    icon: BarChart3,
    title: "Progress Tracking",
    description:
      "See how far you've come chapter by chapter. Track reading progress, quiz scores, and study sessions.",
  },
  {
    icon: GraduationCap,
    title: "Course Integration",
    description:
      "Join courses created by your professors, access curated textbooks, and study alongside your classmates.",
  },
]

const STEPS = [
  {
    number: "1",
    title: "Sign up for free",
    description: "Create an account in seconds — no credit card, no catch.",
  },
  {
    number: "2",
    title: "Join a course",
    description: "Browse available courses or enter an invite code from your professor.",
  },
  {
    number: "3",
    title: "Start learning",
    description: "Open your textbook and let AI-powered tools guide your study sessions.",
  },
]

/* ---------- Hero Section ---------- */

function HeroSection() {
  const router = useRouter()
  const [activeSlide, setActiveSlide] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % CAROUSEL_SLIDES.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const scrollToFeatures = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <section className="relative h-[calc(100vh-2rem)] overflow-hidden flex items-center justify-center">
      {/* Background carousel slides */}
      {CAROUSEL_SLIDES.map((slide, index) => (
        <div
          key={slide.id}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            index === activeSlide ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="w-full h-full bg-background-surface flex items-center justify-center border-2 border-dashed" style={{ borderColor: "rgba(150,150,150,0.2)" }}>
            <span className="text-foreground-muted text-lg select-none">
              Coming Soon
            </span>
          </div>
        </div>
      ))}

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 z-10" style={{ background: "linear-gradient(to bottom, rgba(30,30,30,0.92), rgba(30,30,30,0.82), #1e1e1e)" }} />

      {/* Atmospheric glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-[120px] z-10 pointer-events-none" style={{ backgroundColor: "rgba(252,92,0,0.1)" }} />

      {/* Hero content */}
      <div className="relative z-20 text-center px-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8" style={{ border: "1px solid rgba(252,92,0,0.3)", backgroundColor: "rgba(252,92,0,0.05)" }}>
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm text-foreground-secondary">AI-Powered Learning — Always Free</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
          Your Intelligent{" "}
          <span className="text-primary">Study Partner</span>
        </h1>

        <p className="text-lg md:text-xl text-foreground-secondary mb-10 max-w-2xl mx-auto leading-relaxed">
          Personalized AI tutoring that adapts to your textbook. Smart flashcards,
          guided dialogue, and study tools designed to accelerate how you learn.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="lg"
            onClick={() => router.push("/auth?tab=register")}
            className="bg-primary hover:bg-primary-hover text-white px-8 py-3 text-base"
          >
            Get Started Free
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={scrollToFeatures}
            className="text-foreground-secondary hover:text-foreground hover:bg-background-surface px-8 py-3 text-base"
            style={{ border: "1px solid rgba(150,150,150,0.3)" }}
          >
            Learn More
          </Button>
        </div>
      </div>

      {/* Slide indicator dots */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {CAROUSEL_SLIDES.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => setActiveSlide(index)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === activeSlide ? "bg-primary w-6" : ""
            }`}
            style={
              index !== activeSlide
                ? { backgroundColor: "rgba(150,150,150,0.4)" }
                : undefined
            }
            aria-label={`Go to slide ${index + 1}: ${slide.label}`}
          />
        ))}
      </div>
    </section>
  )
}

/* ---------- Features Grid ---------- */

function FeaturesSection() {
  const ref = useFadeInOnScroll()

  return (
    <section
      id="features"
      className="py-20 md:py-28 px-4"
    >
      <div
        ref={ref}
        className="max-w-6xl mx-auto opacity-0 translate-y-8 transition-all duration-700 ease-out"
      >
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything You Need to Study Smarter
          </h2>
          <p className="text-foreground-secondary text-lg max-w-2xl mx-auto">
            Six AI-powered tools that work together with your textbook to help you
            understand — not just memorize.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature) => (
            <Card
              key={feature.title}
              className="bg-background-secondary border-border hover:-translate-y-1 transition-transform duration-300"
            >
              <CardHeader>
                <feature.icon className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg text-foreground">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground-secondary text-sm leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------- How It Works ---------- */

function HowItWorksSection() {
  const ref = useFadeInOnScroll()

  return (
    <section className="py-20 md:py-28 px-4 bg-background-secondary">
      <div
        ref={ref}
        className="max-w-5xl mx-auto opacity-0 translate-y-8 transition-all duration-700 ease-out"
      >
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Get Started in Three Steps
          </h2>
          <p className="text-foreground-secondary text-lg">
            From sign-up to studying in under a minute.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 relative">
          {/* Connecting line (desktop only) */}
          <div className="hidden md:block absolute top-10 left-[20%] right-[20%] h-px bg-border" />

          {STEPS.map((step) => (
            <div key={step.number} className="text-center relative">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-background border-2 border-accent-teal text-accent-teal text-xl font-bold mb-5 relative z-10">
                {step.number}
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {step.title}
              </h3>
              <p className="text-foreground-secondary text-sm max-w-xs mx-auto">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------- AI Showcase ---------- */

function AIShowcaseSection() {
  const ref = useFadeInOnScroll()

  return (
    <section className="py-20 md:py-28 px-4">
      <div
        ref={ref}
        className="max-w-3xl mx-auto text-center opacity-0 translate-y-8 transition-all duration-700 ease-out"
      >
        <Sparkles className="h-10 w-10 text-primary mx-auto mb-6" />

        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
          We Don&apos;t Give You Answers —{" "}
          <span className="text-primary">We Help You Understand</span>
        </h2>

        <div className="space-y-5 text-foreground-secondary text-base md:text-lg leading-relaxed">
          <p>
            TextbookAI uses a Socratic approach to tutoring. Instead of handing you
            the answer, our AI asks the right questions to guide you toward genuine
            understanding — the kind that sticks on exam day.
          </p>
          <p>
            Every response is chapter-aware, pulling directly from your textbook
            content so you stay on topic and build knowledge in context. No
            hallucinated facts, no off-topic tangents.
          </p>
          <p>
            Built on{" "}
            <span className="text-accent-teal font-medium">
              Open Educational Resources
            </span>
            , TextbookAI pairs free textbooks with free tools — because access to
            quality education shouldn&apos;t depend on your budget.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ---------- Bottom CTA ---------- */

function BottomCTASection() {
  const router = useRouter()
  const ref = useFadeInOnScroll()

  return (
    <section className="py-20 md:py-28 px-4 bg-background-secondary">
      <div
        ref={ref}
        className="max-w-2xl mx-auto text-center opacity-0 translate-y-8 transition-all duration-700 ease-out"
      >
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
          Ready to Transform Your Study Sessions?
        </h2>
        <p className="text-foreground-secondary text-lg mb-8">
          Join students who are already studying smarter with AI-powered tools.
        </p>
        <Button
          size="lg"
          onClick={() => router.push("/auth?tab=register")}
          className="bg-primary hover:bg-primary-hover text-white px-10 py-3 text-base"
        >
          Get Started Free
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <p className="text-foreground-muted text-sm mt-4">
          No credit card required. Always free for students.
        </p>
      </div>
    </section>
  )
}

/* ---------- Footer ---------- */

function FooterSection() {
  return (
    <footer className="py-8 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground-secondary">
            TextbookAI
          </span>
        </div>
        <p className="text-foreground-muted text-xs text-center">
          Built for students. Powered by AI. Part of a research initiative to make education more accessible.
        </p>
      </div>
    </footer>
  )
}

/* ---------- Landing Page Root ---------- */

export function LandingPage() {
  return (
    <div className="bg-background">
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <AIShowcaseSection />
      <BottomCTASection />
      <FooterSection />
    </div>
  )
}
