'use client';

import React from 'react';
import type { Task } from '@/lib/db';
import Executioner from './Executioner';

interface TaskCardProps {
  task: Task;
  onComplete: (id: number) => void;
  onFail: (id: number) => void;
}

export default function TaskCard({ task, onComplete, onFail }: TaskCardProps) {
  const isCompleted = task.status === 'completed';
  const isFailed = task.status === 'failed';
  const dueStr = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'NO DEADLINE';

  const isOverdue = task.dueDate && task.dueDate < Date.now() && !isCompleted && !isFailed;

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
        </div>
        {task.tags.length > 0 && (
          <div className="item-tags" style={{ marginTop: '6px' }}>
            {task.tags.map((tag, i) => (
              <span key={i} className="item-tag">#{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Fail button */}
      {!isCompleted && !isFailed && (
        <button
          onClick={() => task.id && onFail(task.id)}
          title="Mark as failed / can't do"
          style={{
            fontSize: '9px', fontWeight: 700,
            letterSpacing: '1px', textTransform: 'uppercase',
            color: 'var(--gray-500)', padding: '6px 10px',
            border: '1px solid var(--gray-300)',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            transition: 'var(--transition)',
            marginRight: '8px',
          }}
        >
          FAIL
        </button>
      )}

      <Executioner
        onComplete={() => task.id && onComplete(task.id)}
        completed={isCompleted || isFailed}
      />
    </div>
  );
}
