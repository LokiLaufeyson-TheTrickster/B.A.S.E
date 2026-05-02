'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { Habit } from '@/lib/db';
import { getRandomVice } from '@/lib/vice50';
import { queryThinkingPartner, hasAnyProvider } from '@/lib/gemini';

interface ThinkingPartnerProps {
  habit: Habit;
  onClose: () => void;
  onResolved: () => void;
}

interface Message {
  role: 'system' | 'user';
  content: string;
  provider?: string;
}

function getOpeningMessage(h: Habit): string {
  const risk = (h.riskScore * 100).toFixed(0);
  const res = h.resilienceValue;
  const streak = h.streakCount;
  const t = h.title;
  const time = h.targetTime;

  const openers = [
    `"${t}" — risk at ${risk}%, resilience at ${res}%. You keep opening this like staring at a wound will heal it. What's your excuse this time?`,
    `${risk}% risk. ${res}% resilience. ${streak}-day streak on "${t}". Those are your numbers. They're pathetic. Why are you here instead of executing?`,
    `You've opened the confrontation panel for "${t}." That means you already know you're failing. The data confirms it — ${risk}% risk. So what happened?`,
    `Every time you skip "${t}", your risk climbs. It's at ${risk}% now. Your resilience is ${res}%. At this rate, you'll be a case study in self-sabotage. Explain yourself.`,
    `"${t}" was supposed to happen at ${time}. It didn't. Risk: ${risk}%. Streak: ${streak}. I'm not interested in your feelings. What specifically prevented execution?`,
    `Let's be direct. "${t}" is ${risk}% risk and climbing. You've managed a ${streak}-day streak — ${streak > 3 ? "barely functional" : "laughable"}. What's the excuse?`,
    `Your resilience on "${t}" is ${res}%. ${res >= 80 ? "You haven't even been tested and you're already folding" : res >= 50 ? "The cracks are showing and you're pretending they're not" : "You've collapsed. This is wreckage"}. Why should I believe anything you say next?`,
    `Risk: ${risk}%. Time: ${time}. Habit: "${t}". Status: NOT DONE. I have the data. You have excuses. Give me one — I'll tear it apart.`,
    `"${t}" — another day, another failure to launch. ${risk}% risk, ${res}% resilience. You're not busy. You're avoidant. Prove me wrong.`,
    `${streak} days. That's your streak on "${t}". Risk is ${risk}%. You opened this panel voluntarily, which means guilt is doing my job for me. But guilt doesn't execute. What will you actually DO?`,
  ];

  return openers[Math.floor(Math.random() * openers.length)];
}

function formatProvider(p: string): string {
  if (p === 'gemini') return 'GEMINI';
  if (p === 'fallback') return 'OFFLINE';
  if (p.startsWith('or:')) return p.replace('or:', '').split('/').pop()?.toUpperCase() || 'OR';
  return p.toUpperCase();
}

export default function ThinkingPartner({ habit, onClose, onResolved }: ThinkingPartnerProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', content: getOpeningMessage(habit), provider: 'local' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [viceQuote] = useState(() => getRandomVice());
  const [lastProvider, setLastProvider] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const result = await queryThinkingPartner({
        habitTitle: habit.title,
        riskScore: habit.riskScore,
        resilienceValue: habit.resilienceValue,
        streakCount: habit.streakCount,
        targetTime: habit.targetTime,
        conversationHistory: newMessages,
      });

      setLastProvider(result.provider);
      const isResolved = result.text.includes('[RESOLVED]');
      const cleanResponse = result.text.replace('[RESOLVED]', '').trim();

      setMessages([...newMessages, {
        role: 'system',
        content: cleanResponse,
        provider: result.provider,
      }]);

      if (isResolved) {
        setTimeout(onResolved, 3000);
      }
    } catch {
      setMessages([
        ...newMessages,
        { role: 'system', content: 'I asked you a question. Answer it. When will you execute?', provider: 'fallback' },
      ]);
      setLastProvider('fallback');
    } finally {
      setLoading(false);
    }
  };

  const headerStatus = hasAnyProvider() ? 'AI-POWERED' : 'FALLBACK MODE';

  return (
    <div className="tp-overlay">
      <div className="tp-container animate-slide-up">
        <div className="tp-header">
          <span className="tp-header-title">⚠ THINKING PARTNER — HOSTILE AUDITOR</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              fontSize: '8px', fontFamily: 'var(--font-mono)',
              letterSpacing: '1px', textTransform: 'uppercase',
              color: hasAnyProvider() ? 'var(--green)' : 'var(--amber)',
            }}>
              {headerStatus}
            </span>
            <button onClick={onClose} style={{ color: 'var(--gray-500)', fontSize: '16px' }}>✕</button>
          </div>
        </div>

        <div className="tp-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`tp-msg ${msg.role} animate-fade-in`}>
              {msg.content}
              {msg.role === 'system' && msg.provider && msg.provider !== 'local' && (
                <span style={{
                  display: 'block', marginTop: '6px',
                  fontSize: '8px', fontFamily: 'var(--font-mono)',
                  letterSpacing: '1px', textTransform: 'uppercase',
                  color: msg.provider === 'fallback' ? 'var(--amber)' : 'var(--gray-500)',
                  opacity: 0.7,
                }}>
                  via {formatProvider(msg.provider)}
                  {msg.provider === 'fallback' && ' — ALL APIs RATE-LIMITED'}
                </span>
              )}
            </div>
          ))}
          {loading && (
            <div className="tp-msg system animate-fade-in" style={{ color: 'var(--gray-500)' }}>
              Querying {hasAnyProvider() ? 'AI providers' : 'fallback logic'}...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="tp-input-area">
          <input
            className="tp-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Respond..."
            disabled={loading}
            autoFocus
          />
          <button className="tp-send" onClick={handleSend} disabled={loading}>
            {loading ? '...' : 'SUBMIT'}
          </button>
        </div>

        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--gray-200)',
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--gray-400)',
          fontStyle: 'italic',
          lineHeight: '1.6',
        }}>
          {viceQuote}
        </div>
      </div>
    </div>
  );
}
