'use client';

import React, { useState, useRef } from 'react';
import { parseSentryInput } from '@/lib/sentry';
import { db } from '@/lib/db';

interface SentryInputProps {
  onItemAdded: () => void;
}

export default function SentryInput({ onItemAdded }: SentryInputProps) {
  const [value, setValue] = useState('');
  const [feedback, setFeedback] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;

    try {
      const result = parseSentryInput(value);

      if (result.type === 'habit') {
        await db.habits.add(result.data as any);
        setFeedback(`HABIT LOCKED: "${result.data.title}"`);
      } else {
        await db.tasks.add(result.data as any);
        setFeedback(`TASK LOCKED: "${result.data.title}"`);
      }

      setValue('');
      onItemAdded();

      setTimeout(() => setFeedback(''), 3000);
    } catch (err) {
      setFeedback('PARSE ERROR: Invalid input');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  return (
    <div className="sentry-container">
      <form onSubmit={handleSubmit}>
        <div className="sentry-input-wrapper">
          <span className="sentry-prefix">SENTRY &gt;</span>
          <input
            ref={inputRef}
            className="sentry-input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder='e.g. "Cold shower everyday 5:30am #p1 #discipline"'
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </form>
      {feedback ? (
        <div className="sentry-hint animate-fade-in" style={{ color: feedback.includes('ERROR') ? 'var(--crimson)' : 'var(--green)' }}>
          {feedback}
        </div>
      ) : (
        <div className="sentry-hint">
          NLP PARSER ACTIVE — Supports: everyday, alternate, weekends, weekdays, every Nth • Priority: #p1-#p4 • Tags: #tag
        </div>
      )}
    </div>
  );
}
