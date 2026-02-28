"use client"

import { Camera, Mic, ClipboardCheck, Send } from "lucide-react"

const steps = [
  {
    number: "01",
    icon: Camera,
    title: "Point Your Camera",
    description:
      "Open a consultation and point your device at your medications. MedLens sees labels, bottles, and pill imprints.",
  },
  {
    number: "02",
    icon: Mic,
    title: "Talk to Aria",
    description:
      'Ask questions naturally: "Can I take this with grapefruit?" Aria responds with context from your health records.',
  },
  {
    number: "03",
    icon: ClipboardCheck,
    title: "Review Summary",
    description:
      "End the session to see a full breakdown: detected medications, interactions found, and safety notes.",
  },
  {
    number: "04",
    icon: Send,
    title: "Share With Your Doctor",
    description:
      "One tap to email the summary to your physician, generate a medication schedule, or sync dosage times to your calendar.",
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="px-6 py-24">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col items-center text-center gap-4 mb-16">
          <p className="text-sm font-medium text-primary uppercase tracking-wider">
            How It Works
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight text-balance">
            Four steps to safer medication management
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {steps.map((step) => (
            <div
              key={step.number}
              className="relative flex gap-5 p-6 rounded-xl border border-border bg-card"
            >
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center size-12 rounded-xl bg-primary/10">
                  <step.icon className="size-6 text-primary" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-primary uppercase tracking-widest">
                  Step {step.number}
                </span>
                <h3 className="text-lg font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
