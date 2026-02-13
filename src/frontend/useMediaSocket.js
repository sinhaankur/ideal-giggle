import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';

/**
 * useMediaSocket
 *
 * Lightweight React hook that connects to the media_stream_server Socket.io
 * backend and exposes helpers to send audio and camera frames in real time.
 *
 * Example:
 * const { connected, sendAudioChunk, sendFrameCapture } = useMediaSocket();
 */
export function useMediaSocket(options = {}) {
  const {
    url = process.env.MEDIA_SERVER_URL || 'http://localhost:4100',
    autoConnect = true,
  } = options;

  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!autoConnect) return undefined;

    const socket = io(url, {
      transports: ['websocket', 'polling'],
      withCredentials: false,
    });

    socketRef.current = socket;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [url, autoConnect]);

  const api = useMemo(
    () => ({
      connected,
      /**
       * Send an audio chunk to the backend.
       * @param {{ chunk: string | ArrayBuffer | Uint8Array, mimeType?: string, ts?: number }} payload
       */
      sendAudioChunk(payload) {
        if (!socketRef.current || !connected) return;
        socketRef.current.emit('audio-stream', {
          ...payload,
          ts: payload?.ts ?? Date.now(),
        });
      },
      /**
       * Send a base64-encoded frame from the camera.
       * @param {{ imageBase64: string, ts?: number }} payload
       */
      sendFrameCapture(payload) {
        if (!socketRef.current || !connected) return;
        socketRef.current.emit('frame-capture', {
          ...payload,
          ts: payload?.ts ?? Date.now(),
        });
      },
    }),
    [connected]
  );

  return api;
}

export default useMediaSocket;
