"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Square, AlertTriangle, Loader2 } from "lucide-react"
import { useLiveAgent } from "@/hooks/use-live-agent"

const BACKEND_URL = 'http://localhost:8082'

export function SessionView({ onStop }: { onStop: (summary?: any) => void }) {
  const [currentMessage, setCurrentMessage] = useState("")
  const transcriptRef = useRef<{ speaker: 'user' | 'agent'; text: string }[]>([])
  const [isListening, setIsListening] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [sessionTime, setSessionTime] = useState(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const activeStreamRef = useRef<MediaStream | null>(null)

  const addToTranscript = useCallback((entry: { speaker: 'user' | 'agent'; text: string }) => {
    transcriptRef.current = [...transcriptRef.current, entry]
  }, [])

  const handleAgentMessage = useCallback((msg: string) => {
    setCurrentMessage((prev) => (prev === "Analyzing..." ? msg : prev + " " + msg))
    addToTranscript({ speaker: 'agent', text: msg })
    setIsListening(true)
  }, [addToTranscript])

  const { connect, disconnect, sendPrompt, startMicrophone } = useLiveAgent(handleAgentMessage)

  const connectRef = useRef(connect)
  const disconnectRef = useRef(disconnect)
  const startMicRef = useRef(startMicrophone)
  connectRef.current = connect
  disconnectRef.current = disconnect
  startMicRef.current = startMicrophone

  const stopAllMedia = useCallback(() => {
    // Kill active stream tracks
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(t => { t.stop(); t.enabled = false })
      activeStreamRef.current = null
    }
    // Detach video element
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let localStream: MediaStream | null = null

    const init = async () => {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: 640, height: 480 },
          audio: true,
        })

        // If this effect was already cleaned up, kill the stream immediately
        if (cancelled) {
          localStream.getTracks().forEach(t => t.stop())
          return
        }

        activeStreamRef.current = localStream

        if (videoRef.current) {
          videoRef.current.srcObject = localStream
          connectRef.current(videoRef.current)
          startMicRef.current(localStream)
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("Camera Error:", err)
          setCameraError(err.message || "Camera access denied")
        }
      }
    }

    init()
    const timer = setInterval(() => setSessionTime(p => p + 1), 1000)

    return () => {
      cancelled = true
      clearInterval(timer)
      disconnectRef.current()
      // Kill stream that was assigned
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach(t => t.stop())
        activeStreamRef.current = null
      }
      // Also kill localStream directly in case it resolved after cleanup started
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop())
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {cameraError ? (
        <div className="flex items-center justify-center h-full text-white">{cameraError}</div>
      ) : !isStopping ? (
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="flex items-center justify-center h-full">
          <Loader2 size={48} className="text-white animate-spin" />
        </div>
      )}
      
      <div className="absolute top-0 left-0 right-0 p-4 flex flex-col items-center">
        <div className="bg-yellow-500 text-black px-4 py-1 rounded text-xs font-bold flex items-center gap-2">
          <AlertTriangle size={14} /> AI ASSISTANT: NOT A DOCTOR
        </div>
        <div className="mt-4 text-white font-mono text-xl bg-black/40 px-3 py-1 rounded-full">
          {formatTime(sessionTime)}
        </div>
      </div>

      <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-6 px-6">
        <div className="text-white text-center text-sm max-w-md bg-black/50 p-4 rounded-xl backdrop-blur-md min-h-[60px]">
          {currentMessage || "Connecting to Aria..."}
        </div>

        <div className="flex gap-4">
          <button 
            disabled={isStopping}
            onClick={async () => {
              setIsStopping(true)
              setCurrentMessage("Generating summary...")

              // 1. Disconnect websocket + audio contexts
              disconnect()

              // 2. Stop all media tracks
              stopAllMedia()

              const currentTranscript = transcriptRef.current
              console.log('📤 Sending transcript to backend:', currentTranscript.length, 'messages')

              try {
                const res = await fetch(`${BACKEND_URL}/summarize`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ transcript: currentTranscript }),
                })
                const data = await res.json()
                console.log('✅ Summary received from backend:', data)
                onStop({
                  transcript: currentTranscript,
                  aiSummary: data.summary || 'No summary available.',
                  medications: data.medications || null,
                  method: data.method,
                })
              } catch (err) {
                console.error('❌ Failed to get summary from backend:', err)
                onStop({
                  transcript: currentTranscript,
                  aiSummary: 'Summary unavailable — backend could not be reached.',
                  method: 'error',
                })
              }
            }} 
            className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-red-500 disabled:opacity-50"
          >
            {isStopping ? <Loader2 size={18} className="animate-spin" /> : <Square size={18} />}
            {isStopping ? 'Summarizing...' : 'Stop'}
          </button>
        </div>
      </div>
    </div>
  )
}