'use client';

import React, { useState } from 'react';
import type { Habit, Task } from '@/lib/db';

interface EditModalProps {
  item: Habit | Task;
  type: 'habit' | 'task';
  onSave: (updated: any) => void;
  onClose: () => void;
}

export default function EditModal({ item, type, onSave, onClose }: EditModalProps) {
  const [title, setTitle] = useState(item.title);
  const [timing, setTiming] = useState(
    type === 'habit' 
      ? (item as Habit).targetTime 
      : (item as Task).dueDate ? new Date((item as Task).dueDate!).toISOString().slice(0, 16) : ''
  );

  const handleSave = () => {
    if (type === 'habit') {
      onSave({ ...item, title, targetTime: timing });
    } else {
      onSave({ ...item, title, dueDate: timing ? new Date(timing).getTime() : null });
    }
    onClose();
  };

  return (
    <div className="tp-overlay" style={{ zIndex: 1100 }}>
      <div className="tp-container animate-slide-up" style={{ maxWidth: '400px' }}>
        <div className="tp-header">
          <span className="tp-header-title">EDIT {type.toUpperCase()}</span>
          <button onClick={onClose} style={{ color: 'var(--gray-500)' }}>✕</button>
        </div>
        
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '10px', color: 'var(--gray-500)', marginBottom: '8px' }}>TITLE</label>
            <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)}
              className="sentry-input"
              style={{ width: '100%', background: 'var(--gray-100)', border: '1px solid var(--gray-300)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10px', color: 'var(--gray-500)', marginBottom: '8px' }}>
              {type === 'habit' ? 'TARGET TIME (HH:MM)' : 'DUE DATE & TIME'}
            </label>
            <input 
              type={type === 'habit' ? 'text' : 'datetime-local'} 
              value={timing} 
              onChange={e => setTiming(e.target.value)}
              className="sentry-input"
              placeholder={type === 'habit' ? '08:00' : ''}
              style={{ width: '100%', background: 'var(--gray-100)', border: '1px solid var(--gray-300)' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <button onClick={handleSave} className="tp-input-btn" style={{ flex: 1, background: 'var(--amber)', color: 'var(--black)' }}>
              SAVE CHANGES
            </button>
            <button onClick={onClose} className="tp-input-btn" style={{ flex: 1, border: '1px solid var(--gray-400)', color: 'var(--gray-400)' }}>
              CANCEL
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
