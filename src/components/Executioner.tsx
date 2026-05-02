'use client';

import React, { useState, useRef, useCallback } from 'react';

interface ExecutionerProps {
  onComplete: () => void;
  completed: boolean;
  disabled?: boolean;
}

export default function Executioner({ onComplete, completed, disabled }: ExecutionerProps) {
  const [filling, setFilling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const HOLD_DURATION = 1500;

  const handlePointerDown = useCallback(() => {
    if (completed || disabled) return;
    setFilling(true);
    timerRef.current = setTimeout(() => {
      setFilling(false);
      onComplete();
    }, HOLD_DURATION);
  }, [completed, disabled, onComplete]);

  const handlePointerUp = useCallback(() => {
    setFilling(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return (
    <button
      className={`executioner-btn ${filling ? 'filling' : ''} ${completed ? 'done' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      disabled={disabled}
      title={completed ? 'Completed' : 'Hold 1.5s to complete'}
      aria-label={completed ? 'Task completed' : 'Hold to complete task'}
    >
      <div className="fill-ring" />
      <span className="check-icon">{completed ? '✓' : '○'}</span>
    </button>
  );
}
