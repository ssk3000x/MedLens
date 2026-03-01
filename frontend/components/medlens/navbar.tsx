"use client"

import { Pill } from "lucide-react"

export function Navbar({ onStart }: { onStart?: () => void }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center size-9 rounded-lg bg-primary">
            <Pill className="size-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-foreground tracking-tight">
            MedLens
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a
            href="#features"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            How It Works
          </a>
          <a
            href="#safety"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Safety
          </a>
        </div>
        <button
          onClick={onStart}
          className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
        >
          Start Consultation
        </button>
      </nav>
    </header>
  )
}
