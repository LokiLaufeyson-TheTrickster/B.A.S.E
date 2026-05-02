'use client';

import React, { useState } from 'react';
import type { Habit } from '@/lib/db';
import Executioner from './Executioner';
import ThinkingPartner from './ThinkingPartner';

interface BreachOverlayProps {
  habits: Habit[];
  onComplete: (id: number) => void;
  onDismiss: () => void;
}

export default function BreachOverlay({ habits, onComplete, onDismiss }: BreachOverlayProps) {
  const [tpHabit, setTpHabit] = useState<Habit | null>(null);
  const [localCompleted, setLocalCompleted] = useState<Set<number>>(new Set());

  if (habits.length === 0) return null;

  const handleComplete = (id: number) => {
    onComplete(id);
    const updated = new Set(localCompleted);
    updated.add(id);
    setLocalCompleted(updated);

    // If all breached habits are now completed, dismiss
    const allDone = habits.every(h => updated.has(h.id!) ||
      (h.lastCompleted && new Date(h.lastCompleted).toDateString() === new Date().toDateString())
    );
    if (allDone) {
      setTimeout(onDismiss, 500);
    }
  };

  return (
    <>
      <div className="breach-overlay">
        <div className="breach-title">BREACH</div>
        <div className="breach-subtitle">
          {habits.length} HABIT{habits.length > 1 ? 'S' : ''} IN CRITICAL STATE — RESOLVE TO PROCEED
        </div>

        <div className="breach-habit-list">
          {habits.map((habit) => {
            const isCompleted = localCompleted.has(habit.id!) || (
              habit.lastCompleted
                ? new Date(habit.lastCompleted).toDateString() === new Date().toDateString()
                : false
            );

            return (
              <div key={habit.id} className={`item-card ${isCompleted ? 'completed' : 'breached'} animate-slide-up`}>
                <div className={`item-priority p${habit.priority}`} />
                <div className="item-content">
                  <div className="item-title">{habit.title}</div>
                  <div className="item-meta">
                    <span>{habit.targetTime}</span>
                    <span className={`item-risk ${isCompleted ? 'low' : 'high'}`}>
                      {isCompleted ? 'DONE' : `RISK: ${(habit.riskScore * 100).toFixed(0)}%`}
                    </span>
                  </div>
                </div>
                {!isCompleted && (
                  <button
                    onClick={() => setTpHabit(habit)}
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                      color: 'var(--crimson)',
                      padding: '8px 12px',
                      border: '1px solid var(--crimson)',
                      borderRadius: 'var(--radius)',
                      marginRight: '8px',
                    }}
                  >
                    CONFRONT
                  </button>
                )}
                <Executioner
                  onComplete={() => habit.id && handleComplete(habit.id)}
                  completed={isCompleted}
                />
              </div>
            );
          })}
        </div>

        {/* Dismiss button — always available as escape hatch */}
        <button
          onClick={onDismiss}
          style={{
            marginTop: '32px',
            padding: '10px 24px',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: 'var(--gray-500)',
            border: '1px solid var(--gray-300)',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            transition: 'var(--transition)',
          }}
        >
          DISMISS — ACKNOWLEDGE BREACH
        </button>

        <div style={{
          marginTop: '12px',
          fontSize: '9px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--gray-400)',
          letterSpacing: '0.5px',
          textAlign: 'center',
        }}>
          Hold ○ for 1.5s to mark complete • CONFRONT to open Thinking Partner
        </div>
      </div>

      {tpHabit && (
        <ThinkingPartner
          habit={tpHabit}
          onClose={() => setTpHabit(null)}
          onResolved={() => {
            setTpHabit(null);
            handleComplete(tpHabit.id!);
          }}
        />
      )}
    </>
  );
}
