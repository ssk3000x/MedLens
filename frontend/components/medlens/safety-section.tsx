"use client"

import { ShieldCheck, Lock, AlertTriangle } from "lucide-react"

export function SafetySection() {
  return (
    <section id="safety" className="px-6 py-24 bg-card">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col items-center text-center gap-4 mb-16">
          <p className="text-sm font-medium text-primary uppercase tracking-wider">
            Safety & Compliance
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight text-balance">
            Built with safety at every layer
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col items-center text-center gap-4 p-8 rounded-xl border border-border bg-background">
            <div className="flex items-center justify-center size-14 rounded-2xl bg-primary/10">
              <AlertTriangle className="size-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              AI Disclaimer
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Every session begins with a clear reminder: &quot;I am an AI, not a doctor. In an emergency, call 911.&quot;
            </p>
          </div>

          <div className="flex flex-col items-center text-center gap-4 p-8 rounded-xl border border-border bg-background">
            <div className="flex items-center justify-center size-14 rounded-2xl bg-primary/10">
              <Lock className="size-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              HIPAA Compliant
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All health data is encrypted at rest and in transit. Your information never leaves a secure environment.
            </p>
          </div>

          <div className="flex flex-col items-center text-center gap-4 p-8 rounded-xl border border-border bg-background">
            <div className="flex items-center justify-center size-14 rounded-2xl bg-primary/10">
              <ShieldCheck className="size-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              FDA Grounded
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Interaction checks are verified against real-time FDA databases using Google Search Grounding. No guesses.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
