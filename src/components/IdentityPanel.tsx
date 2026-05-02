'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { generateWeeklyVector, getOverallScore, getIdentityDrift, shouldDeployIdentityAttack } from '@/lib/identityEngine';
import { getRandomVice } from '@/lib/vice50';

const VECTOR_LABELS = ['EXEC', 'RISK⁻¹', 'CONSIST', 'STREAK', 'RESIL'];

export default function IdentityPanel() {
  const [vector, setVector] = useState<number[]>([0, 0, 0, 0, 0]);
  const [score, setScore] = useState(0);
  const [drift, setDrift] = useState(0);
  const [showAttack, setShowAttack] = useState(false);
  const [attackQuote, setAttackQuote] = useState('');

  const loadIdentity = useCallback(async () => {
    const v = await generateWeeklyVector();
    setVector(v);
    setScore(getOverallScore(v));

    const d = await getIdentityDrift();
    setDrift(d);

    const attack = await shouldDeployIdentityAttack();
    if (attack) {
      setShowAttack(true);
      setAttackQuote(getRandomVice());
    }
  }, []);

  useEffect(() => { loadIdentity(); }, [loadIdentity]);

  const scoreColor = score >= 70 ? 'good' : score >= 40 ? 'warning' : 'danger';
  const circumference = 2 * Math.PI * 68;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div className="identity-panel">
      <div className="section-header" style={{ padding: '0 0 20px' }}>
        <span className="section-title">IDENTITY ENGINE — EXECUTION VECTOR</span>
        <span className="section-count" style={{ color: drift > 0.15 ? 'var(--crimson)' : 'var(--green)' }}>
          DRIFT: {(drift * 100).toFixed(1)}%
        </span>
      </div>

      {/* Score Ring */}
      <div className="identity-score-ring">
        <svg viewBox="0 0 144 144">
          <circle className="ring-bg" cx="72" cy="72" r="68" />
          <circle
            className={`ring-fill ${scoreColor}`}
            cx="72" cy="72" r="68"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 72 72)"
          />
        </svg>
        <div className="identity-score-value">
          <div className="identity-score-number" style={{
            color: scoreColor === 'good' ? 'var(--green)' : scoreColor === 'warning' ? 'var(--amber)' : 'var(--crimson)'
          }}>
            {score.toFixed(0)}
          </div>
          <div className="identity-score-label">OVERALL SCORE</div>
        </div>
      </div>

      {/* Vector Grid */}
      <div className="identity-vector-grid">
        {vector.map((v, i) => (
          <div key={i} className="vector-item">
            <div className="vector-label">{VECTOR_LABELS[i]}</div>
            <div className="vector-value" style={{
              color: v >= 0.7 ? 'var(--green)' : v >= 0.4 ? 'var(--amber)' : 'var(--crimson)'
            }}>
              {(v * 100).toFixed(0)}
            </div>
          </div>
        ))}
      </div>

      {/* Identity Attack */}
      {showAttack && (
        <div className="identity-attack-card animate-slide-up">
          <div className="identity-attack-label">⚡ IDENTITY ATTACK — DRIFT EXCEEDED 15%</div>
          <div className="identity-attack-quote">&ldquo;{attackQuote}&rdquo;</div>
        </div>
      )}

      {/* Stats Summary */}
      <div style={{
        marginTop: '24px',
        padding: '16px',
        border: '1px solid var(--gray-200)',
        borderRadius: 'var(--radius)',
      }}>
        <div style={{
          fontSize: '9px',
          letterSpacing: '3px',
          textTransform: 'uppercase' as const,
          color: 'var(--gray-500)',
          marginBottom: '12px',
        }}>
          VECTOR BREAKDOWN
        </div>
        {VECTOR_LABELS.map((label, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '8px',
          }}>
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--gray-500)',
              width: '60px',
              letterSpacing: '1px',
            }}>
              {label}
            </span>
            <div style={{
              flex: 1,
              height: '4px',
              background: 'var(--gray-200)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${vector[i] * 100}%`,
                background: vector[i] >= 0.7 ? 'var(--green)' : vector[i] >= 0.4 ? 'var(--amber)' : 'var(--crimson)',
                borderRadius: '2px',
                transition: 'width 1s ease',
              }} />
            </div>
            <span style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: 'var(--white)',
              width: '32px',
              textAlign: 'right',
            }}>
              {(vector[i] * 100).toFixed(0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
