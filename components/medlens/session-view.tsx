"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Square, AlertTriangle } from "lucide-react"

const SIMULATED_DETECTIONS = [
  {
    id: 1,
    label: "Metformin 500mg",
    confidence: 0.96,
    position: { top: "22%", left: "15%", width: "35%", height: "14%" },
    delay: 2000,
  },
  {
    id: 2,
    label: "Lisinopril 10mg",
    confidence: 0.92,
    position: { top: "48%", left: "50%", width: "30%", height: "12%" },
    delay: 4500,
  },
  {
    id: 3,
    label: "Atorvastatin 20mg",
    confidence: 0.89,
    position: { top: "70%", left: "20%", width: "32%", height: "13%" },
    delay: 7000,
  },
]

const ARIA_MESSAGES = [
  {
    text: "I can see your medications. Let me take a closer look...",
    delay: 1500,
  },
  {
    text: "I've identified Metformin 500mg. This is commonly used for type 2 diabetes management.",
    delay: 3500,
  },
  {
    text: "Now I see Lisinopril 10mg - an ACE inhibitor for blood pressure. No interaction with Metformin detected.",
    delay: 6000,
  },
  {
    text: "Atorvastatin 20mg detected. Checking interactions... All three medications are safe to take together based on your profile.",
    delay: 8500,
  },
]

interface Detection {
  id: number
  label: string
  confidence: number
  position: { top: string; left: string; width: string; height: string }
  delay: number
}

export function SessionView({ onStop }: { onStop: () => void }) {
  const [detections, setDetections] = useState<Detection[]>([])
  const [currentMessage, setCurrentMessage] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [sessionTime, setSessionTime] = useState(0)
  const timeoutRefs = useRef<NodeJS.Timeout[]>([])

  // Session timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionTime((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Simulated detection pipeline
  useEffect(() => {
    SIMULATED_DETECTIONS.forEach((det) => {
      const timeout = setTimeout(() => {
        setDetections((prev) => [...prev, det])
      }, det.delay)
      timeoutRefs.current.push(timeout)
    })

    ARIA_MESSAGES.forEach((msg) => {
      const timeout = setTimeout(() => {
        setCurrentMessage(msg.text)
      }, msg.delay)
      timeoutRefs.current.push(timeout)
    })

    // Toggle "listening" state
    const listenTimeout = setTimeout(() => setIsListening(true), 11000)
    timeoutRefs.current.push(listenTimeout)

    return () => {
      timeoutRefs.current.forEach(clearTimeout)
    }
  }, [])

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0")
    const s = (seconds % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-foreground">
      {/* Full-screen camera feed */}
      <div className="absolute inset-0 bg-foreground/95 overflow-hidden">
        {/* Simulated camera feed - dark background with grid overlay */}
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          {/* Viewfinder corners */}
          <div className="absolute top-16 left-6 w-10 h-10 border-t-2 border-l-2 border-primary/60 rounded-tl-lg" />
          <div className="absolute top-16 right-6 w-10 h-10 border-t-2 border-r-2 border-primary/60 rounded-tr-lg" />
          <div className="absolute bottom-6 left-6 w-10 h-10 border-b-2 border-l-2 border-primary/60 rounded-bl-lg" />
          <div className="absolute bottom-6 right-6 w-10 h-10 border-b-2 border-r-2 border-primary/60 rounded-br-lg" />
        </div>

        {/* HUD Overlays - detected medications */}
        {detections.map((det) => (
          <div
            key={det.id}
            className="absolute animate-in fade-in zoom-in-95 duration-500"
            style={{
              top: det.position.top,
              left: det.position.left,
              width: det.position.width,
              height: det.position.height,
            }}
          >
            <div className="relative w-full h-full border-2 border-primary/70 rounded-lg">
              <div className="absolute -top-7 left-0 flex items-center gap-2 px-2.5 py-1 rounded-md bg-primary/90 text-primary-foreground text-xs font-medium whitespace-nowrap">
                {det.label}
                <span className="text-primary-foreground/70">
                  {Math.round(det.confidence * 100)}%
                </span>
              </div>
              {/* Scanning line animation */}
              <div className="absolute inset-0 overflow-hidden rounded-lg">
                <div className="absolute w-full h-0.5 bg-primary/40 animate-pulse top-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Top HUD bar - overlaid on camera */}
      <div className="absolute top-0 left-0 right-0 z-10">
        {/* Disclaimer banner */}
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-warning/90 text-warning-foreground text-xs font-medium">
          <AlertTriangle className="size-3.5" />
          <span>
            I am an AI, not a doctor. In an emergency, call 911.
          </span>
        </div>

        <div className="flex items-center justify-between px-4 pt-3">
          {/* Detection count */}
          <div className="px-3 py-1.5 rounded-full bg-background/10 backdrop-blur-md">
            <span className="text-xs text-background/90">
              {detections.length} detected
            </span>
          </div>

          {/* Session timer */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/10 backdrop-blur-md">
            <div className="size-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-xs font-mono text-background/90">
              {formatTime(sessionTime)}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom controls - floating over camera, no background panel */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col items-center gap-2.5 px-6 pb-8 pt-16 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
        {/* Aria waveform */}
        <AriaWaveform isListening={isListening} />

        {/* Current message */}
        <div className="min-h-[36px] flex items-center">
          <p className="text-xs text-center text-background/80 max-w-sm leading-relaxed">
            {currentMessage || "Initializing camera and voice..."}
          </p>
        </div>

        {/* Stop button */}
        <button
          onClick={onStop}
          className="flex items-center gap-2 h-11 px-6 rounded-xl bg-destructive text-card font-medium text-sm hover:bg-destructive/90 transition-colors cursor-pointer"
        >
          <Square className="size-4" />
          Stop Session
        </button>
      </div>
    </div>
  )
}

function AriaWaveform({ isListening }: { isListening: boolean }) {
  return (
    <div className="flex items-center gap-1" aria-label={isListening ? "Listening" : "Speaking"}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="w-1 rounded-full bg-primary transition-all duration-300"
          style={{
            height: isListening ? "8px" : `${12 + Math.sin(i * 1.2) * 10}px`,
            animationName: isListening ? "none" : "waveform",
            animationDuration: `${0.6 + i * 0.1}s`,
            animationIterationCount: "infinite",
            animationDirection: "alternate",
            animationTimingFunction: "ease-in-out",
          }}
        />
      ))}
      <span className="ml-2 text-xs text-background/70 font-medium">
        {isListening ? "Listening..." : "Aria"}
      </span>
      <style>{`
        @keyframes waveform {
          from { height: 6px; }
          to { height: 24px; }
        }
      `}</style>
    </div>
  )
}
