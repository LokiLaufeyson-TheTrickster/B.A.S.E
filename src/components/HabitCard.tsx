'use client';

import React, { useState } from 'react';
import type { Habit } from '@/lib/db';
import Executioner from './Executioner';
import ThinkingPartner from './ThinkingPartner';

interface HabitCardProps {
  habit: Habit;
  onComplete: (id: number) => void;
  onDelete: (id: number, clean?: boolean) => void;
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

export default function HabitCard({ habit, onComplete, onDelete }: HabitCardProps) {
  const risk = getRiskLabel(habit.riskScore);
  const isCompleted = habit.lastCompleted
    ? new Date(habit.lastCompleted).toDateString() === new Date().toDateString()
    : false;
  const [showTP, setShowTP] = useState(false);
  const [showActions, setShowActions] = useState(false);

  return (
    <>
      <div className={`item-card animate-slide-up ${habit.isBreached ? 'breached' : ''} ${isCompleted ? 'completed' : ''}`}>
        <div className={`item-priority p${habit.priority}`} />
        <div className="item-content">
          <div className="item-title">{habit.title}</div>
          <div className="item-meta">
            <span>{habit.targetTime}</span>
            <span>{formatRecurrence(habit)}</span>
            <span className={`item-risk ${risk.className}`}>RISK: {risk.text}</span>
          </div>
          {habit.isBreached && habit.riskExplanation && (
            <div className="risk-explanation animate-fade-in">
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
        {!isCompleted && (
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
