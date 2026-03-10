"use client"
import { Eye, MessageSquare, Shield, FileText, Mail, CalendarDays } from "lucide-react"

const features = [
  {
    icon: Eye,
    title: "Autonomous Vision",
    description: "Point your camera at any medication. Gemini Vision parses drug names, dosages, and imprint codes automatically.",
    tag: "Vision AI",
    accent: "from-emerald-500/10 to-teal-500/5",
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-500/10",
  },
  {
    icon: MessageSquare,
    title: "Interruptible Voice",
    description: "Aria, your AI pharmacist, stops speaking immediately when you talk. Natural, patient conversation.",
    tag: "Voice",
    accent: "from-amber-500/10 to-yellow-500/5",
    iconColor: "text-amber-600",
    iconBg: "bg-amber-500/10",
  },
  {
    icon: Shield,
    title: "Real-Time Safety Checks",
    description: "Every interaction is verified against live FDA data using Google Search Grounding. No hallucinations.",
    tag: "Safety",
    accent: "from-blue-500/10 to-indigo-500/5",
    iconColor: "text-blue-600",
    iconBg: "bg-blue-500/10",
  },
  {
    icon: Mail,
    title: "Doctor Draft",
    description: "After each session, a summary email draft is prepared for your physician automatically via Gmail.",
    tag: "Automation",
    accent: "from-violet-500/10 to-purple-500/5",
    iconColor: "text-violet-600",
    iconBg: "bg-violet-500/10",
  },
  {
    icon: FileText,
    title: "Shareable Schedule",
    description: "A clear medication schedule is generated as a Google Doc, ready to share with caregivers and family.",
    tag: "Docs",
    accent: "from-rose-500/10 to-pink-500/5",
    iconColor: "text-rose-600",
    iconBg: "bg-rose-500/10",
  },
  {
    icon: CalendarDays,
    title: "Calendar Sync",
    description: "Dosage times are synced to your Google Calendar so you never miss a dose again.",
    tag: "Scheduling",
    accent: "from-teal-500/10 to-cyan-500/5",
    iconColor: "text-teal-600",
    iconBg: "bg-teal-500/10",
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="px-6 py-28 relative overflow-hidden">
      {/* Warm background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#f7f5f0] to-[#f0ede6]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-16 max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700/70 mb-4">
            Features
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight leading-tight mb-4">
            Everything you need for{" "}
            <span className="italic font-semibold" style={{
              background: "linear-gradient(100deg, #3d8f5f 0%, #a87830 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              medication safety
            </span>
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            From live camera analysis to post-session doctor communication, MedLens handles the entire workflow.
          </p>
        </div>

        {/* Feature grid — asymmetric, editorial */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border/30 rounded-2xl overflow-hidden border border-border/30">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={`relative flex flex-col gap-4 p-7 bg-gradient-to-br ${feature.accent} hover:brightness-[0.98] transition-all group`}
              style={{ background: "rgba(255,255,255,0.7)" }}
            >
              {/* Subtle gradient overlay on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.accent} opacity-60 group-hover:opacity-100 transition-opacity`} />
              
              <div className="relative z-10 flex items-start justify-between">
                <div className={`flex items-center justify-center size-11 rounded-xl ${feature.iconBg}`}>
                  <feature.icon className={`size-5 ${feature.iconColor}`} />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mt-1">
                  {feature.tag}
                </span>
              </div>

              <div className="relative z-10">
                <h3 className="text-base font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}