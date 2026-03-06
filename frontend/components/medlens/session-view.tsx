"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Square, AlertTriangle, Loader2 } from "lucide-react"
import { useLiveAgent } from "@/hooks/use-live-agent"

const BACKEND_URL = 'http://localhost:8081'

export function SessionView({ onStop }: { onStop: (summary?: any) => void }) {
  const [currentMessage, setCurrentMessage] = useState("")
  const [transcript, setTranscript] = useState<{ speaker: 'user' | 'agent'; text: string }[]>([])
  const transcriptRef = useRef<{ speaker: 'user' | 'agent'; text: string }[]>([])
  const [isListening, setIsListening] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [sessionTime, setSessionTime] = useState(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Helper to add to transcript (both state and ref)
  const addToTranscript = useCallback((entry: { speaker: 'user' | 'agent'; text: string }) => {
    setTranscript((prev) => {
      const next = [...prev, entry]
      transcriptRef.current = next
      return next
    })
  }, [])

  // FIX: Wrap the callback so it doesn't cause an infinite loop
  const handleAgentMessage = useCallback((msg: string) => {
    setCurrentMessage((prev) => (prev === "Analyzing..." ? msg : prev + " " + msg))
    addToTranscript({ speaker: 'agent', text: msg })
    setIsListening(true)
  }, [addToTranscript])

  const { connect, disconnect, sendPrompt, startMicrophone } = useLiveAgent(handleAgentMessage)

  const startCamera = useCallback(async () => {
    try {
      // Clear old streams if they exist
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }

      const localStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 640, height: 480 },
        audio: true,
      })

      setStream(localStream)
      streamRef.current = localStream
      
      if (videoRef.current) {
        videoRef.current.srcObject = localStream
        connect(videoRef.current)
        startMicrophone(localStream)
      }
    } catch (err: any) {
      console.error("Camera Error:", err)
      setCameraError(err.message || "Camera access denied")
    }
  }, [connect, startMicrophone])

  useEffect(() => {
    startCamera()
    const timer = setInterval(() => setSessionTime(p => p + 1), 1000)
    return () => {
      clearInterval(timer)
      disconnect()
      // Stop all camera/mic tracks on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }
  }, [startCamera, disconnect])

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {cameraError ? (
        <div className="flex items-center justify-center h-full text-white">{cameraError}</div>
      ) : (
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
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
            onClick={() => {
              const prompt = "Describe what you see and check for medications."
              setCurrentMessage("Analyzing...")
              addToTranscript({ speaker: 'user', text: prompt })
              sendPrompt(prompt)
            }}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-500"
          >
            Identify Medication
          </button>
          
          <button 
            disabled={isStopping}
            onClick={async () => {
              setIsStopping(true)
              setCurrentMessage("Generating summary...")
              disconnect()

              // Stop camera tracks
              if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop())
              }

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