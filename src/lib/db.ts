import Dexie, { type Table } from 'dexie';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Habit {
  id?: number;
  title: string;
  priority: 1 | 2 | 3 | 4;
  tags: string[];
  targetTime: string; // HH:MM format
  recurrence: RecurrenceRule;
  riskScore: number;
  resilienceValue: number;
  streakCount: number;
  createdAt: number;
  isBreached: boolean;
  lastCompleted: number | null;
}

export interface RecurrenceRule {
  type: 'daily' | 'alternate' | 'weekends' | 'weekdays' | 'specific_days' | 'nth_day';
  days?: number[];     // 0=Sun, 1=Mon, ..., 6=Sat
  interval?: number;   // For "every Nth day"
}

export interface Task {
  id?: number;
  title: string;
  priority: 1 | 2 | 3 | 4;
  tags: string[];
  dueDate: number | null;
  status: 'pending' | 'completed' | 'failed';
  createdAt: number;
  completedAt: number | null;
}

export interface DojoTrack {
  id?: number;
  blob: Blob;
  title: string;
  category: string;      // Free-form user label e.g. "Morning Motivation"
  icon: string;          // Lucide icon name e.g. "flame", "zap"
  duration: number;      // seconds
  addedAt: number;
}

export interface HabitLog {
  id?: number;
  habitId: number;
  timestamp: number;
  jitterValue: number;     // drift in minutes
  riskSnapshot: number;
  completed: boolean;
}

export interface IdentitySnapshot {
  id?: number;
  vector: number[];        // normalized performance scores
  timestamp: number;
  executionRate: number;    // 0-1
  avgRiskScore: number;
  totalCompleted: number;
  totalMissed: number;
}

// ── Database ───────────────────────────────────────────────────────────────────

class BaseDB extends Dexie {
  habits!: Table<Habit>;
  tasks!: Table<Task>;
  dojo!: Table<DojoTrack>;
  logs!: Table<HabitLog>;
  identity!: Table<IdentitySnapshot>;

  constructor() {
    super('BASE_DB');

    this.version(3).stores({
      habits: '++id, title, priority, *tags, targetTime, recurrence, riskScore, resilienceValue',
      tasks: '++id, title, priority, *tags, dueDate, status',
      dojo: '++id, blob, title, category',
      logs: '++id, habitId, timestamp, jitterValue, riskSnapshot',
      identity: '++id, vector, timestamp',
    });

    this.version(4).stores({
      habits: '++id, title, priority, *tags, targetTime, recurrence, riskScore, resilienceValue',
      tasks: '++id, title, priority, *tags, dueDate, status',
      dojo: '++id, blob, title, category, icon',
      logs: '++id, habitId, timestamp, jitterValue, riskSnapshot',
      identity: '++id, vector, timestamp',
    });
  }
}

export const db = new BaseDB();
