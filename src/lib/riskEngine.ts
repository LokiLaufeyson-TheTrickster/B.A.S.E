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
import { explainRisk } from './gemini';
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
  const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  // Fetch recent logs
  const recentLogs = await db.logs
    .where('habitId')
    .equals(habit.id)
    .and(log => log.timestamp > sevenDaysAgo)
    .sortBy('timestamp');

  if (recentLogs.length === 0) {
    // New habit or no recent data → No risk yet.
    return { score: 0, logsCount: 0 };
  }

  const targetMinutes = timeToMinutes(habit.targetTime);

  // Calculate today's drift
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayLogs = recentLogs.filter(l => l.timestamp >= todayStart.getTime());
  
  let driftToday = 0;
  if (todayLogs.length > 0) {
    const latestToday = todayLogs[todayLogs.length - 1];
    driftToday = Math.abs(timestampToMinutes(latestToday.timestamp) - targetMinutes);
  } else {
    // Not done today → drift = current time - target time (if past target)
    const currentMinutes = timestampToMinutes(now);
    if (currentMinutes > targetMinutes) {
      driftToday = currentMinutes - targetMinutes;
    }
  }

  // Average drift over last 3 days
  const threeDayLogs = recentLogs.filter(l => l.timestamp > threeDaysAgo);
  const drifts = threeDayLogs.map(l => Math.abs(timestampToMinutes(l.timestamp) - targetMinutes));
  const avgDrift3d = drifts.length > 0 ? drifts.reduce((a, b) => a + b, 0) / drifts.length : driftToday;

  // Volatility: stddev of last 7 execution times  
  const execMinutes = recentLogs.map(l => timestampToMinutes(l.timestamp));
  const volatility = stdDev(execMinutes);

  // Risk Score Formula
  const Rs = ((driftToday + avgDrift3d) / DRIFT_THRESHOLD_MINUTES) * Math.log(volatility + Math.E);

  // Clamp to 0-1 range
  const score = Math.min(Math.max(Rs, 0), 1);
  return { score, logsCount: recentLogs.length };
}

export async function calculateTaskRiskScore(task: Task): Promise<number> {
  const now = Date.now();
  if (!task.dueDate) return 0.2 * (5 - task.priority); // Low risk if no due date, priority based

  const timeLeft = task.dueDate - now;
  const hoursLeft = timeLeft / (1000 * 60 * 60);

  if (timeLeft < 0) return 1.0; // Overdue is critical
  if (hoursLeft < 4) return 0.9; // Due soon is high risk
  if (hoursLeft < 12) return 0.7; // Same day is moderate risk

  return Math.max(0.1, (5 - task.priority) * 0.1);
}

export async function runMorningRecon(force = false): Promise<{ habits: Habit[], tasks: Task[] }> {
  const habits = await db.habits.toArray();
  const tasks = await db.tasks.where('status').equals('pending').toArray();
  const breachedHabits: Habit[] = [];
  const riskyTasks: Task[] = [];
  const todayStr = new Date().toDateString();

  // Process Habits
  for (const habit of habits) {
    const completedToday = habit.lastCompleted
      ? new Date(habit.lastCompleted).toDateString() === todayStr
      : false;

    if (completedToday) {
      await db.habits.update(habit.id!, { isBreached: false, riskExplanation: undefined });
      continue;
    }

    const { score: riskScore, logsCount } = await calculateRiskScore(habit);
    const isBreached = riskScore > BREACH_THRESHOLD;
    let riskExplanation = habit.riskExplanation;

    if (isBreached && (force || !riskExplanation)) {
      riskExplanation = await explainRisk({
        habitTitle: habit.title,
        riskScore,
        resilienceValue: habit.resilienceValue,
        streakCount: habit.streakCount,
        targetTime: habit.targetTime,
        conversationHistory: [],
        logsCount: logsCount // Pass count to AI
      });
    }

    await db.habits.update(habit.id!, {
      riskScore,
      isBreached,
      riskExplanation
    });

    if (isBreached) {
      breachedHabits.push({ ...habit, riskScore, isBreached, riskExplanation });
    }
  }

  // Process Tasks
  for (const task of tasks) {
    const riskScore = await calculateTaskRiskScore(task);
    const isRisky = riskScore > 0.6;
    let riskExplanation = task.riskExplanation;

    if (isRisky && (force || !riskExplanation)) {
      riskExplanation = await explainRisk({
        habitTitle: task.title,
        riskScore,
        resilienceValue: 0,
        streakCount: 0,
        targetTime: task.dueDate ? new Date(task.dueDate).toLocaleTimeString() : 'N/A',
        conversationHistory: [],
        isTask: true
      });
    }

    await db.tasks.update(task.id!, {
      riskScore,
      riskExplanation
    });

    if (isRisky) {
      riskyTasks.push({ ...task, riskScore, riskExplanation });
    }
  }

  // Mark recon as run for today
  if (typeof window !== 'undefined') {
    localStorage.setItem('BASE_LAST_RECON', todayStr);
  }

  if (breachedHabits.length > 0 || riskyTasks.length > 0) {
    const total = breachedHabits.length + riskyTasks.length;
    const descriptions = [
      ...breachedHabits.map(h => `HABIT: ${h.title} - ${h.riskExplanation}`),
      ...riskyTasks.map(t => `TASK: ${t.title} - ${t.riskExplanation}`)
    ].join('\n\n');

    await sendPushNotification(
      `MORNING RECON: ${total} VECTORS`,
      descriptions,
      4
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
