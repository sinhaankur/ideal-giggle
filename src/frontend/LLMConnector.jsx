import React, { useEffect, useMemo, useState } from 'react';

// Simple retro-ish emoji icons for each card
const PROVIDERS = [
  { id: 'local', label: 'Local (Ollama)', icon: '💾' },
  { id: 'openai', label: 'OpenAI (GPT-4)', icon: '🧠' },
  { id: 'custom', label: 'Custom LLM Link', icon: '🔗' },
];

const STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
};

export function LLMConnector() {
  const [selectedProvider, setSelectedProvider] = useState('local');
  const [status, setStatus] = useState(STATUS.DISCONNECTED);
  const [progress, setProgress] = useState(0);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [privacyEnabled, setPrivacyEnabled] = useState(true);

  // Derived label for the staged connection
  const statusLabel = useMemo(() => {
    if (status === STATUS.DISCONNECTED) return 'Disconnected';
    if (status === STATUS.CONNECTED) return 'Connected';

    if (progress <= 40) return 'Probing local port 11434...';
    if (progress <= 80) return 'Authenticating handshake...';
    return 'Model loaded into memory.';
  }, [status, progress]);

  const privacyBadge = useMemo(() => {
    const isLocal = selectedProvider === 'local';

    if (!privacyEnabled) {
      return {
        color: '#b58900',
        label: 'Privacy Relaxed (user override)',
        icon: '⚠️',
      };
    }

    if (isLocal) {
      return {
        color: '#2aa198',
        label: 'Full Privacy Mode',
        icon: '🛡️',
      };
    }

    return {
      color: '#dc322f',
      label: 'Cloud-Shared Data',
      icon: '🌐',
    };
  }, [selectedProvider, privacyEnabled]);

  useEffect(() => {
    if (status !== STATUS.CONNECTING) return;

    let start = performance.now();
    let frameId;

    const totalMs = 3000;

    const tick = (now) => {
      const elapsed = now - start;
      const pct = Math.min(100, Math.round((elapsed / totalMs) * 100));
      setProgress(pct);

      if (elapsed >= totalMs) {
        setStatus(STATUS.CONNECTED);
        setProgress(100);
        return;
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [status]);

  const handleConnect = () => {
    if (status === STATUS.CONNECTING) return;

    setStatus(STATUS.CONNECTING);
    setProgress(0);
  };

  const handleProviderSelect = (id) => {
    setSelectedProvider(id);
    // Reset status when switching providers
    setStatus(STATUS.DISCONNECTED);
    setProgress(0);
  };

  const isLocalProvider = selectedProvider === 'local';

  // --- Styling helpers ---
  const containerStyle = {
    fontFamily: "'Menlo', 'Monaco', monospace",
    background: '#002b36',
    color: '#fdf6e3',
    padding: '16px',
    borderRadius: '6px',
    border: '2px solid #586e75',
    maxWidth: 720,
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  };

  const cardsRowStyle = {
    display: 'flex',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  };

  const baseCardStyle = (isSelected, isHovered) => ({
    flex: '1 1 200px',
    padding: '12px 10px',
    borderRadius: 6,
    border: `2px solid ${isSelected ? '#b58900' : '#586e75'}`,
    background: isSelected ? '#073642' : '#00212b',
    cursor: 'pointer',
    transition: 'box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease',
    boxShadow: isHovered
      ? '0 0 12px rgba(181, 137, 0, 0.75)'
      : '0 0 4px rgba(0, 0, 0, 0.5)',
    transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  });

  const progressBarOuter = {
    height: 10,
    borderRadius: 999,
    background: '#073642',
    overflow: 'hidden',
    border: '1px solid #586e75',
  };

  const progressBarInner = {
    height: '100%',
    width: `${progress}%`,
    transition: 'width 0.15s linear',
    background: 'linear-gradient(90deg, #859900, #b58900)',
  };

  const badgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    borderRadius: 999,
    fontSize: 12,
    border: `1px solid ${privacyBadge.color}`,
    color: privacyBadge.color,
    backgroundColor: 'rgba(0,0,0,0.15)',
  };

  const toggleTrackStyle = {
    width: 42,
    height: 20,
    borderRadius: 999,
    background: privacyEnabled ? '#2aa198' : '#586e75',
    border: '1px solid #073642',
    padding: 2,
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  };

  const toggleThumbStyle = {
    width: 14,
    height: 14,
    borderRadius: '50%',
    background: '#fdf6e3',
    transform: privacyEnabled ? 'translateX(20px)' : 'translateX(0)',
    transition: 'transform 0.18s ease',
  };

  const connectButtonStyle = {
    padding: '6px 14px',
    borderRadius: 4,
    border: '2px solid #b58900',
    background: status === STATUS.CONNECTED ? '#859900' : '#b58900',
    color: '#002b36',
    fontWeight: 700,
    fontSize: 13,
    cursor: status === STATUS.CONNECTING ? 'wait' : 'pointer',
    opacity: status === STATUS.CONNECTING ? 0.7 : 1,
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 14, letterSpacing: 1 }}>LLM CONNECTOR</div>
          <div style={{ fontSize: 11, color: '#93a1a1' }}>
            Select your large language model backend and connection mode.
          </div>
        </div>
        <button
          type="button"
          style={connectButtonStyle}
          onClick={handleConnect}
          disabled={status === STATUS.CONNECTING}
        >
          {status === STATUS.CONNECTING
            ? 'Connecting…'
            : status === STATUS.CONNECTED
            ? 'Reconnect'
            : 'Connect'}
        </button>
      </div>

      <div style={cardsRowStyle}>
        {PROVIDERS.map((p) => {
          const isSelected = selectedProvider === p.id;
          const isHovered = hoveredCard === p.id;
          return (
            <div
              key={p.id}
              style={baseCardStyle(isSelected, isHovered)}
              onClick={() => handleProviderSelect(p.id)}
              onMouseEnter={() => setHoveredCard(p.id)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{p.icon}</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{p.label}</span>
              </div>
              <div style={{ fontSize: 11, color: '#93a1a1' }}>
                {p.id === 'local' && 'Runs entirely on this machine via Ollama.'}
                {p.id === 'openai' && 'Calls GPT-4 over the internet using your API key.'}
                {p.id === 'custom' && 'Point to a self-hosted or third-party LLM endpoint.'}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, marginBottom: 4 }}>Connection Status</div>
          <div style={progressBarOuter}>
            <div style={progressBarInner} />
          </div>
          <div style={{ fontSize: 11, color: '#93a1a1', marginTop: 4 }}>
            {statusLabel}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 210 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11 }}>Privacy Toggle</span>
            <div
              role="switch"
              aria-checked={privacyEnabled}
              style={toggleTrackStyle}
              onClick={() => setPrivacyEnabled((v) => !v)}
            >
              <div style={toggleThumbStyle} />
            </div>
          </div>
          <div style={badgeStyle}>
            <span>{privacyBadge.icon}</span>
            <span>{privacyBadge.label}</span>
          </div>
          {!isLocalProvider && privacyEnabled && (
            <div style={{ fontSize: 10, color: '#cb4b16' }}>
              Media and prompts may transit remote infrastructure when using cloud models.
            </div>
          )}
          {isLocalProvider && privacyEnabled && (
            <div style={{ fontSize: 10, color: '#859900' }}>
              All tokens stay on this device when using Ollama.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LLMConnector;
