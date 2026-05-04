'use client';

import React, { useState } from 'react';
import type { Habit } from '@/lib/db';
import Executioner from './Executioner';
import ThinkingPartner from './ThinkingPartner';

interface HabitCardProps {
  habit: Habit;
  onComplete: (id: number) => void;
  onDelete: (id: number, clean?: boolean) => void;
  onEdit: (habit: Habit) => void;
  onUndo: (id: number) => void;
  onExplain: (habit: Habit) => void;
}

function getRiskLabel(score: number) {
  if (score > 0.75) return { text: `${(score * 100).toFixed(0)}%`, className: 'high' };
  if (score > 0.4) return { text: `${(score * 100).toFixed(0)}%`, className: 'medium' };
  return { text: `${(score * 100).toFixed(0)}%`, className: 'low' };
}

function formatRecurrence(habit: Habit): string {
  const r = habit.recurrence;
  if (!r) return '';
  switch (r.type) {
    case 'daily': return 'DAILY';
    case 'alternate': return 'ALT DAYS';
    case 'weekends': return 'WEEKENDS';
    case 'weekdays': return 'WEEKDAYS';
    case 'specific_days': return `DAYS: ${r.days?.join(',')}`;
    case 'nth_day': return `EVERY ${r.interval}D`;
    default: return '';
  }
}

export default function HabitCard({ habit, onComplete, onDelete, onEdit, onUndo, onExplain }: HabitCardProps) {
  const risk = getRiskLabel(habit.riskScore);
  const isCompleted = habit.lastCompleted
    ? new Date(habit.lastCompleted).toDateString() === new Date().toDateString()
    : false;
  const [showTP, setShowTP] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isPeeking, setIsPeeking] = useState(false);

  return (
    <>
      <div className={`item-card animate-slide-up ${habit.isBreached ? 'breached' : ''} ${isCompleted ? 'completed' : ''}`}>
        <div className={`item-priority p${habit.priority}`} />
        <div className="item-content">
          <div className="item-title">{habit.title}</div>
          <div className="item-meta">
            <span>{habit.targetTime}</span>
            <span>{formatRecurrence(habit)}</span>
            <span 
              className={`item-risk ${risk.className}`} 
              onClick={() => setExpanded(!expanded)}
              onMouseEnter={() => setIsPeeking(true)}
              onMouseLeave={() => setIsPeeking(false)}
              onMouseDown={() => setIsPeeking(true)}
              onMouseUp={() => setIsPeeking(false)}
              onTouchStart={() => setIsPeeking(true)}
              onTouchEnd={() => setIsPeeking(false)}
              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', position: 'relative' }}
            >
              RISK: {risk.text}
              {habit.riskExplanation && (
                <span style={{ fontSize: '8px', opacity: 0.7 }}>{expanded ? '▲' : '▼'}</span>
              )}

              {isPeeking && !isCompleted && (
                <div style={{
                  position: 'absolute', top: '100%', left: '0', zIndex: 100,
                  background: 'var(--black)', border: '1px solid var(--gray-300)',
                  padding: '12px', borderRadius: 'var(--radius)',
                  minWidth: '180px', marginTop: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
                  pointerEvents: 'none'
                }}>
                  <div style={{ fontSize: '8px', letterSpacing: '1px', color: 'var(--gray-500)', marginBottom: '8px', textTransform: 'uppercase' }}>Trajectory Metrics</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                      <span style={{ color: 'var(--gray-400)' }}>Trend (Momentum):</span>
                      <span style={{ color: habit.momentum && habit.momentum > 1 ? 'var(--crimson)' : 'var(--green)' }}>
                        {habit.momentum && habit.momentum > 1 ? 'Decaying' : 'Stable'} ({habit.momentum?.toFixed(1) || '1.0'}x)
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                      <span style={{ color: 'var(--gray-400)' }}>Pressure (Gravity):</span>
                      <span style={{ color: habit.gravity && habit.gravity > 0.5 ? 'var(--amber)' : 'var(--gray-500)' }}>
                        {habit.gravity?.toFixed(2) || '0.2'}x
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                      <span style={{ color: 'var(--gray-400)' }}>Armor (Streak):</span>
                      <span style={{ color: 'var(--green)' }}>
                        -{((1 - (habit.armor || 1)) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                      <span style={{ color: 'var(--gray-400)' }}>Avg Delay:</span>
                      <span style={{ color: 'var(--white)' }}>
                        {habit.avgJitter || 0}m
                      </span>
                    </div>
                  </div>
                  <div style={{ 
                    marginTop: '10px', pt: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', 
                    fontSize: '8px', color: 'var(--gray-500)', fontStyle: 'italic'
                  }}>
                    Formula: (Drift / 30) × Momentum × Gravity × Armor
                  </div>
                </div>
              )}
            </span>
          </div>
          {habit.riskScore > 0 && habit.riskExplanation && expanded && (
            <div className="risk-explanation animate-fade-in" style={{ cursor: 'pointer' }} onClick={() => setExpanded(false)}>
              {habit.riskExplanation}
            </div>
          )}
          {habit.tags.length > 0 && (
            <div className="item-tags" style={{ marginTop: '6px' }}>
              {habit.tags.map((tag, i) => (
                <span key={i} className="item-tag">#{tag}</span>
              ))}
            </div>
          )}
        </div>
        <div className="item-stats">
          <span className="item-streak" title="Streak">🔥 {habit.streakCount}</span>
          <span title="Resilience">{habit.resilienceValue}%</span>
        </div>

        {/* Actions */}
        {isCompleted ? (
          <button
            onClick={() => habit.id && onUndo(habit.id)}
            style={{
              fontSize: '9px', fontWeight: 700, color: 'var(--gray-400)',
              padding: '6px 12px', border: '1px solid var(--gray-300)',
              borderRadius: 'var(--radius)', background: 'transparent',
              cursor: 'pointer', marginRight: '8px'
            }}
          >
            UNDO
          </button>
        ) : (
          <button
            onClick={() => setShowActions(!showActions)}
            title="More actions"
            style={{
              color: 'var(--gray-400)', fontSize: '16px',
              padding: '8px', transition: 'var(--transition)',
              lineHeight: 1,
            }}
          >
            ⋮
          </button>
        )}

        <Executioner
          onComplete={() => habit.id && onComplete(habit.id)}
          completed={isCompleted}
        />
      </div>

      {/* Action menu */}
      {showActions && !isCompleted && (
        <div style={{
          display: 'flex', gap: '6px', padding: '4px 16px 8px',
          marginTop: '-6px', marginBottom: '2px',
        }}>
          <button
            onClick={() => { onExplain(habit); setShowActions(false); }}
            style={{
              fontSize: '9px', fontWeight: 700,
              letterSpacing: '1px', textTransform: 'uppercase',
              color: 'var(--crimson)', padding: '6px 12px',
              border: '1px solid var(--crimson)',
              borderRadius: 'var(--radius)',
              background: 'var(--crimson-glow)',
              cursor: 'pointer',
            }}
          >
            {habit.riskExplanation ? 'REFRESH RISK' : 'EXPLAIN RISK'}
          </button>
          <button
            onClick={() => { setShowTP(true); setShowActions(false); }}
            style={{
              fontSize: '9px', fontWeight: 700,
              letterSpacing: '1px', textTransform: 'uppercase',
              color: 'var(--crimson)', padding: '6px 12px',
              border: '1px solid var(--crimson)',
              borderRadius: 'var(--radius)',
              background: 'var(--crimson-glow)',
              cursor: 'pointer',
            }}
          >
            CONFRONT
          </button>
          <button
            onClick={() => { onEdit(habit); setShowActions(false); }}
            style={{
              fontSize: '9px', fontWeight: 700,
              letterSpacing: '1px', textTransform: 'uppercase',
              color: 'var(--amber)', padding: '6px 12px',
              border: '1px solid var(--amber)',
              borderRadius: 'var(--radius)',
              background: 'rgba(255, 191, 0, 0.05)',
              cursor: 'pointer',
            }}
          >
            EDIT
          </button>
          <button
            onClick={() => { if (habit.id) onDelete(habit.id); setShowActions(false); }}
            title="Deletes habit and all its history (May impact metrics)"
            style={{
              fontSize: '9px', fontWeight: 700,
              letterSpacing: '1px', textTransform: 'uppercase',
              color: 'var(--gray-500)', padding: '6px 12px',
              border: '1px solid var(--gray-300)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
            }}
          >
            DELETE
          </button>
          <button
            onClick={() => {
              if (habit.id) {
                // We'll add an onArchive prop to HomePage
                onDelete(habit.id, true); // True for "Clean/Archive"
              }
              setShowActions(false);
            }}
            title="Removes habit but keeps history (Safe for metrics)"
            style={{
              fontSize: '9px', fontWeight: 700,
              letterSpacing: '1px', textTransform: 'uppercase',
              color: 'var(--gray-400)', padding: '6px 12px',
              border: '1px solid var(--gray-200)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
            }}
          >
            ARCHIVE
          </button>
        </div>
      )}

      {/* Thinking Partner */}
      {showTP && (
        <ThinkingPartner
          habit={habit}
          onClose={() => setShowTP(false)}
          onResolved={() => {
            setShowTP(false);
            if (habit.id) onComplete(habit.id);
          }}
        />
      )}
    </>
  );
}
