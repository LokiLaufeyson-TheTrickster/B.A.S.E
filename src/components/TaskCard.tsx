'use client';

import React from 'react';
import type { Task } from '@/lib/db';
import Executioner from './Executioner';

interface TaskCardProps {
  task: Task;
  onComplete: (id: number) => void;
  onFail: (id: number) => void;
  onDelete: (id: number) => void;
}

export default function TaskCard({ task, onComplete, onFail, onDelete }: TaskCardProps) {
  const isCompleted = task.status === 'completed';
  const isFailed = task.status === 'failed';
  const date = task.dueDate ? new Date(task.dueDate) : null;
  // User-specified time is anything that's not midnight (default) or 23:59:59 (our date-only marker)
  const hasTime = date && 
    (date.getHours() !== 0 || date.getMinutes() !== 0) && 
    !(date.getHours() === 23 && date.getMinutes() === 59);

  const dueStr = date
    ? date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(hasTime ? { hour: 'numeric', minute: '2-digit' } : {})
      })
    : 'NO DEADLINE';

  const isOverdue = (() => {
    if (!task.dueDate || isCompleted || isFailed) return false;
    const now = Date.now();
    const d = new Date(task.dueDate);
    // If it's exactly midnight, assume the user meant "by the end of the day"
    if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0) {
      d.setHours(23, 59, 59, 999);
    }
    return d.getTime() < now;
  })();

  return (
    <div className={`item-card animate-slide-up ${isCompleted ? 'completed' : ''} ${isFailed ? 'completed' : ''} ${isOverdue ? 'breached' : ''}`}>
      <div className={`item-priority p${task.priority}`} />
      <div className="item-content">
        <div className="item-title" style={isFailed ? { textDecoration: 'line-through', color: 'var(--gray-500)' } : undefined}>
          {task.title}
        </div>
        <div className="item-meta">
          <span style={{ color: isOverdue ? 'var(--crimson)' : isFailed ? 'var(--gray-500)' : undefined }}>
            {isFailed ? 'FAILED' : isOverdue ? 'OVERDUE: ' : ''}{!isFailed && dueStr}
          </span>
          <span>P{task.priority}</span>
          {task.riskScore > 0.6 && !isCompleted && !isFailed && (
            <span className="item-risk high">RISK: {(task.riskScore * 100).toFixed(0)}%</span>
          )}
        </div>
        {task.riskScore > 0.6 && task.riskExplanation && !isCompleted && !isFailed && (
          <div className="risk-explanation animate-fade-in">
            {task.riskExplanation}
          </div>
        )}
        {task.tags.length > 0 && (
          <div className="item-tags" style={{ marginTop: '6px' }}>
            {task.tags.map((tag, i) => (
              <span key={i} className="item-tag">#{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {!isCompleted && !isFailed && (
        <div style={{ display: 'flex', gap: '6px', marginRight: '8px' }}>
          <button
            onClick={() => task.id && onFail(task.id)}
            title="Mark as failed"
            style={{
              fontSize: '9px', fontWeight: 700,
              letterSpacing: '1px', textTransform: 'uppercase',
              color: 'var(--gray-500)', padding: '6px 10px',
              border: '1px solid var(--gray-300)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              transition: 'var(--transition)',
            }}
          >
            FAIL
          </button>
          <button
            onClick={() => {
              if (task.id) {
                // Pass a specific flag or use a different handler
                // For now, let's assume we add an onDelete prop
                onDelete && onDelete(task.id);
              }
            }}
            title="Delete task (No impact)"
            style={{
              fontSize: '9px', fontWeight: 700,
              letterSpacing: '1px', textTransform: 'uppercase',
              color: 'var(--gray-400)', padding: '6px 10px',
              border: '1px solid var(--gray-200)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              transition: 'var(--transition)',
            }}
          >
            CANCEL
          </button>
        </div>
      )}

      <Executioner
        onComplete={() => task.id && onComplete(task.id)}
        completed={isCompleted || isFailed}
      />
    </div>
  );
}
