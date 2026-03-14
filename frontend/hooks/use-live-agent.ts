import { useState, useRef, useCallback } from 'react';

export function useLiveAgent(onMessage?: (msg: string) => void, onUserSpeech?: (msg: string) => void) {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const socketRef = useRef<WebSocket | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextAudioStartTimeRef = useRef<number>(0);
  const disposedRef = useRef(false);

  const connect = useCallback(async (videoElement?: HTMLVideoElement) => {
    if (socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING) return;

    disposedRef.current = false;
    setStatus('connecting');

    // 1. Parallel Fetch: Get OAuth tokens AND the Health Summary
    let accessToken: string | null = null;
    let refreshToken: string | null = null;
    let fitSummary: any = null;

    try {
      const [tokenRes, fitRes] = await Promise.all([
        fetch('/api/auth/token'),
        fetch('/api/fitness/summary', { signal: AbortSignal.timeout(3000) }) // 3s timeout
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
      console.warn('Pre-flight data fetch failed, proceeding with defaults:', e);
    }

    const socket = new WebSocket('wss://medlens-backend-88029418749.us-central1.run.app');

    socket.onopen = () => {
      if (disposedRef.current) { socket.close(); return; }
      setStatus('connected');
      
      // 2. Send everything in the start message
      socket.send(JSON.stringify({ 
        type: 'session_start', 
        sessionId: 'hack-' + Date.now(),
        accessToken,
        refreshToken,
        fitSummary // <--- Injected Health Data
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
          const binary = atob(data.data);
          const bytes = new Int16Array(new Uint8Array(binary.split('').map(c => c.charCodeAt(0))).buffer);
          if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
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
        } else if (data.type === 'agent_speech_text' && onMessage) {
          onMessage(data.text);
        } else if (data.type === 'user_speech_text' && onUserSpeech) {
          onUserSpeech(data.text);
        }
      } catch (e) { console.error("Socket Message Error:", e); }
    };

    socket.onclose = () => {
      setStatus('disconnected');
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    };
    socketRef.current = socket;
  }, [onMessage, onUserSpeech]);

  const startMicrophone = useCallback(async (stream: MediaStream) => {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const source = audioCtx.createMediaStreamSource(stream);
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) pcm16[i] = input[i] * 0x7FFF;
      const b64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'audio_chunk', data: b64 }));
      }
    };
    source.connect(processor);
    processor.connect(audioCtx.destination);
  }, []);

  const disconnect = useCallback(() => {
    disposedRef.current = true;
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    socketRef.current?.close();
    if (audioCtxRef.current) audioCtxRef.current.close();
  }, []);

  const sendPrompt = (text: string) => {
    socketRef.current?.send(JSON.stringify({ type: 'user_prompt', text }));
  }

  return { status, connect, disconnect, sendPrompt, startMicrophone };
}