'use client';

import React, { useState, useEffect } from 'react';
import {
  getGeminiKey, setGeminiKey,
  getORKey, setORKey,
  getORModels, setORModels,
  testGeminiConnection, testORConnection,
  hasAnyProvider,
  isGeminiEnabled, setGeminiEnabled,
} from '@/lib/gemini';
import { db } from '@/lib/db';

interface SettingsModalProps {
  onClose: () => void;
  onPurge: () => void;
}

type TestStatus = 'idle' | 'testing' | 'pass' | 'fail' | 'rate_limited';

export default function SettingsModal({ onClose, onPurge }: SettingsModalProps) {
  // Gemini
  const [geminiKey, setGeminiKeyLocal] = useState('');
  const [geminiStatus, setGeminiStatus] = useState<TestStatus>('idle');
  const [geminiError, setGeminiError] = useState('');
  const [geminiOn, setGeminiOn] = useState(true);

  // OpenRouter
  const [orKey, setORKeyLocal] = useState('');
  const [orModels, setORModelsLocal] = useState<string[]>([]);
  const [newModel, setNewModel] = useState('');
  const [orStatuses, setORStatuses] = useState<Record<string, TestStatus>>({});
  const [purgeConfirm, setPurgeConfirm] = useState(false);
  const [providerActive, setProviderActive] = useState(false);

  const refreshProvider = () => setProviderActive(hasAnyProvider());

  useEffect(() => {
    setGeminiKeyLocal(getGeminiKey());
    setORKeyLocal(getORKey());
    setORModelsLocal(getORModels());
    setGeminiOn(isGeminiEnabled());
    refreshProvider();
  }, []);

  const handleSaveGemini = () => {
    setGeminiKey(geminiKey.trim());
    setGeminiStatus('idle');
    setGeminiError('');
    refreshProvider();
  };

  const handleTestGemini = async () => {
    handleSaveGemini();
    setGeminiStatus('testing');
    const result = await testGeminiConnection();
    if (result.ok) {
      setGeminiStatus('pass');
    } else if (result.error?.includes('429')) {
      setGeminiStatus('rate_limited');
      setGeminiError('Rate limited — try again in a minute');
    } else {
      setGeminiStatus('fail');
      setGeminiError(result.error || 'Unknown error');
    }
    refreshProvider();
  };

  const handleSaveOR = () => {
    setORKey(orKey.trim());
  };

  const handleAddModel = () => {
    const model = newModel.trim();
    if (!model || orModels.includes(model)) return;
    const updated = [...orModels, model];
    setORModelsLocal(updated);
    setORModels(updated);
    setNewModel('');
  };

  const handleRemoveModel = (model: string) => {
    const updated = orModels.filter(m => m !== model);
    setORModelsLocal(updated);
    setORModels(updated);
    const s = { ...orStatuses };
    delete s[model];
    setORStatuses(s);
  };

  const handleTestOR = async (model: string) => {
    handleSaveOR();
    setORStatuses(prev => ({ ...prev, [model]: 'testing' }));
    const result = await testORConnection(model);
    setORStatuses(prev => ({ ...prev, [model]: result.ok ? 'pass' : 'fail' }));
    refreshProvider();
  };

  const handlePurge = async () => {
    if (!purgeConfirm) {
      setPurgeConfirm(true);
      return;
    }
    await db.habits.clear();
    await db.tasks.clear();
    await db.logs.clear();
    await db.dojo.clear();
    await db.identity.clear();
    onPurge();
    onClose();
  };

  const statusIcon = (s: TestStatus) => {
    switch (s) {
      case 'idle': return '';
      case 'testing': return '⟳';
      case 'pass': return '✓';
      case 'fail': return '✕';
    }
  };

  const statusColor = (s: TestStatus) => {
    switch (s) {
      case 'pass': return 'var(--green)';
      case 'fail': return 'var(--crimson)';
      case 'rate_limited': return 'var(--amber)';
      case 'testing': return 'var(--amber)';
      default: return 'var(--gray-500)';
    }
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '9px', fontWeight: 700,
    letterSpacing: '2px', textTransform: 'uppercase',
    color: 'var(--gray-500)', marginBottom: '6px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', fontSize: '13px',
    borderRadius: 'var(--radius)',
  };

  const btnSmall: React.CSSProperties = {
    padding: '6px 12px', fontSize: '9px', fontWeight: 700,
    letterSpacing: '1px', textTransform: 'uppercase',
    borderRadius: 'var(--radius)', cursor: 'pointer',
    transition: 'var(--transition)',
  };

  return (
    <div className="tp-overlay" style={{ zIndex: 700 }}>
      <div className="tp-container animate-slide-up" style={{ maxWidth: '520px', maxHeight: '85vh', overflow: 'auto' }}>
        <div className="tp-header">
          <span className="tp-header-title">SETTINGS — AI PROVIDERS</span>
          <button onClick={onClose} style={{ color: 'var(--gray-500)', fontSize: '16px' }}>✕</button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Provider Status */}
          <div style={{
            padding: '10px 14px', borderRadius: 'var(--radius)',
            border: `1px solid ${providerActive ? 'var(--green)' : 'var(--amber)'}`,
            background: providerActive ? 'rgba(0,255,0,0.03)' : 'rgba(255,200,0,0.03)',
            fontSize: '10px', fontFamily: 'var(--font-mono)',
            letterSpacing: '1px', textTransform: 'uppercase',
            color: providerActive ? 'var(--green)' : 'var(--amber)',
          }}>
            {providerActive ? '● AI PROVIDER ACTIVE — VERIFIED' : '○ NO VERIFIED PROVIDER — TEST A MODEL TO ACTIVATE'}
          </div>

          {/* ── Gemini ─────────────────────────────────────────────────────── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>GEMINI API KEY (PRIMARY)</label>
              <button
                onClick={() => { const next = !geminiOn; setGeminiOn(next); setGeminiEnabled(next); }}
                style={{
                  ...btnSmall, fontSize: '8px',
                  color: geminiOn ? 'var(--green)' : 'var(--gray-500)',
                  border: `1px solid ${geminiOn ? 'var(--green)' : 'var(--gray-300)'}`,
                }}
              >
                {geminiOn ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--gray-400)', marginBottom: '8px', lineHeight: 1.5 }}>
              {geminiOn ? '' : 'Gemini skipped — going straight to OpenRouter. '}
              Get key at{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--crimson)' }}>
                aistudio.google.com
              </a>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="password"
                value={geminiKey}
                onChange={e => { setGeminiKeyLocal(e.target.value); setGeminiStatus('idle'); }}
                placeholder="AIza..."
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={handleTestGemini}
                disabled={!geminiKey.trim() || geminiStatus === 'testing'}
                style={{
                  ...btnSmall,
                  color: statusColor(geminiStatus),
                  border: `1px solid ${statusColor(geminiStatus)}`,
                }}
              >
                {geminiStatus === 'testing' ? 'TESTING...' : geminiStatus === 'pass' ? 'CONNECTED ✓' : geminiStatus === 'rate_limited' ? '429 RATE LIMITED' : geminiStatus === 'fail' ? 'FAILED ✕' : 'TEST'}
              </button>
            </div>
            {geminiError && (
              <div style={{ fontSize: '9px', color: 'var(--amber)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                {geminiError}
              </div>
            )}
          </div>

          {/* ── OpenRouter ──────────────────────────────────────────────── */}
          <div>
            <label style={labelStyle}>OPENROUTER API KEY (FALLBACK)</label>
            <div style={{ fontSize: '10px', color: 'var(--gray-400)', marginBottom: '8px', lineHeight: 1.5 }}>
              Falls back to OpenRouter if Gemini fails. Get key at{' '}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--crimson)' }}>
                openrouter.ai
              </a>
            </div>
            <input
              type="password"
              value={orKey}
              onChange={e => setORKeyLocal(e.target.value)}
              onBlur={handleSaveOR}
              placeholder="sk-or-..."
              style={inputStyle}
            />
          </div>

          {/* ── OR Models ──────────────────────────────────────────────── */}
          <div>
            <label style={labelStyle}>OPENROUTER MODELS (FALLBACK ORDER)</label>
            <div style={{ fontSize: '10px', color: 'var(--gray-400)', marginBottom: '8px', lineHeight: 1.5 }}>
              Add model strings in priority order. First working model wins.
              <br />Example: <code style={{ color: 'var(--ghost)' }}>google/gemini-2.0-flash-exp:free</code>
            </div>

            {/* Existing models */}
            {orModels.map((model, i) => (
              <div key={model} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 0', borderBottom: '1px solid var(--gray-200)',
              }}>
                <span style={{
                  fontSize: '9px', fontFamily: 'var(--font-mono)',
                  color: 'var(--gray-500)', width: '16px',
                }}>{i + 1}.</span>
                <span style={{
                  flex: 1, fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--ghost)',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>{model}</span>
                <span style={{ fontSize: '11px', color: statusColor(orStatuses[model] || 'idle') }}>
                  {statusIcon(orStatuses[model] || 'idle')}
                </span>
                <button
                  onClick={() => handleTestOR(model)}
                  disabled={!orKey.trim() || orStatuses[model] === 'testing'}
                  style={{
                    ...btnSmall, fontSize: '8px',
                    color: 'var(--gray-500)',
                    border: '1px solid var(--gray-300)',
                  }}
                >
                  {orStatuses[model] === 'testing' ? '...' : 'TEST'}
                </button>
                <button
                  onClick={() => handleRemoveModel(model)}
                  style={{
                    ...btnSmall, fontSize: '12px',
                    color: 'var(--gray-400)',
                    border: 'none', padding: '4px 6px',
                  }}
                >
                  ✕
                </button>
              </div>
            ))}

            {/* Add model */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <input
                type="text"
                value={newModel}
                onChange={e => setNewModel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddModel()}
                placeholder="model/name e.g. anthropic/claude-3.5-sonnet"
                style={{ ...inputStyle, flex: 1, fontSize: '11px' }}
              />
              <button
                onClick={handleAddModel}
                disabled={!newModel.trim()}
                style={{
                  ...btnSmall,
                  color: 'var(--crimson)',
                  border: '1px solid var(--crimson)',
                }}
              >
                ADD
              </button>
            </div>
          </div>

          {/* ── Danger Zone ──────────────────────────────────────────── */}
          <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '16px' }}>
            <label style={{ ...labelStyle, color: 'var(--crimson)' }}>DANGER ZONE</label>
            {purgeConfirm && (
              <div style={{
                fontSize: '10px', color: 'var(--crimson)',
                marginBottom: '8px', fontFamily: 'var(--font-mono)',
                letterSpacing: '0.5px',
              }}>
                ⚠ THIS WILL DELETE ALL HABITS, TASKS, LOGS, AND DOJO TRACKS. CLICK AGAIN TO CONFIRM.
              </div>
            )}
            <button
              onClick={handlePurge}
              style={{
                ...btnSmall, width: '100%', padding: '12px',
                color: purgeConfirm ? 'var(--white)' : 'var(--crimson)',
                border: `1px solid var(--crimson)`,
                background: purgeConfirm ? 'var(--crimson)' : 'transparent',
              }}
            >
              {purgeConfirm ? 'CONFIRM — PURGE EVERYTHING' : 'PURGE ALL DATA'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
