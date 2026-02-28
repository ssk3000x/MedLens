"use client"

import { ArrowRight, Eye, Mic, ShieldCheck } from "lucide-react"

export function HeroSection({ onStart }: { onStart?: () => void }) {
  return (
    <section className="relative flex flex-col items-center justify-center min-h-screen px-6 pt-24 pb-16 overflow-hidden">
      {/* Subtle background accent */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="flex flex-col items-center gap-6 max-w-3xl text-center">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
          <ShieldCheck className="size-4" />
          <span>AI-Powered Medication Safety</span>
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground tracking-tight text-balance leading-tight">
          Your medications, understood.
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed text-pretty">
          An always-on AI pharmacist that sees what you see and understands your unique health history. No more confusion about pills, doses, or interactions.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mt-4">
          <button
            onClick={onStart}
            className="flex items-center gap-2 h-12 px-8 rounded-xl bg-primary text-primary-foreground font-medium text-base hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 cursor-pointer"
          >
            Start Consultation
            <ArrowRight className="size-4" />
          </button>
          <a
            href="#how-it-works"
            className="flex items-center gap-2 h-12 px-8 rounded-xl border border-border text-foreground font-medium text-base hover:bg-secondary transition-colors"
          >
            See How It Works
          </a>
        </div>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-16">
        <FeaturePill icon={<Eye className="size-4" />} label="Autonomous Vision" />
        <FeaturePill icon={<Mic className="size-4" />} label="Voice-First Interface" />
        <FeaturePill icon={<ShieldCheck className="size-4" />} label="FDA Verified" />
      </div>
    </section>
  )
}

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border text-sm text-muted-foreground">
      <span className="text-primary">{icon}</span>
      {label}
    </div>
  )
}
