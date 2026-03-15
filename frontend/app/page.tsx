"use client"

import { useState } from "react"
import { Navbar } from "@/components/medlens/navbar"
import { FeaturesSection } from "@/components/medlens/features-section"
import { HowItWorksSection } from "@/components/medlens/how-it-works-section"
import { SafetySection } from "@/components/medlens/safety-section"
import { Footer } from "@/components/medlens/footer"
import { SessionView } from "@/components/medlens/session-view"
import { SummaryDashboard } from "@/components/medlens/summary-dashboard"
import { GoogleHealthConnect } from "@/components/medlens/google-health-connect"

type AppView = "landing" | "session" | "summary" | "dashboard"

export default function Home() {
  const [view, setView] = useState<AppView>("landing")
  const [lastSummary, setLastSummary] = useState<any>(null)

  if (view === "session") {
    return (
      <SessionView
        onStop={(summary?: any) => {
          if (summary) setLastSummary(summary)
          setView("summary")
        }}
      />
    )
  }

  if (view === "summary") {
    return <SummaryDashboard onBack={() => setView("landing")} summary={lastSummary} />
  }

  if (view === "dashboard") {
  return <SummaryDashboard onBack={() => setView("landing")} summary={null} />
}

  return (
    <div className="min-h-screen bg-background">
      <Navbar onStart={() => setView("session")} onDashboard={() => setView("dashboard")} />
      <main>
        {/* Google Health Connect — hero + main CTA */}
        <GoogleHealthConnect onStart={() => setView("session")} />

        <FeaturesSection />
        <HowItWorksSection />
        <SafetySection />
      </main>
      <Footer />
    </div>
  )
}
