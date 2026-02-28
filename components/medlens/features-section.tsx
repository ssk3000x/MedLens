"use client"

import { Eye, MessageSquare, Shield, FileText, Mail, CalendarDays } from "lucide-react"

const features = [
  {
    icon: Eye,
    title: "Autonomous Vision",
    description:
      "Point your camera at any medication. Gemini Vision parses drug names, dosages, and imprint codes automatically.",
  },
  {
    icon: MessageSquare,
    title: "Interruptible Voice",
    description:
      "Aria, your AI pharmacist, stops speaking immediately when you talk. Natural, patient conversation.",
  },
  {
    icon: Shield,
    title: "Real-Time Safety Checks",
    description:
      "Every interaction is verified against live FDA data using Google Search Grounding. No hallucinations.",
  },
  {
    icon: Mail,
    title: "Doctor Draft",
    description:
      "After each session, a summary email draft is prepared for your physician automatically via Gmail.",
  },
  {
    icon: FileText,
    title: "Shareable Schedule",
    description:
      "A clear medication schedule is generated as a Google Doc, ready to share with caregivers and family.",
  },
  {
    icon: CalendarDays,
    title: "Calendar Sync",
    description:
      "Dosage times are synced to your Google Calendar so you never miss a dose again.",
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="px-6 py-24 bg-card">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col items-center text-center gap-4 mb-16">
          <p className="text-sm font-medium text-primary uppercase tracking-wider">
            Features
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight text-balance">
            Everything you need for medication safety
          </h2>
          <p className="text-muted-foreground max-w-lg leading-relaxed text-pretty">
            From live camera analysis to post-session doctor communication, MedLens handles the entire workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col gap-4 p-6 rounded-xl border border-border bg-background hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-center size-11 rounded-lg bg-primary/10">
                <feature.icon className="size-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
