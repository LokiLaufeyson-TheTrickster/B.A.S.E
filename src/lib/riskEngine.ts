/**
 * THE RISK ENGINE — Failure Prediction System
 * 
 * Calculates a Risk Score (Rs) for every habit:
 *   Rs = ((Drift_Today + Avg_Drift_3d) / T_threshold) * ln(S_volatility + e)
 * 
 * Where:
 *   - Drift: Variance between target time and actual execution time
 *   - Volatility: Std deviation of last 7 execution timestamps  
 *   - Threshold: If Rs > 0.75, habit enters BREACH MODE
 */

import { db, type Habit, type HabitLog, type Task } from './db';
import { analyzeRiskBatch, analyzeRisk, type ThinkingPartnerContext } from './gemini';
import { sendPushNotification } from './ntfy';

const BREACH_THRESHOLD = 0.75;
const DRIFT_THRESHOLD_MINUTES = 30; // T_threshold

// ── Utility ────────────────────────────────────────────────────────────────────

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function timestampToMinutes(ts: number): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

function getDueDateMinutes(dueDate: number | null): number {
  if (!dueDate) return 1440; // End of day
  const d = new Date(dueDate);
  return d.getHours() * 60 + d.getMinutes();
}

// ── Core Engine ────────────────────────────────────────────────────────────────

export async function calculateRiskScore(habit: Habit): Promise<{ score: number, logsCount: number }> {
  if (!habit.id) return { score: 0, logsCount: 0 };

  const now = Date.now();
  
  // 0. ABSOLUTE ZERO: If completed today, risk is 0. No exceptions.
  if (habit.lastCompleted && new Date(habit.lastCompleted).toDateString() === new Date(now).toDateString()) {
    return { score: 0, logsCount: 0 };
  }

  const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const logs = await db.logs
    .where('habitId')
    .equals(habit.id)
    .and(log => log.timestamp > sevenDaysAgo)
    .sortBy('timestamp');

  const targetMinutes = timeToMinutes(habit.targetTime);
  const currentMinutes = timestampToMinutes(now);

  // 1. BASELINE DRIFT (Last 7 Days)
  const drift7d = logs.length > 0 
    ? logs.reduce((a, b) => a + Math.abs(b.jitterValue), 0) / logs.length 
    : 0;

  // 2. MOMENTUM (Last 3 Days vs Last 7 Days)
  // If recent drift is higher than average, we are in "Discipline Decay"
  const logs3d = logs.filter(l => l.timestamp > threeDaysAgo);
  const drift3d = logs3d.length > 0
    ? logs3d.reduce((a, b) => a + Math.abs(b.jitterValue), 0) / logs3d.length
    : drift7d;
  
  const momentum = drift3d > drift7d ? 1.5 : 0.8; // 50% penalty for worsening trend
  
  // 3. DEADLINE GRAVITY
  // Sigmoid-like curve: Risk is low until ~2 hours before, then spikes.
  const minutesToDeadline = targetMinutes - currentMinutes;
  let gravity = 1.0;
  
  if (minutesToDeadline > 240) { // > 4 hours
    gravity = 0.2;
  } else if (minutesToDeadline > 0) {
    // Smooth curve from 0.2 to 1.0 as we approach deadline
    gravity = 0.2 + (0.8 * Math.pow(1 - (minutesToDeadline / 240), 2));
  } else {
    // Overdue: Gravity escalates rapidly
    const minutesOverdue = Math.abs(minutesToDeadline);
    gravity = 1.0 + (minutesOverdue / 60); 
  }

  // 4. STREAK PROTECTION (Armor)
  // Every 5 days of streak reduces risk by 5%, max 25% reduction.
  const armor = Math.max(0.75, 1 - (habit.streakCount * 0.01));

  // 5. FINAL CALCULATION (Deterministic Vector)
  // Risk = (Average Drift / Threshold) * Momentum * Gravity * Armor
  const baseRisk = (drift7d / DRIFT_THRESHOLD_MINUTES);
  const Rs = baseRisk * momentum * gravity * armor;

  // Clamp to 0-1 range
  const score = Math.min(Math.max(Rs, 0), 1);
  return { score, logsCount: logs.length };
}

export async function calculateTaskRiskScore(task: Task): Promise<number> {
  const now = Date.now();
  if (!task.dueDate) return 0.2 * (5 - task.priority);

  const timeLeft = task.dueDate - now;
  const hoursLeft = timeLeft / (1000 * 60 * 60);

  if (timeLeft < 0) return 1.0; // Overdue is critical
  
  // If more than 24 hours away, risk is low, priority based
  if (hoursLeft > 24) {
    return Math.max(0.1, (5 - task.priority) * 0.08);
  }

  // If within 24 hours, risk increases
  const baseRisk = (5 - task.priority) * 0.1;
  const timeFactor = 1 - (hoursLeft / 24); // 0 at 24h, 1 at 0h
  
  // Dampen task risk if many hours left
  const dampen = hoursLeft > 12 ? 0.3 : hoursLeft > 6 ? 0.6 : 1.0;
  const risk = (baseRisk + (0.95 - baseRisk) * Math.pow(timeFactor, 1.5)) * dampen; 

  return Math.min(0.95, risk);
}

export async function runMorningRecon(force = false): Promise<{ habits: Habit[], tasks: Task[] }> {
  const habits = await db.habits.toArray();
  const tasks = await db.tasks.where('status').equals('pending').toArray();
  const breachedHabits: Habit[] = [];
  const riskyTasks: Task[] = [];
  
  const twentyMins = 20 * 60 * 1000;
  const auditQueue: { item: Habit | Task, ctx: ThinkingPartnerContext, isTask: boolean }[] = [];

  // 1. Filter Habits
  for (const habit of habits) {
    const isCompleted = habit.lastCompleted && new Date(habit.lastCompleted).toDateString() === new Date().toDateString();
    
    if (isCompleted) {
      // Auto-clear for completed habits
      await db.habits.update(habit.id!, { 
        riskScore: 0, 
        isBreached: false, 
        riskExplanation: "Goal achieved for today.", 
        lastRiskAudit: Date.now() 
      });
      continue;
    }

    const { score: riskScore, logsCount } = await calculateRiskScore(habit);
    const needsAudit = force || !habit.lastRiskAudit || (Date.now() - habit.lastRiskAudit > twentyMins);
    
    if (needsAudit) {
      auditQueue.push({
        item: habit,
        isTask: false,
        ctx: {
          habitTitle: habit.title,
          riskScore,
          resilienceValue: habit.resilienceValue,
          streakCount: habit.streakCount,
          targetTime: habit.targetTime,
          conversationHistory: [],
          logsCount,
          isCompleted: false,
          lastRiskScore: habit.riskScore,
          lastRiskExplanation: habit.riskExplanation
        }
      });
    } else if (habit.riskScore > 0.7) {
      breachedHabits.push(habit);
    }
  }

  // 2. Filter Tasks
  for (const task of tasks) {
    const riskScore = await calculateTaskRiskScore(task);
    const needsAudit = force || !task.lastRiskAudit || (Date.now() - task.lastRiskAudit > twentyMins);

    if (needsAudit) {
      auditQueue.push({
        item: task,
        isTask: true,
        ctx: {
          habitTitle: task.title,
          riskScore,
          resilienceValue: 0,
          streakCount: 0,
          targetTime: task.dueDate ? new Date(task.dueDate).toLocaleString() : 'N/A',
          conversationHistory: [],
          isTask: true,
          isCompleted: task.status === 'completed',
          lastRiskScore: task.riskScore,
          lastRiskExplanation: task.riskExplanation
        }
      });
    } else if (task.riskScore > 0.7) {
      riskyTasks.push(task);
    }
  }

  // 3. Execute Batch Audit (Explanations Only)
  if (auditQueue.length > 0) {
    const results = await analyzeRiskBatch(auditQueue.map(q => q.ctx));
    for (let i = 0; i < auditQueue.length; i++) {
      const q = auditQueue[i];
      const res = results[i];
      const deterministicScore = q.ctx.riskScore; // Use the score we calculated mathematically
      
      if (q.isTask) {
        await db.tasks.update(q.item.id!, { 
          riskScore: deterministicScore, 
          riskExplanation: res.explanation, 
          lastRiskAudit: Date.now() 
        });
        if (deterministicScore > 0.7) riskyTasks.push({ ...(q.item as Task), riskScore: deterministicScore, riskExplanation: res.explanation });
      } else {
        const h = q.item as Habit;
        await db.habits.update(h.id!, { 
          riskScore: deterministicScore, 
          riskExplanation: res.explanation, 
          lastRiskAudit: Date.now(),
          isBreached: deterministicScore > BREACH_THRESHOLD
        });
        if (deterministicScore > 0.7) breachedHabits.push({ ...h, riskScore: deterministicScore, riskExplanation: res.explanation });
      }
    }
  }

  // Mark recon as run for today
  if (typeof window !== 'undefined') {
    localStorage.setItem('BASE_LAST_RECON', new Date().toDateString());
  }

  if (breachedHabits.length > 0 || riskyTasks.length > 0) {
    const totalCount = breachedHabits.length + riskyTasks.length;
    const details = [
      ...breachedHabits.map(h => `[!] ${h.title}: ${h.riskExplanation}`),
      ...riskyTasks.map(t => `[!] ${t.title}: ${t.riskExplanation}`)
    ].join('\n');

    await sendPushNotification(
      `AUDIT: ${totalCount} HIGH-RISK VECTORS`,
      details
    );
  }

  return { habits: breachedHabits, tasks: riskyTasks };
}

export function isReconDue(): boolean {
  if (typeof window === 'undefined') return false;
  const lastRecon = localStorage.getItem('BASE_LAST_RECON');
  const today = new Date().toDateString();
  const currentHour = new Date().getHours();

  // If not run today AND it's after 6 AM
  return lastRecon !== today && currentHour >= 6;
}

export async function logHabitCompletion(habitId: number): Promise<void> {
  const habit = await db.habits.get(habitId);
  if (!habit) return;

  const now = Date.now();
  const targetMinutes = timeToMinutes(habit.targetTime);
  const actualMinutes = timestampToMinutes(now);
  const jitter = actualMinutes - targetMinutes;

  await db.logs.add({
    habitId,
    timestamp: now,
    jitterValue: jitter,
    riskSnapshot: habit.riskScore,
    completed: true,
  });

  // Update resilience & streak — ALWAYS clear breach on completion
  const newResilience = Math.min(100, habit.resilienceValue + 5);
  const newStreak = habit.streakCount + 1;

  await db.habits.update(habitId, {
    lastCompleted: now,
    resilienceValue: newResilience,
    streakCount: newStreak,
    riskScore: 0, // Reset risk — you did the work
    isBreached: false, // Clear breach — execution beats prediction
  });
}

export async function getHabitStats(habitId: number) {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const logs = await db.logs
    .where('habitId')
    .equals(habitId)
    .and(log => log.timestamp > sevenDaysAgo)
    .toArray();

  const completedLogs = logs.filter(l => l.completed);
  const avgJitter = completedLogs.length > 0
    ? completedLogs.reduce((a, b) => a + Math.abs(b.jitterValue), 0) / completedLogs.length
    : 0;

  return {
    completionsThisWeek: completedLogs.length,
    avgJitter: Math.round(avgJitter),
    totalLogs: logs.length,
  };
}

export { BREACH_THRESHOLD };
