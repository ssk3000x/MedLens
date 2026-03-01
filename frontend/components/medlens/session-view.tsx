"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Square, AlertTriangle } from "lucide-react"
import { useLiveAgent } from "@/hooks/use-live-agent"

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
  const [stream, setStream] = useState<MediaStream | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [sessionTime, setSessionTime] = useState(0)
  const timeoutRefs = useRef<NodeJS.Timeout[]>([])
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const { connect, disconnect, sendPrompt } = useLiveAgent((msg) => {
    setCurrentMessage((prev) => {
      // Append text, assuming parts come in chunks
      // Optionally just replace it if you want only the latest chunk
      if (prev === "Analyzing image...") return msg
      return prev + " " + msg
    })
    setIsListening(true)
  })

  // Session timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionTime((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Start with listening text instead of launching simulated delays
  useEffect(() => {
    // Only set initial message
    setCurrentMessage("Connected. Waiting for your prompt...")
    setIsListening(true)
    
    return () => {
      timeoutRefs.current.forEach(clearTimeout)
    }
  }, [])

  // Camera start handler (callable from a user gesture on mobile)
  const startCamera = useCallback(async () => {
    let localStream: MediaStream | null = null
    try {
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      }

      if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function") {
        localStream = await navigator.mediaDevices.getUserMedia(constraints)
      } else {
        // legacy fallback for older WebKit builds on iOS
        const legacyGetUserMedia = (navigator as any).getUserMedia || (navigator as any).webkitGetUserMedia || (navigator as any).mozGetUserMedia
        if (!legacyGetUserMedia) {
          throw new Error("getUserMedia is not supported in this browser. Try Safari or update iOS and use HTTPS.")
        }
        localStream = await new Promise<MediaStream>((resolve, reject) => {
          legacyGetUserMedia.call(navigator, constraints, resolve, reject)
        })
      }

      setStream(localStream)
      streamRef.current = localStream
      setCameraError(null)
      if (videoRef.current) {
        try {
          videoRef.current.srcObject = localStream
          // Connect to the backend when starting the camera
          connect(videoRef.current)
        } catch (e) {
          // ignore assignment errors in some environments
          connect()
        }
      }
    } catch (err: any) {
      // Improve message when getUserMedia is not available vs permission denied
      const msg = err?.message || String(err) || "Camera permission denied or not available"
      setCameraError(msg)
    }

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  // Robustly release a MediaStream: stop tracks, detach from any <video> elements, pause and unload elements
  const releaseStream = useCallback((s: MediaStream | null) => {
    if (!s) return
    try {
      // stop all tracks
      s.getTracks().forEach((t) => {
        try {
          t.stop()
        } catch (e) {
          /* ignore */
        }
      })
    } catch (e) {
      /* ignore */
    }

    try {
      // Detach from any video elements that reference this stream
      const vids = Array.from(document.querySelectorAll("video")) as HTMLVideoElement[]
      vids.forEach((v) => {
        try {
          if ((v.srcObject as MediaStream | null) === s) {
            v.pause()
            try {
              v.srcObject = null
            } catch (e) {
              // fallback to clearing src
              v.src = ""
            }
            // try to force unload
            try {
              v.removeAttribute("src")
              v.load()
            } catch (e) {
              /* ignore */
            }
          }
        } catch (e) {
          /* ignore */
        }
      })
    } catch (e) {
      /* ignore */
    }

    // Clear ref if it matches
    if (streamRef.current === s) streamRef.current = null
    if (stream === s) setStream(null)
  }, [])

  // Try to auto-start camera on mount (desktop browsers). Mobile browsers may require a user gesture.
  useEffect(() => {
    // best-effort auto-start; on iOS this will typically fail silently until user interacts
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    startCamera()

    return () => {
      const active = streamRef.current ?? (videoRef.current?.srcObject as MediaStream | null)
      try {
        releaseStream(active)
      } catch (e) {
        /* ignore */
      }
      // ensure video element is cleaned
      if (videoRef.current) {
        try {
          videoRef.current.pause()
          videoRef.current.removeAttribute("src")
          ;(videoRef.current as HTMLVideoElement).srcObject = null
          try {
            videoRef.current.load()
          } catch (e) {
            /* ignore */
          }
        } catch (e) {
          /* ignore */
        }
      }
      setStream(null)
    }
    // intentionally excluding startCamera from deps to avoid re-creating stream
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        {/* Camera feed (video) or simulated background when camera unavailable */}
        <div className="absolute inset-0">
          {cameraError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-foreground">
              <div className="text-center px-4">
                <p className="text-sm font-medium text-destructive">Camera unavailable</p>
                <p className="text-xs text-muted-foreground mt-2">{cameraError}</p>
                <p className="text-xs text-muted-foreground mt-2">Please allow camera access or try a different browser.</p>
                <div className="mt-3">
                  <button
                    className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
                    onClick={() => {
                      // user gesture to re-request permissions
                      void startCamera()
                    }}
                  >
                    Enable Camera
                  </button>
                </div>
              </div>
            </div>
          ) : !stream ? (
            <div className="absolute inset-0 flex items-center justify-center bg-foreground">
              <div className="text-center px-4">
                <p className="text-sm font-medium text-muted-foreground">Camera is not active</p>
                <div className="mt-3">
                  <button
                    className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
                    onClick={() => {
                      void startCamera()
                    }}
                  >
                    Enable Camera
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover bg-black"
            />
          )}
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

        {/* Request button */}
        <div className="mb-2">
          <button
            onClick={() => {
              try {
                // Change UI status
                setCurrentMessage("Analyzing image...");
                setIsListening(false);
                sendPrompt?.(
                  'Please describe the most recent image and list any medications visible. Keep it under 3 sentences.'
                )
              } catch (e) {
                /* ignore */
              }
            }}
            className="mb-2 flex items-center gap-2 h-10 px-4 rounded-lg bg-primary/90 text-primary-foreground text-sm font-medium hover:bg-primary/80 transition-colors"
          >
            Ask Agent to Describe Image
          </button>
        </div>

        {/* Stop button */}
        <button
          onClick={() => {
              // stop any running timers
              timeoutRefs.current.forEach(clearTimeout)
              timeoutRefs.current = []

              // prefer stopping the stream from the ref (most up-to-date)
              const active = streamRef.current ?? stream
              try {
                releaseStream(active)
              } catch (e) {
                /* ignore */
              }

              // defensive cleanup on the video element
              if (videoRef.current) {
                try {
                  videoRef.current.pause()
                  videoRef.current.removeAttribute("src")
                  ;(videoRef.current as HTMLVideoElement).srcObject = null
                  try {
                    videoRef.current.load()
                  } catch (e) {
                    /* ignore */
                  }
                } catch (e) {
                  /* ignore */
                }
              }

              streamRef.current = null
              setStream(null)
              disconnect()

              onStop()
            }}
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
