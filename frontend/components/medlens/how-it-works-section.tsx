"use client"
import { Camera, Mic, ClipboardCheck, Send } from "lucide-react"

const steps = [
  {
    number: "01",
    icon: Camera,
    title: "Point Your Camera",
    description: "Open a consultation and point your device at your medications. MedLens sees labels, bottles, and pill imprints.",
    detail: "Supports bottles, blister packs, pill imprints",
  },
  {
    number: "02",
    icon: Mic,
    title: "Talk to Aria",
    description: 'Ask questions naturally: "Can I take this with grapefruit?" Aria responds with context from your health records.',
    detail: "Interruptible at any time — just speak",
  },
  {
    number: "03",
    icon: ClipboardCheck,
    title: "Review Summary",
    description: "End the session to see a full breakdown: detected medications, interactions found, and safety notes.",
    detail: "FDA-grounded, zero hallucinations",
  },
  {
    number: "04",
    icon: Send,
    title: "Share With Your Doctor",
    description: "One tap to email the summary to your physician, generate a medication schedule, or sync dosage times to your calendar.",
    detail: "Gmail, Google Docs & Calendar integrated",
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="px-6 py-28 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-background" />

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-20 max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700/70 mb-4">
            How It Works
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight leading-tight">
            Four steps to safer{" "}
            <span className="italic font-semibold" style={{
              background: "linear-gradient(100deg, #3d8f5f 0%, #a87830 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              medication management
            </span>
          </h2>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[27px] top-0 bottom-0 w-px bg-gradient-to-b from-emerald-300/40 via-amber-300/40 to-transparent md:left-1/2 md:-translate-x-px" />

          <div className="flex flex-col gap-0">
            {steps.map((step, i) => {
              const isEven = i % 2 === 0
              return (
                <div
                  key={step.number}
                  className={`relative flex items-start gap-6 pb-14 last:pb-0
                    md:grid md:grid-cols-2 md:gap-12 md:items-center`}
                >
                  {/* Step node */}
                  <div className="absolute left-0 md:left-1/2 md:-translate-x-1/2 z-10">
                    <div className="flex items-center justify-center size-14 rounded-2xl bg-background border-2 border-border shadow-sm"
                      style={{ background: "linear-gradient(135deg, rgba(61,143,95,0.08) 0%, rgba(168,120,48,0.08) 100%)" }}
                    >
                      <step.icon className="size-5 text-primary" />
                    </div>
                  </div>

                  {/* Left slot (even = content, odd = empty on desktop) */}
                  <div className={`pl-20 md:pl-0 md:text-right ${isEven ? "md:block" : "md:block md:order-last"}`}>
                    {isEven ? (
                      <StepContent step={step} align="right" />
                    ) : (
                      <div className="hidden md:block" />
                    )}
                  </div>

                  {/* Right slot */}
                  <div className={`hidden md:block ${isEven ? "" : ""}`}>
                    {!isEven ? (
                      <StepContent step={step} align="left" />
                    ) : (
                      <div className="hidden md:block" />
                    )}
                  </div>

                  {/* Mobile: always show content */}
                  <div className="md:hidden pl-20">
                    {!isEven && <StepContent step={step} align="left" />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

function StepContent({ step, align }: { step: typeof steps[0]; align: "left" | "right" }) {
  return (
    <div className={`flex flex-col gap-2 ${align === "right" ? "items-start md:items-end" : "items-start"}`}>
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700/60">
        Step {step.number}
      </span>
      <h3 className={`text-xl font-bold text-foreground ${align === "right" ? "md:text-right" : ""}`}>
        {step.title}
      </h3>
      <p className={`text-sm text-muted-foreground leading-relaxed max-w-xs ${align === "right" ? "md:text-right" : ""}`}>
        {step.description}
      </p>
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-primary/70 mt-1`}>
        <span className="size-1 rounded-full bg-primary/40 inline-block" />
        {step.detail}
      </span>
    </div>
  )
}