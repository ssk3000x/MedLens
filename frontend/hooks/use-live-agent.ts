import { useState, useRef, useCallback } from 'react';

export function useLiveAgent() {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const socketRef = useRef<WebSocket | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startFrameStreaming = (videoElement: HTMLVideoElement) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 640;
    canvas.height = 480;

    // Send a frame every 1 second (adjust for lower latency)
    frameIntervalRef.current = setInterval(() => {
      if (ctx && videoElement.videoWidth) {
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        const base64Data = canvas.toDataURL('image/jpeg').split(',')[1];
        
        socketRef.current?.send(JSON.stringify({
          type: 'frame',
          mime: 'image/jpeg',
          data: base64Data
        }));
      }
    }, 1000);
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
      console.log('🤖 Backend Message:', data);
    };

    socket.onclose = () => {
      setStatus('disconnected');
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    };
    
    socketRef.current = socket;
  }, []);

  const disconnect = useCallback(() => {
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    socketRef.current?.close();
  }, []);

  return { status, connect, disconnect };
}