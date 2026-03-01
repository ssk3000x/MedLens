"use client"

import { useState } from "react"
import { Navbar } from "@/components/medlens/navbar"
import { HeroSection } from "@/components/medlens/hero-section"
import { FeaturesSection } from "@/components/medlens/features-section"
import { HowItWorksSection } from "@/components/medlens/how-it-works-section"
import { SafetySection } from "@/components/medlens/safety-section"
import { Footer } from "@/components/medlens/footer"
import { SessionView } from "@/components/medlens/session-view"
import { SummaryDashboard } from "@/components/medlens/summary-dashboard"

type AppView = "landing" | "session" | "summary"

export default function Home() {
  const [view, setView] = useState<AppView>("landing")

  if (view === "session") {
    return <SessionView onStop={() => setView("summary")} />
  }

  if (view === "summary") {
    return <SummaryDashboard onBack={() => setView("landing")} />
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar onStart={() => setView("session")} />
      <main>
        <HeroSection onStart={() => setView("session")} />
        <FeaturesSection />
        <HowItWorksSection />
        <SafetySection />
      </main>
      <Footer />
    </div>
  )
}
