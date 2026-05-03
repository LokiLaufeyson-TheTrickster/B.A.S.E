'use client';

import React from 'react';
import { db, type Task, type Habit } from '@/lib/db';
import Executioner from './Executioner';
import ThinkingPartner from './ThinkingPartner';

interface TaskCardProps {
  task: Task;
  onComplete: (id: number) => void;
  onFail: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (task: Task) => void;
  onUndo: (id: number) => void;
  onExplain: (task: Task) => void;
}

export default function TaskCard({ task, onComplete, onFail, onDelete, onEdit, onUndo, onExplain }: TaskCardProps) {
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

  const [showTP, setShowTP] = React.useState(false);
  const [showActions, setShowActions] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

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
          {(task.riskScore > 0 || task.lastRiskAudit) && !isCompleted && !isFailed && (
            <span 
              className={`item-risk ${task.riskScore > 0.6 ? 'high' : 'medium'}`}
              onClick={() => setExpanded(!expanded)}
              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              RISK: {(task.riskScore * 100).toFixed(0)}%
              {task.riskExplanation && (
                <span style={{ fontSize: '8px', opacity: 0.7 }}>{expanded ? '▲' : '▼'}</span>
              )}
            </span>
          )}
        </div>
        {task.riskScore > 0 && task.riskExplanation && expanded && !isCompleted && !isFailed && (
          <div className="risk-explanation animate-fade-in" style={{ cursor: 'pointer' }} onClick={() => setExpanded(false)}>
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
      {isCompleted || isFailed ? (
        <button
          onClick={() => task.id && onUndo(task.id)}
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

      {/* Action Menu Popover */}
      {showActions && !isCompleted && !isFailed && (
        <div className="item-action-menu animate-slide-up" style={{
          position: 'absolute', bottom: '100%', right: '0',
          background: 'var(--gray-100)', border: '1px solid var(--gray-300)',
          borderRadius: 'var(--radius)', padding: '8px',
          display: 'flex', flexDirection: 'column', gap: '4px',
          zIndex: 10, boxShadow: 'var(--shadow-lg)',
          minWidth: '120px',
          marginTop: '-6px', marginBottom: '2px',
        }}>
          <button
            onClick={() => { onExplain(task); setShowActions(false); }}
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
            {task.riskExplanation ? 'REFRESH RISK' : 'EXPLAIN RISK'}
          </button>
          <button
            onClick={() => { onEdit(task); setShowActions(false); }}
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
            onClick={() => { task.id && onFail(task.id); setShowActions(false); }}
            style={{
              fontSize: '9px', fontWeight: 700,
              letterSpacing: '1px', textTransform: 'uppercase',
              color: 'var(--gray-500)', padding: '6px 12px',
              border: '1px solid var(--gray-300)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
            }}
          >
            FAIL
          </button>
          <button
            onClick={() => {
              if (task.id) {
                onDelete && onDelete(task.id);
              }
              setShowActions(false);
            }}
            style={{
              fontSize: '9px', fontWeight: 700,
              letterSpacing: '1px', textTransform: 'uppercase',
              color: 'var(--gray-400)', padding: '6px 12px',
              border: '1px solid var(--gray-200)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
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

      {/* Thinking Partner for Task Risk */}
      {showTP && (
        <ThinkingPartner
          habit={task as any} // Cast to any because ThinkingPartner expects Habit but handles Task context
          onClose={() => setShowTP(false)}
          onResolved={() => {
            setShowTP(false);
          }}
        />
      )}
    </div>
  );
}
