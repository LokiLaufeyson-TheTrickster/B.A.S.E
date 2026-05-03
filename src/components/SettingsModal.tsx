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
import { extractJSON } from '@/lib/utils';

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
  const [providerActive, setProviderActive] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugLogs, setDebugLogs] = useState<any[]>([]);
  const [purgeType, setPurgeType] = useState<'tasks' | 'habits' | 'both' | 'keys' | 'all' | null>(null);

  const refreshProvider = () => setProviderActive(hasAnyProvider());

  useEffect(() => {
    setGeminiKeyLocal(getGeminiKey());
    setORKeyLocal(getORKey());
    setORModelsLocal(getORModels());
    setGeminiOn(isGeminiEnabled());
    refreshProvider();
    loadDebugLogs();
  }, []);

  const loadDebugLogs = async () => {
    const logs = await db.debugLogs.orderBy('timestamp').reverse().toArray();
    setDebugLogs(logs);
  };

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

  const handlePurge = async (type: 'tasks' | 'habits' | 'both' | 'keys' | 'all') => {
    if (purgeType !== type) {
      setPurgeType(type);
      return;
    }

    if (type === 'tasks' || type === 'both' || type === 'all') {
      await db.tasks.clear();
    }
    if (type === 'habits' || type === 'both' || type === 'all') {
      await db.habits.clear();
      await db.logs.clear();
    }
    if (type === 'all') {
      await db.dojo.clear();
      await db.identity.clear();
    }
    if (type === 'keys' || type === 'all') {
      setGeminiKey('');
      setORKey('');
      setORModels([]);
      localStorage.removeItem('BASE_GEMINI_KEY');
      localStorage.removeItem('BASE_OR_KEY');
      localStorage.removeItem('BASE_OR_MODELS');
      setGeminiKeyLocal('');
      setORKeyLocal('');
      setORModelsLocal([]);
    }

    setPurgeType(null);
    onPurge();
    if (type === 'all' || type === 'keys') {
      onClose();
    }
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
          <span className="tp-header-title">
            {showInfo ? 'IDENTITY METRICS — EXPLAINED' : 'SETTINGS — AI PROVIDERS'}
          </span>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <button
              onClick={() => { setShowDebug(!showDebug); if (!showDebug) loadDebugLogs(); }}
              title="Audit AI Prompts"
              style={{
                color: 'var(--amber)',
                fontSize: '10px',
                fontWeight: 800,
                letterSpacing: '1px',
                padding: '4px 8px',
                border: '1px solid var(--amber)',
                borderRadius: 'var(--radius)',
              }}
            >
              DEBUG AUDIT
            </button>
            <button
              onClick={() => setShowInfo(!showInfo)}
              title="Identity Tutorial & Metrics FAQ"
              style={{
                color: 'var(--crimson)',
                fontSize: '20px',
                fontWeight: 900,
                textShadow: '0 0 10px var(--crimson-pulse)',
                animation: !showInfo ? 'breachPulse 2s infinite' : 'none'
              }}
            >
              ?
            </button>
            <button onClick={onClose} style={{ color: 'var(--gray-500)', fontSize: '16px' }}>✕</button>
          </div>
        </div>

        {showInfo ? (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Tutorial Section */}
            <div style={{ padding: '16px', background: 'var(--gray-100)', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--amber)', marginBottom: '8px', letterSpacing: '2px' }}>⚡ SYSTEM TUTORIAL — QUICK START</div>
              <ul style={{ fontSize: '11px', color: 'var(--gray-500)', paddingLeft: '16px', lineHeight: 1.6 }}>
                <li><b style={{ color: 'var(--white)' }}>SENTRY PARSER:</b> Use natural language. <i>"Gym every mon, wed, fri 7am #p1"</i> or <i>"Buy groceries by tomorrow #p3"</i></li>
                <li><b style={{ color: 'var(--white)' }}>BREACH MODE:</b> If you miss a habit, the system locks tasks and Dojo tracks until you confront the breach.</li>
                <li><b style={{ color: 'var(--white)' }}>THINKING PARTNER:</b> Click "CONFRONT" on a breached habit to negotiate with the AI and clear the lock.</li>
                <li><b style={{ color: 'var(--white)' }}>CLEAN DELETE:</b> Use "ARCHIVE" (Habits) or "CANCEL" (Tasks) to remove items without tanking your metrics.</li>
              </ul>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--gray-500)', lineHeight: 1.6 }}>
              The B.A.S.E. Identity Engine calculates your execution vector using five core factors. 
              Drift is measured against your personal peak performance.
            </div>

            {[
              { label: 'EXEC (Execution Rate)', desc: 'Percentage of habits completed versus scheduled. Archiving habits (keeping history) prevents this from dropping when you remove a task.' },
              { label: 'RISK⁻¹ (Stability)', desc: 'The inverse of your average Risk Score. Risk is calculated based on timing drift and execution volatility. Lower drift = Higher stability.' },
              { label: 'CONSIST (Consistency)', desc: 'Measures the standard deviation of your execution timestamps. Doing things at the EXACT same time every day maximizes this score.' },
              { label: 'STREAK (Momentum)', desc: 'Normalized average of all habit streaks. A 30-day streak across all habits represents 100% momentum.' },
              { label: 'RESIL (Resilience)', desc: 'Your average resilience value. Resilience increases with every completion (+5%) and is the primary buffer against Breach Mode.' }
            ].map(f => (
              <div key={f.label} style={{ borderLeft: '2px solid var(--gray-200)', paddingLeft: '16px' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '2px', color: 'var(--white)', marginBottom: '4px' }}>{f.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--gray-500)', lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            ))}

            <div style={{ 
              marginTop: '12px', padding: '12px', background: 'rgba(255,0,60,0.05)', 
              border: '1px solid var(--crimson-glow)', borderRadius: 'var(--radius)' 
            }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--crimson)', marginBottom: '4px', letterSpacing: '1px' }}>CLEAN DELETION</div>
              <div style={{ fontSize: '11px', color: 'var(--gray-400)', lineHeight: 1.4 }}>
                Deleting a habit normally wipes its logs, which can lower your EXEC rate. 
                Use **ARCHIVE** on Habits or **CANCEL** on Tasks to remove them from your view while preserving their positive impact on your metrics.
              </div>
            </div>
          </div>
        ) : showDebug ? (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--amber)', letterSpacing: '2px' }}>⚡ AI INTERACTION AUDIT (LAST 50)</div>
              <button 
                onClick={async () => { await db.debugLogs.clear(); loadDebugLogs(); }}
                style={{ fontSize: '9px', color: 'var(--gray-500)', textDecoration: 'underline' }}
              >
                Clear Audit
              </button>
            </div>
            {debugLogs.length === 0 && <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>No interactions logged yet.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '4px' }}>
              {debugLogs.map(log => (
                <div key={log.id} style={{ 
                  background: 'var(--gray-100)', border: '1px solid var(--gray-300)', 
                  borderRadius: 'var(--radius)', padding: '12px', fontSize: '11px' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid var(--gray-200)', paddingBottom: '4px' }}>
                    <span style={{ color: 'var(--amber)', fontWeight: 700 }}>{log.provider.toUpperCase()} • {log.model}</span>
                    <span style={{ color: 'var(--gray-500)', fontSize: '9px' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ color: 'var(--gray-500)', fontSize: '9px', marginBottom: '2px', fontWeight: 700 }}>AUDITOR PROMPT:</div>
                    <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--ghost)', fontFamily: 'var(--font-mono)', fontSize: '10px', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '2px' }}>
                      {log.prompt}
                    </pre>
                  </div>
                  <div>
                    <div style={{ color: 'var(--gray-500)', fontSize: '9px', marginBottom: '2px', fontWeight: 700 }}>MODEL RESPONSE:</div>
                    <div style={{ color: 'var(--white)', fontStyle: 'italic', background: 'var(--gray-200)', padding: '6px', borderRadius: '2px', marginBottom: '8px' }}>
                      {log.response}
                    </div>
                    {/* Extracted Features */}
                    {(() => {
                      const extracted = extractJSON(log.response);
                      if (!extracted) return null;
                      return (
                        <div style={{ borderTop: '1px dashed var(--gray-300)', paddingTop: '6px', marginTop: '6px' }}>
                          <div style={{ color: 'var(--amber)', fontSize: '9px', fontWeight: 800, marginBottom: '4px' }}>🔍 EXTRACTED FEATURES (JSON TEST)</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '4px', fontSize: '10px' }}>
                            <span style={{ color: 'var(--gray-500)' }}>Risk Score:</span>
                            <span style={{ color: Number(extracted.score) > 0.7 ? 'var(--crimson)' : 'var(--green)', fontWeight: 700 }}>
                              {(Number(extracted.score) * 100).toFixed(0)}%
                            </span>
                            <span style={{ color: 'var(--gray-500)' }}>Explanation:</span>
                            <span style={{ color: 'var(--white)' }}>{extracted.explanation}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
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
              <label style={{ ...labelStyle, color: 'var(--crimson)' }}>DANGER ZONE — GRANULAR PURGE</label>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                <button
                  onClick={() => handlePurge('tasks')}
                  style={{
                    ...btnSmall, padding: '10px',
                    color: purgeType === 'tasks' ? 'var(--white)' : 'var(--crimson)',
                    border: `1px solid var(--crimson)`,
                    background: purgeType === 'tasks' ? 'var(--crimson)' : 'transparent',
                  }}
                >
                  {purgeType === 'tasks' ? 'CONFIRM: TASKS' : 'DELETE TASKS ONLY'}
                </button>
                <button
                  onClick={() => handlePurge('habits')}
                  style={{
                    ...btnSmall, padding: '10px',
                    color: purgeType === 'habits' ? 'var(--white)' : 'var(--crimson)',
                    border: `1px solid var(--crimson)`,
                    background: purgeType === 'habits' ? 'var(--crimson)' : 'transparent',
                  }}
                >
                  {purgeType === 'habits' ? 'CONFIRM: HABITS' : 'DELETE HABITS ONLY'}
                </button>
                <button
                  onClick={() => handlePurge('both')}
                  style={{
                    ...btnSmall, padding: '10px',
                    color: purgeType === 'both' ? 'var(--white)' : 'var(--crimson)',
                    border: `1px solid var(--crimson)`,
                    background: purgeType === 'both' ? 'var(--crimson)' : 'transparent',
                  }}
                >
                  {purgeType === 'both' ? 'CONFIRM: BOTH' : 'DELETE TASKS + HABITS'}
                </button>
                <button
                  onClick={() => handlePurge('keys')}
                  style={{
                    ...btnSmall, padding: '10px',
                    color: purgeType === 'keys' ? 'var(--white)' : 'var(--crimson)',
                    border: `1px solid var(--crimson)`,
                    background: purgeType === 'keys' ? 'var(--crimson)' : 'transparent',
                  }}
                >
                  {purgeType === 'keys' ? 'CONFIRM: KEYS' : 'DELETE API + MODELS'}
                </button>
              </div>

              <button
                onClick={() => handlePurge('all')}
                style={{
                  ...btnSmall, width: '100%', padding: '12px', marginTop: '8px',
                  color: purgeType === 'all' ? 'var(--white)' : 'var(--crimson)',
                  border: `1px solid var(--crimson)`,
                  background: purgeType === 'all' ? 'var(--crimson)' : 'transparent',
                }}
              >
                {purgeType === 'all' ? 'CONFIRM: TOTAL WIPE' : 'DELETE ALL DATA (RESET)'}
              </button>
              
              {purgeType && (
                <div style={{
                  fontSize: '9px', color: 'var(--amber)',
                  marginTop: '8px', fontFamily: 'var(--font-mono)',
                  textAlign: 'center', letterSpacing: '0.5px'
                }}>
                  ⚠ CLICK THE HIGHLIGHTED BUTTON AGAIN TO CONFIRM SELECTION
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
