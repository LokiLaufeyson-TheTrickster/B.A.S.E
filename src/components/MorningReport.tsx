'use client';

import React from 'react';
import type { Habit, Task } from '@/lib/db';
import Executioner from './Executioner';

interface MorningReportProps {
  habits: Habit[];
  tasks: Task[];
  onDismiss: () => void;
  onCompleteHabit: (id: number) => void;
  onCompleteTask: (id: number) => void;
  manual?: boolean;
}

export default function MorningReport({
  habits,
  tasks,
  onDismiss,
  onCompleteHabit,
  onCompleteTask,
  manual = false
}: MorningReportProps) {
  const totalRisky = habits.length + tasks.length;
  if (totalRisky === 0 && !manual) return null;

  return (
    <div className="breach-overlay morning-report">
      {totalRisky > 0 ? (
        <>
          <div className="breach-title" style={{ color: 'var(--amber)' }}>MORNING RECON</div>
          <div className="breach-subtitle">
            {totalRisky} RISKY VECTORS DETECTED FOR {new Date().toLocaleDateString()}
          </div>
        </>
      ) : (
        <>
          <div className="breach-title" style={{ color: 'var(--green)' }}>SYSTEM SECURE</div>
          <div className="breach-subtitle">
            ALL PERFORMANCE VECTORS WITHIN SAFE PARAMETERS
          </div>
        </>
      )}

      <div className="breach-habit-list">
        {/* Habits */}
        {habits.length > 0 && (
          <div className="recon-section">
            <div className="recon-section-title">HABIT BREACHES</div>
            {habits.map(habit => (
              <div key={`h-${habit.id}`} className="item-card breached animate-slide-up">
                <div className={`item-priority p${habit.priority}`} />
                <div className="item-content">
                  <div className="item-title">{habit.title}</div>
                  <div className="recon-explanation">
                    {habit.riskExplanation || "High variance in execution timestamps."}
                  </div>
                  <div className="item-meta">
                    <span>Due: {habit.targetTime}</span>
                    <span className="item-risk high">RISK: {(habit.riskScore * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <Executioner onComplete={() => habit.id && onCompleteHabit(habit.id)} completed={false} />
              </div>
            ))}
          </div>
        )}

        {/* Tasks */}
        {tasks.length > 0 && (
          <div className="recon-section" style={{ marginTop: '24px' }}>
            <div className="recon-section-title">RISKY TASKS</div>
            {tasks.map(task => (
              <div key={`t-${task.id}`} className="item-card task-risky animate-slide-up">
                <div className={`item-priority p${task.priority}`} />
                <div className="item-content">
                  <div className="item-title">{task.title}</div>
                  <div className="recon-explanation">
                    {task.riskExplanation || "Deadline pressure detected."}
                  </div>
                  <div className="item-meta">
                    <span>{task.dueDate ? new Date(task.dueDate).toLocaleString() : 'No Deadline'}</span>
                    <span className="item-risk high">RISK: {(task.riskScore * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <button 
                  onClick={() => task.id && onCompleteTask(task.id)}
                  className="recon-complete-btn"
                >
                  RESOLVE
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={onDismiss} className="recon-dismiss-btn">
        ACKNOWLEDGE & PROCEED
      </button>

      <style jsx>{`
        .morning-report {
          background: rgba(0, 0, 0, 0.98);
          z-index: 1000;
        }
        .recon-section {
          width: 100%;
          max-width: 600px;
        }
        .recon-section-title {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 2px;
          color: var(--gray-500);
          margin-bottom: 12px;
          text-transform: uppercase;
          border-left: 2px solid var(--amber);
          padding-left: 8px;
        }
        .recon-explanation {
          font-size: 11px;
          color: var(--gray-400);
          margin: 4px 0 8px 0;
          line-height: 1.4;
          font-style: italic;
          border-left: 1px solid var(--gray-300);
          padding-left: 8px;
        }
        .recon-dismiss-btn {
          margin-top: 40px;
          padding: 12px 32px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 2px;
          color: var(--white);
          background: transparent;
          border: 1px solid var(--gray-400);
          border-radius: var(--radius);
          cursor: pointer;
          transition: var(--transition);
        }
        .recon-dismiss-btn:hover {
          border-color: var(--white);
          background: rgba(255,255,255,0.05);
        }
        .recon-complete-btn {
          padding: 6px 12px;
          font-size: 9px;
          font-weight: 800;
          background: transparent;
          border: 1px solid var(--gray-400);
          color: var(--gray-400);
          border-radius: var(--radius);
          cursor: pointer;
        }
        .recon-complete-btn:hover {
          border-color: var(--green);
          color: var(--green);
        }
      `}</style>
    </div>
  );
}
