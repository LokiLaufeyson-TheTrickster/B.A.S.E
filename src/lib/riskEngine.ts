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

import { db, type Habit, type HabitLog } from './db';

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

// ── Core Engine ────────────────────────────────────────────────────────────────

export async function calculateRiskScore(habit: Habit): Promise<number> {
  if (!habit.id) return 0;

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
    // No data → default moderate risk
    return 0.5;
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
  return Math.min(Math.max(Rs, 0), 1);
}

export async function runMorningRecon(): Promise<Habit[]> {
  const habits = await db.habits.toArray();
  const breachedHabits: Habit[] = [];
  const todayStr = new Date().toDateString();

  for (const habit of habits) {
    // Skip habits already completed today
    const completedToday = habit.lastCompleted
      ? new Date(habit.lastCompleted).toDateString() === todayStr
      : false;

    if (completedToday) {
      // Already done today — clear breach
      await db.habits.update(habit.id!, { isBreached: false });
      continue;
    }

    const riskScore = await calculateRiskScore(habit);
    const isBreached = riskScore > BREACH_THRESHOLD;

    await db.habits.update(habit.id!, {
      riskScore,
      isBreached,
    });

    if (isBreached) {
      breachedHabits.push({ ...habit, riskScore, isBreached });
    }
  }

  return breachedHabits;
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
