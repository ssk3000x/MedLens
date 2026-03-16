"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Square, AlertTriangle, Loader2, Send, X } from "lucide-react"
import { useLiveAgent } from "@/hooks/use-live-agent"

const BACKEND_URL = 'http://localhost:8082'

export function SessionView({ onStop }: { onStop: (summary?: any) => void }) {
  const [currentMessage, setCurrentMessage] = useState("")
  const transcriptRef = useRef<{ speaker: 'user' | 'agent'; text: string }[]>([])
  const [isListening, setIsListening] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [sessionTime, setSessionTime] = useState(0)
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [emailValue, setEmailValue] = useState("")
  const [emailSubject, setEmailSubject] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const activeStreamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<any>(null)

  const addToTranscript = useCallback((entry: { speaker: 'user' | 'agent'; text: string }) => {
    if (!entry.text.trim()) return;
    const current = transcriptRef.current;
    const last = current[current.length - 1];

    if (last && last.speaker === entry.speaker) {
      if (!last.text.includes(entry.text)) {
        last.text += " " + entry.text;
      }
    } else {
      transcriptRef.current = [...current, { ...entry }];
    }
  }, [])

  const handleAgentMessage = useCallback((msg: string) => {
    addToTranscript({ speaker: 'agent', text: msg });
    const displayMsg = msg.replace(/\*\*[\s\S]*?\*\*/g, '').trim();
    if (displayMsg) {
      setCurrentMessage((prev) => (prev === "Analyzing..." ? displayMsg : prev + " " + displayMsg));
      setIsListening(true);
    }
  }, [addToTranscript])

  const handleUserSpeech = useCallback((msg: string) => {
    addToTranscript({ speaker: 'user', text: msg })
  }, [addToTranscript])

  const handleEmailNeeded = useCallback((suggestedEmail: string, subject: string) => {
    console.log('📧 email_needed received:', suggestedEmail, subject);
    setEmailValue(suggestedEmail);
    setEmailSubject(subject);
    setShowEmailInput(true);
  }, [])

  const { connect, disconnect, sendPrompt, sendEmailResponse, startMicrophone } = useLiveAgent(handleAgentMessage, handleUserSpeech, handleEmailNeeded)

  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    if (!SpeechRecognition) return
    try {
      const rec = new SpeechRecognition()
      rec.continuous = true; rec.interimResults = false; rec.lang = 'en-US';
      rec.onresult = (ev: any) => {
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          if (ev.results[i].isFinal) {
            const text = ev.results[i][0]?.transcript?.trim()
            if (text) handleUserSpeech(text)
          }
        }
      }
      rec.start(); recognitionRef.current = rec;
    } catch (e) {}
  }, [handleUserSpeech])

  const stopAllMedia = useCallback(() => {
    if (recognitionRef.current) { try { recognitionRef.current.stop() } catch (e) {} recognitionRef.current = null; }
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(t => {
        try { (t as any).applyConstraints({ advanced: [{ torch: false }] }); } catch (e) {}
        t.stop();
      });
      activeStreamRef.current = null;
    }
    if (videoRef.current) {
      const stream = videoRef.current.srcObject as MediaStream;
      if (stream) { stream.getTracks().forEach(t => t.stop()); }
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  }, [])

  useEffect(() => {
    let disposed = false;
    let localStream: MediaStream | null = null;

    // 5-second loading screen
    const loadingTimer = setTimeout(() => {
      setIsLoading(false);
    }, 5000);

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: 640, height: 480 }, audio: true })
        if (disposed) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        localStream = stream;
        activeStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          connect(videoRef.current);
          startMicrophone(stream);
          startSpeechRecognition();
        }
      } catch (err: any) { 
        if (!disposed) {
          setCameraError(err.message || "Camera access denied");
          setIsLoading(false);
        }
      }
    }
    init();
    const timer = setInterval(() => setSessionTime(p => p + 1), 1000)
    return () => {
      disposed = true;
      clearInterval(timer);
      clearTimeout(loadingTimer);
      disconnect();
      stopAllMedia();
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
      }
    }
  }, [connect, startMicrophone, disconnect, stopAllMedia, startSpeechRecognition])

  const formatTime = (s: number) => {
    const adjusted = Math.max(0, s - 5);
    return `${Math.floor(adjusted / 60).toString().padStart(2, "0")}:${(adjusted % 60).toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {isLoading && (
        <div className="absolute inset-0 z-[100] bg-black flex flex-col items-center justify-center gap-6">
          <Loader2 size={56} className="text-blue-500 animate-spin" />
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">Starting Consultation</h2>
            <p className="text-white/60">Connecting to clinical assistant and securing session...</p>
          </div>
        </div>
      )}
      {cameraError ? (
        <div className="flex items-center justify-center h-full text-white">{cameraError}</div>
      ) : !isStopping ? (
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover opacity-80" />
      ) : (
        <div className="flex items-center justify-center h-full"><Loader2 size={48} className="text-white animate-spin" /></div>
      )}
      <div className="absolute top-0 left-0 right-0 p-4 flex flex-col items-center">
        <div className="bg-yellow-500 text-black px-4 py-1 rounded text-xs font-bold flex items-center gap-2"><AlertTriangle size={14} /> AI ASSISTANT: NOT A DOCTOR</div>
        <div className="mt-4 text-white font-mono text-xl bg-black/40 px-3 py-1 rounded-full">{formatTime(sessionTime)}</div>
      </div>

      {/* Email input popup */}
      {showEmailInput && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900/95 border border-white/20 rounded-2xl p-6 w-full max-w-sm mx-6 shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <p className="text-white text-sm font-semibold">Send email to:</p>
              <button
                onClick={() => { setShowEmailInput(false); setEmailValue(""); }}
                className="text-white/50 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            {emailSubject && <p className="text-white/50 text-xs mb-3 truncate">Re: {emailSubject}</p>}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = emailValue.trim();
                if (trimmed) {
                  sendEmailResponse(trimmed);
                  addToTranscript({ speaker: 'user', text: `Email: ${trimmed}` });
                  setShowEmailInput(false);
                  setEmailValue("");
                  setEmailSubject("");
                  setCurrentMessage("Sending email...");
                }
              }}
              className="flex gap-2"
            >
              <input
                type="email"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                placeholder="doctor@example.com"
                className="flex-1 bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                autoFocus
                required
              />
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-blue-500 transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-6 px-6">
        <div className="text-white text-center text-sm max-w-md bg-black/50 p-4 rounded-xl backdrop-blur-md min-h-[60px] w-full border border-white/10">{currentMessage || "Connecting to Aria..."}</div>
        <button 
          disabled={isStopping}
          onClick={async () => {
            disconnect(); stopAllMedia();
            setIsStopping(true); setCurrentMessage("Generating summary...");
            try {
              // Get the user's Google ID to scope this session in Firestore
              let userId: string | undefined
              try {
                const userRes = await fetch('/api/user')
                if (userRes.ok) {
                  const userData = await userRes.json()
                  userId = userData.userId
                }
              } catch (_) { /* no-op — session saves anonymously if user fetch fails */ }

              const res = await fetch('/api/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript: transcriptRef.current, userId }),
              })
              const data = await res.json()
              onStop({
                transcript: transcriptRef.current,
                aiSummary: data.summary,
                actionItems: data.actionItems,
                medications: data.medications,
                method: data.method,
              })
            } catch (err) {
              onStop({ transcript: transcriptRef.current, aiSummary: 'Backend error.', method: 'error' })
            }
          }} 
          className="bg-red-600 text-white px-10 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-red-500 transition-all active:scale-95"
        >
          {isStopping ? <Loader2 size={18} className="animate-spin" /> : <Square size={18} />} {isStopping ? 'Summarizing...' : 'Stop'}
        </button>
      </div>
    </div>
  )
}