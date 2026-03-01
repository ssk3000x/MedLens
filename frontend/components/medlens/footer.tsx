"use client"

import { Pill } from "lucide-react"

export function Footer() {
  return (
    <footer className="px-6 py-12 border-t border-border">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center size-8 rounded-lg bg-primary">
            <Pill className="size-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold text-foreground">MedLens</span>
        </div>
        <p className="text-xs text-muted-foreground text-center max-w-md leading-relaxed">
          MedLens is an AI assistant and does not replace professional medical advice. Always consult with your healthcare provider. In an emergency, call 911.
        </p>
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <span>Privacy</span>
          <span>Terms</span>
          <span>Support</span>
        </div>
      </div>
    </footer>
  )
}
