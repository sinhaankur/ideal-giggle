import React from 'react';
import LLMConnector from './LLMConnector';
import useMediaSocket from './useMediaSocket';

export function LLMConsolePage() {
  const { connected, sendAudioChunk, sendFrameCapture } = useMediaSocket();

  const handleSendTestAudio = () => {
    // Demo payload only – in a real app, wire this to MediaRecorder chunks.
    const dummy = new Uint8Array(320).fill(0);
    sendAudioChunk({ chunk: dummy, mimeType: 'audio/webm' });
  };

  const handleSendTestFrame = () => {
    // Transparent 1x1 PNG – placeholder to exercise the pipeline.
    const transparentPngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
    sendFrameCapture({ imageBase64: transparentPngBase64 });
  };

  const pageStyle = {
    minHeight: '100vh',
    background: '#001b23',
    color: '#fdf6e3',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: 24,
    boxSizing: 'border-box',
    fontFamily: "'Menlo', 'Monaco', monospace",
  };

  const shellStyle = {
    width: '100%',
    maxWidth: 1000,
    border: '2px solid #586e75',
    borderRadius: 6,
    background: '#002b36',
    padding: 16,
    boxShadow: '0 0 18px rgba(0, 0, 0, 0.6)',
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  };

  const mediaPanelStyle = {
    marginTop: 16,
    padding: 12,
    borderRadius: 6,
    border: '1px solid #586e75',
    background: '#00212b',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  };

  const pillStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 11,
    border: `1px solid ${connected ? '#859900' : '#dc322f'}`,
    color: connected ? '#859900' : '#dc322f',
  };

  const buttonRow = {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  };

  const smallButton = {
    padding: '4px 10px',
    borderRadius: 4,
    border: '1px solid #b58900',
    background: '#b58900',
    color: '#002b36',
    fontSize: 11,
    fontWeight: 600,
    cursor: connected ? 'pointer' : 'not-allowed',
    opacity: connected ? 1 : 0.5,
  };

  return (
    <div style={pageStyle}>
      <div style={shellStyle}>
        <div style={headerStyle}>
          <div>
            <div style={{ fontSize: 14, letterSpacing: 1 }}>AI BACKEND & MEDIA CONSOLE</div>
            <div style={{ fontSize: 11, color: '#93a1a1' }}>
              Configure your LLM engine and inspect live media streaming.
            </div>
          </div>
          <div style={pillStyle}>
            <span style={{ fontSize: 10 }}>{connected ? '●' : '○'}</span>
            <span>{connected ? 'Media socket: online' : 'Media socket: offline'}</span>
          </div>
        </div>

        <LLMConnector />

        <div style={mediaPanelStyle}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 12, marginBottom: 6 }}>Media Stream Controls</div>
            <div style={{ fontSize: 11, color: '#93a1a1', marginBottom: 8 }}>
              These test buttons send dummy audio chunks and frames over Socket.io to
              validate that the real-time pipeline is wired up.
            </div>
            <div style={buttonRow}>
              <button
                type="button"
                style={smallButton}
                onClick={handleSendTestAudio}
                disabled={!connected}
              >
                🎙 Send Test Audio Chunk
              </button>
              <button
                type="button"
                style={smallButton}
                onClick={handleSendTestFrame}
                disabled={!connected}
              >
                📷 Send Test Frame
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LLMConsolePage;
