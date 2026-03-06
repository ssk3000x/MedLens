"use client"

import { useEffect, useState } from "react"
import { Heart, Activity, Loader2, CheckCircle2, XCircle, ArrowRight, Eye, Mic, ShieldCheck } from "lucide-react"

export function GoogleHealthConnect({ onStart }: { onStart?: () => void }) {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [fetchingData, setFetchingData] = useState(false)
  const [biometrics, setBiometrics] = useState<any>(null)

  // Check connection status on mount and after OAuth redirect
  useEffect(() => {
    // Check URL params for OAuth redirect result
    const params = new URLSearchParams(window.location.search)
    const fitConnected = params.get("fit_connected")
    const fitError = params.get("fit_error")

    if (fitConnected === "true") {
      console.log("✅ Google Health Connect: Connection successful!")
      // Clean URL without reloading
      window.history.replaceState({}, "", "/")
    }

    if (fitError) {
      console.error("❌ Google Health Connect: Connection failed -", fitError)
      window.history.replaceState({}, "", "/")
    }

    // Check current connection status
    checkStatus()
  }, [])

  // When connected, auto-fetch biometrics
  useEffect(() => {
    if (connected) {
      fetchBiometrics()
    }
  }, [connected])

  async function checkStatus() {
    try {
      const res = await fetch("/api/auth/google-fit/status")
      const data = await res.json()
      setConnected(data.connected)
      if (data.connected) {
        console.log("✅ Google Health Connect: Already connected")
      }
    } catch (err) {
      console.error("Failed to check Google Fit status:", err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchBiometrics() {
    setFetchingData(true)
    try {
      const res = await fetch("/api/fitness/data")
      const data = await res.json()

      if (res.ok) {
        setBiometrics(data)
        console.log("✅ Google Health Connect: Biometrics fetched successfully")
        console.log("   Heart Rate data points:", data.heartRate?.count ?? 0)
        console.log("   Steps data points:", data.steps?.count ?? 0)
        console.log("   Blood Pressure data points:", data.bloodPressure?.count ?? 0)
        console.log("   SpO2 data points:", data.oxygenSaturation?.count ?? 0)
        console.log("   Body Temperature data points:", data.bodyTemperature?.count ?? 0)
        console.log("   Blood Glucose data points:", data.bloodGlucose?.count ?? 0)
        console.log("   Sleep sessions:", data.sleep?.count ?? 0)
        console.log("   Fetched at:", data.fetchedAt)
      } else {
        console.error("❌ Failed to fetch biometrics:", data.error)
      }
    } catch (err) {
      console.error("❌ Error fetching biometrics:", err)
    } finally {
      setFetchingData(false)
    }
  }

  async function handleDisconnect() {
    try {
      await fetch("/api/auth/google-fit/status", { method: "DELETE" })
      setConnected(false)
      setBiometrics(null)
      console.log("✅ Google Health Connect: Disconnected")
    } catch (err) {
      console.error("Failed to disconnect:", err)
    }
  }

  if (loading) {
    return (
      <section className="relative flex flex-col items-center justify-center min-h-screen px-6 pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
        </div>
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </section>
    )
  }

  return (
    <section className="relative flex flex-col items-center justify-center min-h-screen px-6 pt-24 pb-16 overflow-hidden">
      {/* Subtle background accent */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      {/* Title area */}
      <div className="flex flex-col items-center gap-4 max-w-3xl text-center mb-10">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
          <ShieldCheck className="size-4" />
          <span>AI-Powered Medication Safety</span>
        </div>
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground tracking-tight text-balance leading-tight">
          Your medications, understood.
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed text-pretty">
          An always-on AI pharmacist that sees what you see and understands your unique health history.
        </p>
      </div>

      {/* Main Health Connect Card */}
      <div className="w-full max-w-2xl">
        <div className="rounded-2xl border border-border bg-card p-8 flex flex-col gap-6 shadow-lg">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center size-12 rounded-xl bg-red-500/10">
              <Heart className="size-6 text-red-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Google Health Connect</h3>
              <p className="text-sm text-muted-foreground">
                Sync your biometric data for personalized medication safety checks
              </p>
            </div>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-2 text-sm">
            {connected ? (
              <>
                <CheckCircle2 className="size-4 text-green-500" />
                <span className="text-green-600 dark:text-green-400 font-medium">Connected</span>
              </>
            ) : (
              <>
                <XCircle className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">Not connected</span>
              </>
            )}
          </div>

          {/* Biometric summary (when connected & data fetched) */}
          {connected && biometrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <BiometricCard
                label="Heart Rate"
                value={biometrics.heartRate?.count > 0 ? `${biometrics.heartRate.points[biometrics.heartRate.count - 1]?.values?.[0] ?? '—'}` : "—"}
                unit="bpm"
              />
              <BiometricCard
                label="Blood Pressure"
                value={biometrics.bloodPressure?.count > 0 ? `${biometrics.bloodPressure.points[biometrics.bloodPressure.count - 1]?.values?.[0] ?? '—'}/${biometrics.bloodPressure.points[biometrics.bloodPressure.count - 1]?.values?.[1] ?? '—'}` : "—"}
                unit="mmHg"
              />
              <BiometricCard
                label="Body Temp"
                value={biometrics.bodyTemperature?.count > 0 ? `${biometrics.bodyTemperature.points[biometrics.bodyTemperature.count - 1]?.values?.[0] ?? '—'}` : "—"}
                unit="°F"
              />
              <BiometricCard
                label="SpO2"
                value={biometrics.oxygenSaturation?.count > 0 ? `${biometrics.oxygenSaturation.points[biometrics.oxygenSaturation.count - 1]?.values?.[0] ?? '—'}` : "—"}
                unit="%"
              />
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Action buttons */}
          <div className="flex flex-col gap-4">
            {!connected ? (
              <a
                href="/api/auth/google-fit"
                className="flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-red-500 text-white text-base font-medium hover:bg-red-600 transition-colors"
              >
                <Activity className="size-5" />
                Connect Google Health
              </a>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={fetchBiometrics}
                  disabled={fetchingData}
                  className="flex items-center gap-2 h-10 px-5 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
                >
                  {fetchingData ? <Loader2 className="size-4 animate-spin" /> : <Activity className="size-4" />}
                  Refresh Data
                </button>
                <button
                  onClick={handleDisconnect}
                  className="flex items-center gap-2 h-10 px-5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  Disconnect
                </button>
              </div>
            )}

            {/* Start Consultation — always visible */}
            <button
              onClick={onStart}
              className="flex items-center justify-center gap-2 h-14 px-8 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 cursor-pointer"
            >
              Start Consultation
              <ArrowRight className="size-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-10">
        <FeaturePill icon={<Eye className="size-4" />} label="Autonomous Vision" />
        <FeaturePill icon={<Mic className="size-4" />} label="Voice-First Interface" />
        <FeaturePill icon={<ShieldCheck className="size-4" />} label="FDA Verified" />
      </div>
    </section>
  )
}

function BiometricCard({ label, value, unit }: { label: string; value: string | number; unit: string }) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-xl bg-secondary/50 border border-border">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold text-foreground">{value}</span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
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
