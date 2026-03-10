"use client"

import { useEffect, useState, useRef } from "react"
import {
  Heart, Activity, Loader2, CheckCircle2, XCircle,
  ArrowRight, Eye, Mic, ShieldCheck, AlertTriangle, Pill,
} from "lucide-react"

// ─── Floating Med Card ────────────────────────────────────────────────────────
function MedCard({
  icon, label, sublabel, accentClass, className = "",
}: {
  icon: React.ReactNode; label: string; sublabel: string
  accentClass: string; className?: string
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border border-border/60 bg-background/85 backdrop-blur-md shadow-lg min-w-[210px] ${className}`}>
      <div className={`flex items-center justify-center size-9 rounded-xl flex-shrink-0 ${accentClass}`}>
        {icon}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold text-foreground leading-tight">{label}</span>
        <span className="text-[11px] text-muted-foreground leading-tight">{sublabel}</span>
      </div>
    </div>
  )
}

// ─── Feature Pill ─────────────────────────────────────────────────────────────
function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
      style={{
        color: "#0b0b0b",
        background: "radial-gradient(ellipse at 50% 50%, #fff8e1 0%, #fff3b0 100%)",
        boxShadow: "0 6px 18px rgba(200,170,50,0.08), 0 0 0 1px rgba(255,255,255,0.03)",
      }}
    >
      <span style={{ color: "#0b0b0b" }}>{icon}</span>
      {label}
    </div>
  )
}

// ─── Biometric Card (preserved exactly) ──────────────────────────────────────
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

// ─── Orb Visualiser with mouse parallax ──────────────────────────────────────
function OrbVisualiser({ wavePulse }: { wavePulse: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const rafRef = useRef<number | null>(null)
  const targetRef = useRef({ x: 0, y: 0 })
  const currentRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      targetRef.current = {
        x: (e.clientX - cx) / rect.width,
        y: (e.clientY - cy) / rect.height,
      }
    }
    window.addEventListener("mousemove", handleMove)
    const tick = () => {
      const lerp = 0.06
      currentRef.current.x += (targetRef.current.x - currentRef.current.x) * lerp
      currentRef.current.y += (targetRef.current.y - currentRef.current.y) * lerp
      setMouse({ x: currentRef.current.x, y: currentRef.current.y })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener("mousemove", handleMove)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative flex items-center justify-center w-full h-full">

      {/* Warm ambient glow */}
      <div
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{
          width: 340, height: 340,
          background: "radial-gradient(circle, rgba(210,180,110,0.20) 0%, rgba(150,200,155,0.12) 55%, transparent 100%)",
          transform: `translate(${mouse.x * 20}px, ${mouse.y * 15}px)`,
        }}
      />

      {/* Concentric rings with parallax */}
      {[360, 288, 218].map((size, i) => (
        <div
          key={size}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: size, height: size,
            border: `1px solid rgba(185,160,100,${0.11 - i * 0.025})`,
            transform: `translate(${mouse.x * (5 + i * 3)}px, ${mouse.y * (4 + i * 2)}px)`,
          }}
        />
      ))}

      {/* Orbiting satellite dots */}
      <div className="ghc-orbit-0 pointer-events-none" style={{ width: 10, height: 10, borderRadius: "50%", background: "#c8a96e", boxShadow: "0 0 10px #c8a96e88", marginLeft: -5, marginTop: -5 }} />
      <div className="ghc-orbit-1 pointer-events-none" style={{ width: 7,  height: 7,  borderRadius: "50%", background: "#7fb88a", boxShadow: "0 0 10px #7fb88a88", marginLeft: -3, marginTop: -3 }} />
      <div className="ghc-orbit-2 pointer-events-none" style={{ width: 8,  height: 8,  borderRadius: "50%", background: "#d4916a", boxShadow: "0 0 10px #d4916a88", marginLeft: -4, marginTop: -4 }} />

      {/* Central orb */}
      <div
        className="relative flex flex-col items-center justify-center z-10"
        style={{
          width: 168, height: 168, borderRadius: "50%",
          background: "radial-gradient(circle at 38% 35%, rgba(218,195,145,0.55) 0%, rgba(140,195,150,0.32) 48%, rgba(100,168,128,0.18) 100%)",
          border: "1px solid rgba(200,175,120,0.30)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.14), 0 20px 55px rgba(160,125,70,0.16), 0 4px 18px rgba(120,178,128,0.10)",
          transform: `translate(${mouse.x * -14}px, ${mouse.y * -11}px)`,
        }}
      >
        {/* Glass highlight */}
        <div style={{ position: "absolute", top: "12%", left: "18%", width: "42%", height: "28%", borderRadius: "50%", background: "radial-gradient(ellipse, rgba(255,255,255,0.32) 0%, transparent 100%)", pointerEvents: "none" }} />

        {/* Waveform */}
        <div className="flex items-center gap-[5px] h-7">
          {[0.3, 0.6, 1, 0.45, 0.82, 0.5, 0.75, 0.55, 0.28].map((ratio, i) => (
            <div key={i} style={{
              width: 4, borderRadius: 3,
              background: "linear-gradient(to top, rgba(165,118,52,0.88), rgba(105,168,112,0.65))",
              height: wavePulse ? `${Math.round(ratio * 22 + 4)}px` : "4px",
              transition: `height 0.18s ease ${i * 35}ms`,
            }} />
          ))}
        </div>

        {/* LIVE */}
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="size-1.5 rounded-full animate-pulse" style={{ background: "rgba(175,125,45,0.85)" }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(140,98,38,0.82)", textTransform: "uppercase" }}>Live</span>
        </div>
      </div>

      {/* Floating med cards with independent parallax */}
      <div className="ghc-ec-a ghc-float-a absolute z-20" style={{ top: 28, right: 0, transform: `translate(${mouse.x * 9}px, ${mouse.y * 7}px)` }}>
        <MedCard icon={<CheckCircle2 className="size-4 text-green-600" />} label="Dosage verified" sublabel="Metformin 500mg — correct" accentClass="bg-green-500/10" />
      </div>
      <div className="ghc-ec-b ghc-float-b absolute z-20" style={{ bottom: 58, left: 0, transform: `translate(${mouse.x * -11}px, ${mouse.y * 9}px)` }}>
        <MedCard icon={<AlertTriangle className="size-4 text-amber-500" />} label="Interaction flagged" sublabel="Warfarin + Ibuprofen" accentClass="bg-amber-500/10" />
      </div>
      <div className="ghc-ec-c ghc-float-c absolute z-20" style={{ bottom: 190, right: -10, transform: `translate(${mouse.x * 13}px, ${mouse.y * -8}px)` }}>
        <MedCard icon={<Pill className="size-4 text-amber-700" />} label="Alternative suggested" sublabel="Consider Celecoxib" accentClass="bg-amber-100/60" />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function GoogleHealthConnect({ onStart }: { onStart?: () => void }) {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [fetchingData, setFetchingData] = useState(false)
  const [biometrics, setBiometrics] = useState<any>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fitConnected = params.get("fit_connected")
    const fitError = params.get("fit_error")
    if (fitConnected === "true") {
      console.log("✅ Google Health Connect: Connection successful!")
      window.history.replaceState({}, "", "/")
    }
    if (fitError) {
      console.error("❌ Google Health Connect: Connection failed -", fitError)
      window.history.replaceState({}, "", "/")
    }
    checkStatus()
  }, [])

  useEffect(() => {
    if (connected) fetchBiometrics()
  }, [connected])

  async function checkStatus() {
    try {
      const res = await fetch("/api/auth/google-fit/status")
      const data = await res.json()
      setConnected(data.connected)
      if (data.connected) console.log("✅ Google Health Connect: Already connected")
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

  const [mounted, setMounted] = useState(false)
  const [wavePulse, setWavePulse] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60)
    const interval = setInterval(() => {
      setWavePulse(true)
      setTimeout(() => setWavePulse(false), 1400)
    }, 3800)
    return () => { clearTimeout(t); clearInterval(interval) }
  }, [])

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
    <>
      <style>{`
        @keyframes ghc-float-a {
          0%, 100% { transform: translateY(0px) rotate(-1.5deg); }
          50%       { transform: translateY(-9px) rotate(-1.5deg); }
        }
        @keyframes ghc-float-b {
          0%, 100% { transform: translateY(0px) rotate(1.2deg); }
          50%       { transform: translateY(-7px) rotate(1.2deg); }
        }
        @keyframes ghc-float-c {
          0%, 100% { transform: translateY(0px) rotate(-0.8deg); }
          50%       { transform: translateY(-11px) rotate(-0.8deg); }
        }
        @keyframes ghc-pulse-ring {
          0%   { transform: scale(0.92); opacity: 0.55; }
          70%  { transform: scale(1.65); opacity: 0; }
          100% { transform: scale(1.65); opacity: 0; }
        }
        @keyframes ghc-slide-up {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ghc-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes ghc-orbit-0 {
          from { transform: rotate(0deg)   translateX(118px) rotate(0deg);    }
          to   { transform: rotate(360deg) translateX(118px) rotate(-360deg); }
        }
        @keyframes ghc-orbit-1 {
          from { transform: rotate(120deg) translateX(128px) rotate(-120deg); }
          to   { transform: rotate(480deg) translateX(128px) rotate(-480deg); }
        }
        @keyframes ghc-orbit-2 {
          from { transform: rotate(240deg) translateX(112px) rotate(-240deg); }
          to   { transform: rotate(600deg) translateX(112px) rotate(-600deg); }
        }
        .ghc-orbit-0 { position:absolute; top:50%; left:50%; animation: ghc-orbit-0 9s  linear 0s   infinite; }
        .ghc-orbit-1 { position:absolute; top:50%; left:50%; animation: ghc-orbit-1 12s linear 3s   infinite; }
        .ghc-orbit-2 { position:absolute; top:50%; left:50%; animation: ghc-orbit-2 10s linear 1.5s infinite; }
        .ghc-float-a { animation: ghc-float-a 4.2s ease-in-out infinite; }
        .ghc-float-b { animation: ghc-float-b 5s   ease-in-out 0.6s infinite; }
        .ghc-float-c { animation: ghc-float-c 4.7s ease-in-out 1.1s infinite; }
        .ghc-pulse-ring {
          position:absolute; inset:0; margin:auto;
          width:100%; height:100%; border-radius:9999px;
          border:1.5px solid hsl(var(--primary) / 0.35);
          animation: ghc-pulse-ring 2.6s ease-out infinite;
        }
        .ghc-pulse-ring-delay { animation-delay: 1.3s; }
        .ghc-e0 { animation: ghc-slide-up 0.55s ease both 0.05s; }
        .ghc-e1 { animation: ghc-slide-up 0.55s ease both 0.15s; }
        .ghc-e2 { animation: ghc-slide-up 0.55s ease both 0.25s; }
        .ghc-e3 { animation: ghc-slide-up 0.55s ease both 0.35s; }
        .ghc-e4 { animation: ghc-slide-up 0.55s ease both 0.45s; }
        .ghc-e5 { animation: ghc-slide-up 0.55s ease both 0.52s; }
        .ghc-ec-a { animation: ghc-fade-in 0.5s ease both 0.55s; }
        .ghc-ec-b { animation: ghc-fade-in 0.5s ease both 0.70s; }
        .ghc-ec-c { animation: ghc-fade-in 0.5s ease both 0.85s; }
      `}</style>

      <section className="relative flex flex-col justify-center min-h-screen px-6 pt-24 pb-16 overflow-hidden">

        {/* Warm green + tan/gold background */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-[-80px] right-[-60px] w-[500px] h-[500px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(205,178,108,0.14) 0%, rgba(130,188,140,0.09) 60%, transparent 100%)" }} />
          <div className="absolute bottom-[-40px] left-[2%] w-[420px] h-[420px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(175,208,172,0.13) 0%, rgba(212,188,128,0.08) 60%, transparent 100%)" }} />
          <div className="absolute top-[42%] left-[36%] w-[280px] h-[280px] rounded-full blur-2xl"
            style={{ background: "radial-gradient(circle, rgba(218,196,142,0.09) 0%, transparent 100%)" }} />
        </div>

        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* LEFT */}
          <div className={`flex flex-col gap-6 ${mounted ? "" : "opacity-0"}`}>

            <h1 className="ghc-e1 text-4xl md:text-5xl lg:text-6xl font-bold text-foreground tracking-tight leading-[1.08] text-balance">
              Your medications,{" "}
              <span className="italic font-semibold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                understood.
              </span>
            </h1>

            <p className="ghc-e2 text-lg text-muted-foreground max-w-md leading-relaxed text-pretty">
              An always-on AI pharmacist that sees what you see and understands your unique health history. No more confusion about pills, doses, or interactions.
            </p>

            {/* Google Health Connect card */}
            <div className="ghc-e3 rounded-2xl border border-border bg-card p-5 flex flex-col gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-10 rounded-xl bg-red-500/10 flex-shrink-0">
                  <Heart className="size-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Google Health Connect</h3>
                  <p className="text-xs text-muted-foreground">Sync biometrics for personalised safety checks</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5 text-xs">
                  {connected ? (
                    <>
                      <CheckCircle2 className="size-3.5 text-green-500" />
                      <span className="text-green-600 dark:text-green-400 font-medium">Connected</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="size-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Not connected</span>
                    </>
                  )}
                </div>
              </div>

              {connected && biometrics && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <BiometricCard label="Heart Rate" value={biometrics.heartRate?.count > 0 ? `${biometrics.heartRate.points[biometrics.heartRate.count - 1]?.values?.[0] ?? "—"}` : "—"} unit="bpm" />
                  <BiometricCard label="Blood Pressure" value={biometrics.bloodPressure?.count > 0 ? `${biometrics.bloodPressure.points[biometrics.bloodPressure.count - 1]?.values?.[0] ?? "—"}/${biometrics.bloodPressure.points[biometrics.bloodPressure.count - 1]?.values?.[1] ?? "—"}` : "—"} unit="mmHg" />
                  <BiometricCard label="Body Temp" value={biometrics.bodyTemperature?.count > 0 ? `${biometrics.bodyTemperature.points[biometrics.bodyTemperature.count - 1]?.values?.[0] ?? "—"}` : "—"} unit="°F" />
                  <BiometricCard label="SpO2" value={biometrics.oxygenSaturation?.count > 0 ? `${biometrics.oxygenSaturation.points[biometrics.oxygenSaturation.count - 1]?.values?.[0] ?? "—"}` : "—"} unit="%" />
                </div>
              )}

              {!connected ? (
                <a
                  href="/api/auth/google-fit"
                  className="flex items-center justify-center gap-2 h-11 px-5 rounded-xl text-sm font-semibold transition-all duration-200 hover:brightness-95 active:brightness-90 active:scale-[0.98]"
                  style={{
                    color: "#4a1008",
                    background: "radial-gradient(ellipse at 50% 50%, #f9a89e 0%, #f08878 100%)",
                    boxShadow: "0 1px 3px rgba(180,60,40,0.22), 0 0 0 1px rgba(220,80,60,0.22)",
                  }}
                >
                  <Activity className="size-4 flex-shrink-0" />
                  Connect Google Health
                </a>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={fetchBiometrics}
                    disabled={fetchingData}
                    className="flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-background text-xs font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                    style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
                  >
                    {fetchingData ? <Loader2 className="size-3.5 animate-spin" /> : <Activity className="size-3.5" />}
                    Refresh
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="flex items-center gap-2 h-9 px-4 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>

            {/* Start Consultation — onStart preserved exactly */}
            <div className="ghc-e4 flex flex-col sm:flex-row items-start sm:items-center gap-3">

              {/* Primary — saturated sage */}
              <button
                onClick={onStart}
                className="group flex items-center gap-2.5 h-12 px-7 rounded-xl font-semibold text-[15px] cursor-pointer transition-all duration-200 hover:brightness-95 active:brightness-90 active:scale-[0.98]"
                style={{
                  color: "#0f3320",
                  background: "radial-gradient(ellipse at 50% 50%, #8fd4aa 0%, #6abf8e 100%)",
                  boxShadow: "0 1px 4px rgba(40,120,70,0.25), 0 0 0 1px rgba(70,160,100,0.25)",
                }}
              >
                <span className="relative flex items-center justify-center size-5 flex-shrink-0">
                  <span className="ghc-pulse-ring" />
                  <span className="ghc-pulse-ring ghc-pulse-ring-delay" />
                  <Mic className="size-4 relative z-10" />
                </span>
                Start Consultation
                <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" />
              </button>

              {/* Secondary — warm amber */}
              <a
                href="#how-it-works"
                className="flex items-center h-12 px-7 rounded-xl font-medium text-[15px] transition-all duration-200 hover:brightness-95 active:brightness-90"
                style={{
                  color: "#3d2a08",
                  background: "radial-gradient(ellipse at 50% 50%, #f0d49a 0%, #e4c07a 100%)",
                  boxShadow: "0 1px 4px rgba(140,100,20,0.22), 0 0 0 1px rgba(180,140,50,0.22)",
                }}
              >
                See How It Works
              </a>
            </div>

            <div className="ghc-e5 flex flex-wrap items-center gap-3">
              <FeaturePill icon={<Eye className="size-4" />}         label="Autonomous Vision" />
              <FeaturePill icon={<Mic className="size-4" />}         label="Voice-First Interface" />
              <FeaturePill icon={<ShieldCheck className="size-4" />} label="FDA Verified" />
            </div>
          </div>

          {/* RIGHT */}
          <div className={`hidden lg:block relative h-[480px] ${mounted ? "" : "opacity-0"}`}>
            <OrbVisualiser wavePulse={wavePulse} />
          </div>

        </div>
      </section>
    </>
  )
}