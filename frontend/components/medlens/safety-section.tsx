"use client"
import { ShieldCheck, Lock, AlertTriangle } from "lucide-react"

const pillars = [
  {
    icon: AlertTriangle,
    title: "AI Disclaimer",
    body: 'Every session begins with a clear reminder: "I am an AI, not a doctor. In an emergency, call 911."',
    label: "Transparency",
    iconColor: "text-amber-600",
    iconBg: "bg-amber-500/10",
    border: "border-amber-200/60",
  },
  {
    icon: Lock,
    title: "HIPAA Compliant",
    body: "All health data is encrypted at rest and in transit. Your information never leaves a secure environment.",
    label: "Privacy",
    iconColor: "text-blue-600",
    iconBg: "bg-blue-500/10",
    border: "border-blue-200/60",
  },
  {
    icon: ShieldCheck,
    title: "FDA Grounded",
    body: "Interaction checks are verified against real-time FDA databases using Google Search Grounding. No guesses.",
    label: "Accuracy",
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-500/10",
    border: "border-emerald-200/60",
  },
]

export function SafetySection() {
  return (
    <section id="safety" className="px-6 py-28 relative overflow-hidden">
      {/* Warm background matching features */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#f0ede6] to-[#f7f5f0]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Header — large editorial treatment */}
        <div className="mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700/70 mb-4">
            Safety & Compliance
          </p>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight leading-tight max-w-sm">
              Built with safety{" "}
              <span className="italic font-semibold" style={{
                background: "linear-gradient(100deg, #3d8f5f 0%, #a87830 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                at every layer
              </span>
            </h2>
            {/* Big stat */}
            <div className="flex items-baseline gap-3 md:text-right">
              <span className="text-5xl font-bold" style={{
                background: "linear-gradient(135deg, #3d8f5f, #a87830)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>0</span>
              <span className="text-sm text-muted-foreground max-w-[140px] leading-snug">
                hallucinations — every answer is grounded in real data
              </span>
            </div>
          </div>
        </div>

        {/* Cards — horizontal on desktop, distinct from features grid */}
        <div className="flex flex-col md:flex-row gap-5">
          {pillars.map((pillar, i) => (
            <div
              key={pillar.title}
              className={`flex-1 relative rounded-2xl border ${pillar.border} p-7 overflow-hidden group hover:shadow-md transition-shadow`}
              style={{ background: "rgba(255,255,255,0.75)" }}
            >
              {/* Large background number */}
              <span className="absolute top-3 right-5 text-8xl font-black text-foreground/[0.03] select-none leading-none">
                {String(i + 1).padStart(2, "0")}
              </span>

              <div className="relative z-10 flex flex-col gap-4 h-full">
                <div className="flex items-center justify-between">
                  <div className={`flex items-center justify-center size-11 rounded-xl ${pillar.iconBg}`}>
                    <pillar.icon className={`size-5 ${pillar.iconColor}`} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">
                    {pillar.label}
                  </span>
                </div>

                <div className="flex flex-col gap-2 flex-1">
                  <h3 className="text-lg font-bold text-foreground">{pillar.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{pillar.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom trust bar */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-8 py-6 border-t border-border/40">
          {[
            { icon: "🔒", label: "End-to-end encrypted" },
            { icon: "🏥", label: "HIPAA compliant" },
            { icon: "⚡", label: "Real-time FDA data" },
            { icon: "🚫", label: "No data sold, ever" },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}