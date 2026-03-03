import { useState, useRef, useCallback } from 'react';

export function useLiveAgent(onMessage?: (msg: string) => void) {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const socketRef = useRef<WebSocket | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextAudioStartTimeRef = useRef<number>(0);

  // Microphone capture refs
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const micProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const micSequenceRef = useRef<number>(0);

  const startFrameStreaming = (videoElement: HTMLVideoElement) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let streamStarted = false;
    let onReadyListeners: Array<() => void> = [];

    const doStart = () => {
      if (streamStarted) return;
      streamStarted = true;

      // Capture a higher-quality image more frequently to keep the buffered
      // frame fresh. 500ms is a reasonable tradeoff for interactivity and
      // bandwidth.
      frameIntervalRef.current = setInterval(() => {
        try {
          if (!ctx || !videoElement || !videoElement.videoWidth) return;

          const maxW = 1280;
          const maxH = 720;
          const ratio = Math.min(maxW / videoElement.videoWidth, maxH / videoElement.videoHeight, 1);
          const w = Math.floor(videoElement.videoWidth * ratio);
          const h = Math.floor(videoElement.videoHeight * ratio);
          canvas.width = w;
          canvas.height = h;

          ctx.drawImage(videoElement, 0, 0, w, h);

          // Use high-quality JPEG compression so printed text remains readable
          const base64Data = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];

          socketRef.current?.send(JSON.stringify({
            type: 'frame',
            mime: 'image/jpeg',
            data: base64Data
          }));
        } catch (e) {
          // ignore transient draw errors
        }
      }, 500);
    };

    // If the video element already has dimensions, start immediately. Otherwise
    // wait for the first frame to arrive (playing/loadedmetadata).
    if (videoElement.videoWidth && videoElement.videoHeight) {
      doStart();
    } else {
      const onPlaying = () => {
        doStart();
      };
      const onLoaded = () => {
        doStart();
      };

      videoElement.addEventListener('playing', onPlaying, { once: true });
      videoElement.addEventListener('loadedmetadata', onLoaded, { once: true });

      onReadyListeners.push(() => videoElement.removeEventListener('playing', onPlaying));
      onReadyListeners.push(() => videoElement.removeEventListener('loadedmetadata', onLoaded));
    }

    // Cleanup helper in case we need to stop streaming early
    const cleanup = () => {
      try {
        if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      } catch (e) {}
      onReadyListeners.forEach((fn) => {
        try { fn(); } catch (e) {}
      });
    };

    // Attach cleanup to socket close so streaming always stops
    try {
      const s = socketRef.current;
      const onClose = () => cleanup();
      s.addEventListener('close', onClose);
    } catch (e) {
      /* ignore */
    }
  };

  const connect = useCallback((videoElement?: HTMLVideoElement) => {
    setStatus('connecting');
    const socket = new WebSocket('ws://localhost:8081');

    socket.onopen = () => {
      setStatus('connected');
      console.log('🔗 Connected to Backend');
      socket.send(JSON.stringify({ type: 'session_start', sessionId: 'test-123' }));
      
      if (videoElement) {
        startFrameStreaming(videoElement);
      }
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'agent_speech_chunk' && typeof data.data === 'string') {
        try {
          const b64 = data.data;
          const binary = atob(b64);
          const len = binary.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
          const arrayBuffer = bytes.buffer;

          const ensureAudioCtx = () => {
            if (!audioCtxRef.current) {
              const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
              // Setting sampleRate to 24000 for Gemini Live audio
              audioCtxRef.current = new AudioContextClass({ sampleRate: 24000 });
              nextAudioStartTimeRef.current = audioCtxRef.current.currentTime;
            }
            return audioCtxRef.current;
          };

          const audioCtx = ensureAudioCtx();
          
          if (audioCtx.state === 'suspended') {
            audioCtx.resume();
          }

          // Gemini streams raw 16-bit PCM little-endian at 24000 Hz
          const view = new DataView(arrayBuffer);
          const sampleCount = Math.floor(view.byteLength / 2);
          const floats = new Float32Array(sampleCount);
          for (let i = 0; i < sampleCount; i++) {
            const int16 = view.getInt16(i * 2, true);
            floats[i] = int16 / 32768; // convert to float [-1.0, 1.0]
          }

          const buf = audioCtx.createBuffer(1, floats.length, 24000);
          buf.getChannelData(0).set(floats);

          const src = audioCtx.createBufferSource();
          src.buffer = buf;
          src.connect(audioCtx.destination);

          // Schedule playback continuously
          const scheduleTime = Math.max(nextAudioStartTimeRef.current, audioCtx.currentTime);
          src.start(scheduleTime);
          nextAudioStartTimeRef.current = scheduleTime + buf.duration;

        } catch (e) {
          console.error("Failed to play audio chunk", e);
        }
      } else if (data.type === 'agent_speech_text' && typeof data.text === 'string') {
        if (onMessage) {
            onMessage(data.text);
        }
      } else if (data.type === 'agent_speech_end') {
        // Playback has been buffered, do nothing or reset tracking if necessary
        if (onMessage) {
            // Can notify that agent stopped speaking etc if needed
        }
      } else if (data.type !== 'keepalive' && data.type !== 'frame') {
        console.log('🤖 Backend Message:', data);
      }
    };

    socket.onclose = () => {
      setStatus('disconnected');
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
    
    socketRef.current = socket;
  }, []);

  // Convert Float32Array [-1,1] to 16-bit PCM little-endian
  const floatTo16BitPCM = (float32Array: Float32Array) => {
    const l = float32Array.length;
    const buffer = new ArrayBuffer(l * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < l; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      // scale to 16-bit signed int
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Uint8Array(buffer);
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer | Uint8Array) => {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const chunkSize = 0x8000; // avoid apply call size limits
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const sub = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(sub));
    }
    return btoa(binary);
  };

  // Start microphone capture and stream raw 16-bit PCM chunks (16kHz preferred)
  const startMicrophone = useCallback(async (providedStream?: MediaStream) => {
    try {
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        console.warn('WebSocket not open — microphone will not stream until connected');
      }

      const stream = providedStream ?? (await navigator.mediaDevices.getUserMedia({ audio: true }));
      micStreamRef.current = stream;

      // Try to create AudioContext with 16000Hz; browsers may ignore but it's a best-effort
      const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtxClass({ sampleRate: 16000 });
      micAudioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);

      // ScriptProcessor buffer size 4096 is a reasonable compromise for latency
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      micProcessorRef.current = processor;

      processor.onaudioprocess = (ev: AudioProcessingEvent) => {
        try {
          const input = ev.inputBuffer.getChannelData(0);
          const pcm16 = floatTo16BitPCM(input);
          const b64 = arrayBufferToBase64(pcm16.buffer);
          micSequenceRef.current += 1;
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'audio_chunk', sequence: micSequenceRef.current, data: b64 }));
          }
        } catch (e) {
          // ignore transient processing errors
        }
      };

      source.connect(processor);
      // Connect processor to destination to keep the node alive; do not boost output
      try {
        processor.connect(audioCtx.destination);
      } catch (e) {
        // Some browsers may disallow direct connect; ignore
      }
    } catch (e) {
      console.warn('Failed to start microphone capture', e);
    }
  }, []);

  const stopMicrophone = useCallback(() => {
    try {
      if (micProcessorRef.current) {
        try { micProcessorRef.current.disconnect(); } catch (e) {}
        micProcessorRef.current.onaudioprocess = null as any;
        micProcessorRef.current = null;
      }
      if (micAudioCtxRef.current) {
        try { micAudioCtxRef.current.close(); } catch (e) {}
        micAudioCtxRef.current = null;
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch (e) {} });
        micStreamRef.current = null;
      }
    } catch (e) {
      /* ignore */
    }
  }, []);

  const sendPrompt = useCallback((text?: string) => {
    const prompt = text || 'Describe the most recent image and list any medications visible. Keep it under 3 sentences.';
    try {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'user_prompt', text: prompt }));
      } else {
        console.warn('WebSocket not open — cannot send prompt');
      }
    } catch (e) {
      console.error('Failed to send prompt', e);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  return { status, connect, disconnect, sendPrompt, startMicrophone, stopMicrophone };
}