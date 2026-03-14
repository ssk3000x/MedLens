import { useState, useRef, useCallback } from 'react';

export function useLiveAgent(
  onMessage?: (msg: string) => void,
  onUserSpeech?: (msg: string) => void,
  onEmailNeeded?: (suggestedEmail: string, subject: string) => void
) {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const socketRef = useRef<WebSocket | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const micProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextAudioStartTimeRef = useRef<number>(0);
  const disposedRef = useRef(false);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isInterruptedRef = useRef(false);

  const connect = useCallback(async (videoElement?: HTMLVideoElement) => {
    if (socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING) return;

    disposedRef.current = false;
    setStatus('connecting');

    let accessToken: string | null = null;
    let refreshToken: string | null = null;
    let fitSummary: any = null;

    try {
      const[tokenRes, fitRes] = await Promise.all([
        fetch('/api/auth/token'),
        fetch('/api/fitness/summary', { signal: AbortSignal.timeout(3000) }) 
      ]);

      if (tokenRes.ok) {
        const t = await tokenRes.json();
        accessToken = t.accessToken;
        refreshToken = t.refreshToken;
      }
      if (fitRes.ok) {
        const f = await fitRes.json();
        fitSummary = f.fitSummary;
      }
    } catch (e) {
      console.warn('Pre-flight data fetch failed, proceeding with defaults');
    }

    const socket = new WebSocket('wss://medlens-backend-88029418749.us-central1.run.app');

    socket.onopen = () => {
      if (disposedRef.current) { socket.close(); return; }
      setStatus('connected');
      
      socket.send(JSON.stringify({ 
        type: 'session_start', 
        sessionId: 'hack-' + Date.now(),
        accessToken,
        refreshToken,
        fitSummary
      }));
      
      if (videoElement) {
        frameIntervalRef.current = setInterval(() => {
          const canvas = document.createElement('canvas');
          canvas.width = 480; canvas.height = 360;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(videoElement, 0, 0, 480, 360);
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ 
              type: 'frame', 
              data: canvas.toDataURL('image/jpeg', 0.4).split(',')[1] 
            }));
          }
        }, 1000);
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'agent_speech_chunk') {
          // Discard audio that arrives after user interrupted
          if (isInterruptedRef.current) return;
          const binary = atob(data.data);
          const bytes = new Int16Array(new Uint8Array(binary.split('').map(c => c.charCodeAt(0))).buffer);
          if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          }
          const audioCtx = audioCtxRef.current;
          if (audioCtx.state === 'suspended') audioCtx.resume();
          const floats = new Float32Array(bytes.length);
          for (let i = 0; i < bytes.length; i++) floats[i] = bytes[i] / 32768;
          const buffer = audioCtx.createBuffer(1, floats.length, 24000);
          buffer.getChannelData(0).set(floats);
          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(audioCtx.destination);
          const startTime = Math.max(nextAudioStartTimeRef.current, audioCtx.currentTime);
          source.start(startTime);
          nextAudioStartTimeRef.current = startTime + buffer.duration;
          // Track source for interruption
          activeSourcesRef.current.push(source);
          source.onended = () => {
            activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
          };
        } else if (data.type === 'agent_speech_text' && onMessage) {
          onMessage(data.text);
        } else if (data.type === 'agent_speech_end') {
          // Turn complete — allow audio playback for next turn
          isInterruptedRef.current = false;
        } else if (data.type === 'user_speech_text' && onUserSpeech) {
          onUserSpeech(data.text);
        } else if (data.type === 'email_needed' && onEmailNeeded) {
          onEmailNeeded(data.suggestedEmail || '', data.subject || '');
        }
      } catch (e) { console.error("Socket Message Error:", e); }
    };

    socket.onclose = () => {
      setStatus('disconnected');
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    };
    socketRef.current = socket;
  },[onMessage, onUserSpeech, onEmailNeeded]);

  const startMicrophone = useCallback(async (stream: MediaStream) => {
    streamRef.current = stream;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      micAudioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      micSourceRef.current = source;
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      micProcessorRef.current = processor;
      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        // Voice Activity Detection: interrupt agent when user speaks
        let sumSq = 0;
        for (let i = 0; i < input.length; i++) sumSq += input[i] * input[i];
        const rms = Math.sqrt(sumSq / input.length);
        if (rms > 0.02 && activeSourcesRef.current.length > 0) {
          // User is speaking while agent audio is playing — interrupt
          activeSourcesRef.current.forEach(s => { try { s.stop(); } catch (_) {} });
          activeSourcesRef.current = [];
          nextAudioStartTimeRef.current = 0;
          isInterruptedRef.current = true;
        }
        const pcm16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) pcm16[i] = input[i] * 0x7FFF;
        const b64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'audio_chunk', data: b64 }));
        }
      };
      source.connect(processor);
      processor.connect(audioCtx.destination);
    } catch (e) { console.warn("Mic init failed", e); }
  },[]);

  const disconnect = useCallback(() => {
    disposedRef.current = true;
    if (frameIntervalRef.current) { clearInterval(frameIntervalRef.current); frameIntervalRef.current = null; }
    socketRef.current?.close();
    
    // Kill the processor callback first to stop it from holding things alive
    if (micProcessorRef.current) {
      micProcessorRef.current.onaudioprocess = null;
      try { micProcessorRef.current.disconnect(); } catch (e) {}
      micProcessorRef.current = null;
    }
    if (micSourceRef.current) {
      try { micSourceRef.current.disconnect(); } catch (e) {}
      micSourceRef.current = null;
    }
    if (micAudioCtxRef.current && micAudioCtxRef.current.state !== 'closed') {
      micAudioCtxRef.current.close().catch(() => {});
      micAudioCtxRef.current = null;
    }
    
    // Stop all queued playback sources and close context
    activeSourcesRef.current.forEach(s => { try { s.stop(); } catch (_) {} });
    activeSourcesRef.current = [];
    isInterruptedRef.current = false;
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    // NUCLEAR: Stop all tracks on the stream directly from the hook
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => {
        try { t.stop(); } catch (e) {}
      });
      streamRef.current = null;
    }
  },[]);

  const sendPrompt = (text: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'user_prompt', text }));
    }
  }

  const sendEmailResponse = async (email: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      // Fetch a fresh access token before sending
      let freshToken: string | null = null;
      try {
        const res = await fetch('/api/auth/token');
        if (res.ok) {
          const t = await res.json();
          freshToken = t.accessToken;
        }
      } catch (e) {}
      socketRef.current.send(JSON.stringify({ type: 'email_response', email, accessToken: freshToken }));
    }
  }

  return { status, connect, disconnect, sendPrompt, sendEmailResponse, startMicrophone };
}