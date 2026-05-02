'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db, type Habit, type Task } from '@/lib/db';
import { logHabitCompletion, runMorningRecon } from '@/lib/riskEngine';
import { hasAnyProvider } from '@/lib/gemini';
import SentryInput from '@/components/SentryInput';
import HabitCard from '@/components/HabitCard';
import TaskCard from '@/components/TaskCard';
import DojoPanel from '@/components/DojoPanel';
import IdentityPanel from '@/components/IdentityPanel';
import BreachOverlay from '@/components/BreachOverlay';
import SettingsModal from '@/components/SettingsModal';
import Marquee from '@/components/Marquee';

type TabType = 'habits' | 'tasks' | 'dojo' | 'identity';

export default function HomePage() {
  console.log('B.A.S.E. v1.1 — Metrics & Tutorial Active');
  const [activeTab, setActiveTab] = useState<TabType>('habits');
  const [habits, setHabits] = useState<Habit[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [breachedHabits, setBreachedHabits] = useState<Habit[]>([]);
  const [showBreach, setShowBreach] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [aiActive, setAiActive] = useState(false);

  // ── Filter State ─────────────────────────────────────────────────────────────
  const [filterPriority, setFilterPriority] = useState<number | null>(null);
  const [filterTags, setFilterTags] = useState<string[]>([]);

  // ── Data Loading ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const h = await db.habits.orderBy('priority').toArray();
    const pendingTasks = await db.tasks.where('status').equals('pending').toArray();
    setHabits(h);
    setTasks(pendingTasks);

    const breached = h.filter(habit => habit.isBreached);
    setBreachedHabits(breached);

    if (breached.length > 0) {
      setShowBreach(true);
      setIsLocked(true);
    } else {
      setShowBreach(false);
      setIsLocked(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    runMorningRecon().then(() => loadData());
    setAiActive(hasAnyProvider());
  }, [loadData]);

  // ── All unique tags ──────────────────────────────────────────────────────────
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    habits.forEach(h => h.tags.forEach(t => tagSet.add(t)));
    tasks.forEach(t => t.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [habits, tasks]);

  // ── Filtered Data ────────────────────────────────────────────────────────────
  const filteredHabits = useMemo(() => {
    let result = [...habits];
    if (filterPriority !== null) {
      result = result.filter(h => h.priority === filterPriority);
    }
    if (filterTags.length > 0) {
      result = result.filter(h => filterTags.some(ft => h.tags.includes(ft)));
    }
    
    // Sort: targetTime (ASC), then priority (ASC)
    result.sort((a, b) => {
      if (a.targetTime !== b.targetTime) {
        return a.targetTime.localeCompare(b.targetTime);
      }
      return a.priority - b.priority;
    });

    return result;
  }, [habits, filterPriority, filterTags]);

  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    if (filterPriority !== null) {
      result = result.filter(t => t.priority === filterPriority);
    }
    if (filterTags.length > 0) {
      result = result.filter(t => filterTags.some(ft => t.tags.includes(ft)));
    }

    // Sort: dueDate (ASC), then priority (ASC)
    result.sort((a, b) => {
      const timeA = a.dueDate ?? Infinity;
      const timeB = b.dueDate ?? Infinity;
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      return a.priority - b.priority;
    });

    return result;
  }, [tasks, filterPriority, filterTags]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleHabitComplete = async (id: number) => {
    await logHabitCompletion(id);
    await loadData();
  };

  const handleHabitDelete = async (id: number, clean = false) => {
    await db.habits.delete(id);
    if (!clean) {
      await db.logs.where('habitId').equals(id).delete();
    }
    await loadData();
  };

  const handleTaskComplete = async (id: number) => {
    await db.tasks.update(id, { status: 'completed', completedAt: Date.now() });
    await loadData();
  };

  const handleTaskFail = async (id: number) => {
    await db.tasks.update(id, { status: 'failed', completedAt: Date.now() });
    await loadData();
  };

  const handleTaskDelete = async (id: number) => {
    await db.tasks.delete(id);
    await loadData();
  };

  const handleBreachDismiss = () => {
    setShowBreach(false);
    setIsLocked(false);
  };

  const toggleTag = (tag: string) => {
    setFilterTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setFilterPriority(null);
    setFilterTags([]);
  };

  const hasActiveFilters = filterPriority !== null || filterTags.length > 0;

  // ── Stats ────────────────────────────────────────────────────────────────────
  const completedToday = habits.filter(h =>
    h.lastCompleted && new Date(h.lastCompleted).toDateString() === new Date().toDateString()
  ).length;
  const avgRisk = habits.length > 0
    ? habits.reduce((a, h) => a + h.riskScore, 0) / habits.length
    : 0;

  // ── Filter Bar ───────────────────────────────────────────────────────────────
  const renderFilterBar = () => {
    if (allTags.length === 0 && habits.length === 0 && tasks.length === 0) return null;

    return (
      <div style={{
        padding: '10px 24px',
        borderBottom: '1px solid var(--gray-200)',
        display: 'flex', alignItems: 'center', gap: '8px',
        flexWrap: 'wrap', background: 'var(--black)',
      }}>
        <span style={{
          fontSize: '9px', fontWeight: 700, letterSpacing: '2px',
          textTransform: 'uppercase', color: 'var(--gray-500)', marginRight: '4px',
        }}>PRIORITY:</span>
        {[1, 2, 3, 4].map(p => (
          <button
            key={p}
            onClick={() => setFilterPriority(filterPriority === p ? null : p)}
            style={{
              padding: '4px 10px', fontSize: '10px', fontWeight: 700,
              fontFamily: 'var(--font-mono)', letterSpacing: '1px',
              border: `1px solid ${filterPriority === p
                ? p === 1 ? 'var(--crimson)' : p === 2 ? 'var(--amber)' : 'var(--gray-500)'
                : 'var(--gray-300)'}`,
              borderRadius: 'var(--radius)',
              color: filterPriority === p
                ? p === 1 ? 'var(--crimson)' : p === 2 ? 'var(--amber)' : 'var(--white)'
                : 'var(--gray-500)',
              background: filterPriority === p ? 'rgba(255,255,255,0.03)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            P{p}
          </button>
        ))}
        {allTags.length > 0 && (
          <div style={{ width: '1px', height: '20px', background: 'var(--gray-300)', margin: '0 6px' }} />
        )}
        {allTags.map(tag => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            style={{
              padding: '4px 10px', fontSize: '9px', fontWeight: 600,
              fontFamily: 'var(--font-mono)', letterSpacing: '0.5px',
              textTransform: 'uppercase',
              border: `1px solid ${filterTags.includes(tag) ? 'var(--crimson)' : 'var(--gray-300)'}`,
              borderRadius: 'var(--radius)',
              color: filterTags.includes(tag) ? 'var(--crimson)' : 'var(--gray-500)',
              background: filterTags.includes(tag) ? 'var(--crimson-glow)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            #{tag}
          </button>
        ))}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            style={{
              padding: '4px 10px', fontSize: '9px', fontWeight: 700,
              letterSpacing: '1px', textTransform: 'uppercase',
              color: 'var(--gray-400)', cursor: 'pointer', marginLeft: 'auto',
            }}
          >
            CLEAR ✕
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="logo-area">
          <div className="logo-text">
            B<span>.</span>A<span>.</span>S<span>.</span>E<span>.</span>
          </div>
        </div>
        <div className="header-stats">
          <div>
            <span>HABITS </span>
            <span className="stat-value">{habits.length}</span>
          </div>
          <div>
            <span>DONE TODAY </span>
            <span className={`stat-value ${completedToday === habits.length && habits.length > 0 ? 'safe' : ''}`}>
              {completedToday}/{habits.length}
            </span>
          </div>
          <div>
            <span>AVG RISK </span>
            <span className={`stat-value ${avgRisk > 0.5 ? 'danger' : 'safe'}`}>
              {(avgRisk * 100).toFixed(0)}%
            </span>
          </div>
          <div>
            <span>BREACHES </span>
            <span className={`stat-value ${breachedHabits.length > 0 ? 'danger' : 'safe'}`}>
              {breachedHabits.length}
            </span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            title="Settings — AI Providers"
            style={{
              color: aiActive ? 'var(--green)' : 'var(--gray-500)',
              fontSize: '16px', padding: '4px',
              transition: 'var(--transition)',
            }}
          >
            ⚙
          </button>
        </div>
      </header>

      {/* Sentry Input */}
      <SentryInput onItemAdded={loadData} />

      {/* Navigation */}
      <nav className="nav-tabs">
        <button className={`nav-tab ${activeTab === 'habits' ? 'active' : ''} ${breachedHabits.length > 0 ? 'breached' : ''}`}
          onClick={() => setActiveTab('habits')}>HABITS</button>
        <button className={`nav-tab ${activeTab === 'tasks' ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
          onClick={() => !isLocked && setActiveTab('tasks')}>TASKS</button>
        <button className={`nav-tab ${activeTab === 'dojo' ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
          onClick={() => !isLocked && setActiveTab('dojo')}>DOJO</button>
        <button className={`nav-tab ${activeTab === 'identity' ? 'active' : ''}`}
          onClick={() => setActiveTab('identity')}>IDENTITY</button>
      </nav>

      {/* Content */}
      <main>
        {activeTab === 'habits' && (
          <>
            {renderFilterBar()}
            <div className="section-header">
              <span className="section-title">FOUNDATIONAL IDENTITY — HIGH SURVEILLANCE</span>
              <span className="section-count">
                {filteredHabits.length}{hasActiveFilters ? ` / ${habits.length}` : ''} TRACKED
              </span>
            </div>
            <div className="item-list">
              {habits.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">◎</div>
                  <div className="empty-title">No Habits Locked</div>
                  <div className="empty-desc">
                    Use the Sentry parser above. Example: &quot;Wake up 5:30am everyday #p1 #discipline&quot;
                  </div>
                </div>
              ) : filteredHabits.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">⊘</div>
                  <div className="empty-title">No Matches</div>
                  <div className="empty-desc">No habits match the current filters.</div>
                </div>
              ) : (
                filteredHabits.map((habit) => (
                  <HabitCard key={habit.id} habit={habit}
                    onComplete={handleHabitComplete} onDelete={handleHabitDelete} />
                ))
              )}
            </div>
          </>
        )}

        {activeTab === 'tasks' && !isLocked && (
          <>
            {renderFilterBar()}
            <div className="section-header">
              <span className="section-title">OPERATIONAL CAMPAIGN</span>
              <span className="section-count">
                {filteredTasks.length}{hasActiveFilters ? ` / ${tasks.length}` : ''} PENDING
              </span>
            </div>
            <div className="item-list">
              {tasks.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">⬡</div>
                  <div className="empty-title">No Active Tasks</div>
                  <div className="empty-desc">
                    Use the Sentry parser. Example: &quot;Submit report by friday #p2 #work&quot;
                  </div>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">⊘</div>
                  <div className="empty-title">No Matches</div>
                  <div className="empty-desc">No tasks match the current filters.</div>
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <TaskCard key={task.id} task={task}
                    onComplete={handleTaskComplete} onFail={handleTaskFail} onDelete={handleTaskDelete} />
                ))
              )}
            </div>
          </>
        )}

        {activeTab === 'dojo' && !isLocked && <DojoPanel />}
        {activeTab === 'identity' && <IdentityPanel />}
      </main>

      {/* Breach Overlay */}
      {showBreach && (
        <BreachOverlay habits={breachedHabits} onComplete={handleHabitComplete} onDismiss={handleBreachDismiss} />
      )}

      {/* Settings */}
      {showSettings && (
        <SettingsModal
          onClose={() => { setShowSettings(false); setAiActive(hasAnyProvider()); }}
          onPurge={loadData}
        />
      )}

      {/* VICE 50 Marquee */}
      <Marquee />
    </div>
  );
}
