'use client';

import React, { useState, useRef, useMemo } from 'react';
import { parseSentryInput, extractSentryParts, type SentryPart } from '@/lib/sentry';
import { db } from '@/lib/db';

interface SentryInputProps {
  onItemAdded: () => void;
}

export default function SentryInput({ onItemAdded }: SentryInputProps) {
  const [value, setValue] = useState('');
  const [feedback, setFeedback] = useState('');
  const [ignoredParts, setIgnoredParts] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const parts = useMemo(() => extractSentryParts(value), [value]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;

    try {
      const result = parseSentryInput(value, ignoredParts);

      if (result.type === 'habit') {
        await db.habits.add(result.data as any);
        setFeedback(`HABIT LOCKED: "${result.data.title}"`);
      } else {
        await db.tasks.add(result.data as any);
        setFeedback(`TASK LOCKED: "${result.data.title}"`);
      }

      setValue('');
      setIgnoredParts([]);
      onItemAdded();

      setTimeout(() => setFeedback(''), 3000);
    } catch (err) {
      setFeedback('PARSE ERROR: Invalid input');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  const togglePart = (id: string) => {
    setIgnoredParts(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
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
            onChange={(e) => {
              setValue(e.target.value);
              // Clean up ignored parts that are no longer present
              const currentParts = extractSentryParts(e.target.value);
              setIgnoredParts(prev => prev.filter(pId => currentParts.some(p => p.id === pId)));
            }}
            placeholder='e.g. "Cold shower everyday 5:30am #p1 #discipline"'
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </form>

      {/* NLP Chips */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
        {parts.map(part => (
          <div
            key={part.id}
            onClick={() => togglePart(part.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '4px 10px', fontSize: '9px', fontWeight: 700,
              fontFamily: 'var(--font-mono)', letterSpacing: '1px',
              textTransform: 'uppercase', borderRadius: 'var(--radius)',
              cursor: 'pointer', transition: 'var(--transition)',
              border: `1px solid ${ignoredParts.includes(part.id) ? 'var(--gray-300)' : 'var(--crimson)'}`,
              background: ignoredParts.includes(part.id) ? 'transparent' : 'var(--crimson-glow)',
              color: ignoredParts.includes(part.id) ? 'var(--gray-500)' : 'var(--crimson)',
              textDecoration: ignoredParts.includes(part.id) ? 'line-through' : 'none',
              opacity: ignoredParts.includes(part.id) ? 0.5 : 1,
            }}
          >
            <span>{part.type}: {part.text}</span>
            <span style={{ fontSize: '10px', opacity: 0.7 }}>✕</span>
          </div>
        ))}
      </div>

      {feedback ? (
        <div className="sentry-hint animate-fade-in" style={{ color: feedback.includes('ERROR') ? 'var(--crimson)' : 'var(--green)', marginTop: '8px' }}>
          {feedback}
        </div>
      ) : (
        <div className="sentry-hint" style={{ marginTop: '8px' }}>
          NLP PARSER ACTIVE — Supports: everyday, alternate, weekends, weekdays, every Nth • Priority: #p1-#p4 • Tags: #tag
        </div>
      )}
    </div>
  );
}
