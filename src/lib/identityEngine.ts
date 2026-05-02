/**
 * THE IDENTITY ENGINE — Weekly Performance Vectorization
 * 
 * Converts weekly performance into an "Execution Vector."
 * Compares current self against Peak Performance data.
 * Deploys Identity Attacks when drift exceeds 15%.
 */

import { db, type IdentitySnapshot } from './db';

export async function generateWeeklyVector(): Promise<number[]> {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const habits = await db.habits.toArray();
  const logs = await db.logs
    .where('timestamp')
    .above(weekAgo)
    .toArray();

  if (habits.length === 0) return [0, 0, 0, 0, 0];

  // Vector components:
  // [executionRate, avgRiskScore, consistencyScore, streakScore, resilienceScore]

  const completedLogs = logs.filter(l => l.completed);
  const expectedCompletions = habits.length * 7; // rough estimate
  const executionRate = Math.min(completedLogs.length / Math.max(expectedCompletions, 1), 1);

  const avgRisk = habits.length > 0
    ? habits.reduce((a, h) => a + h.riskScore, 0) / habits.length
    : 0;

  // Consistency: inverse of jitter variance
  const jitters = completedLogs.map(l => Math.abs(l.jitterValue));
  const avgJitter = jitters.length > 0 ? jitters.reduce((a, b) => a + b, 0) / jitters.length : 60;
  const consistencyScore = Math.max(0, 1 - (avgJitter / 120)); // 120 min = worst

  // Streak score: normalized average streak
  const avgStreak = habits.length > 0
    ? habits.reduce((a, h) => a + h.streakCount, 0) / habits.length
    : 0;
  const streakScore = Math.min(avgStreak / 30, 1); // 30-day streak = max

  // Resilience: normalized average
  const avgResilience = habits.length > 0
    ? habits.reduce((a, h) => a + h.resilienceValue, 0) / habits.length
    : 0;
  const resilienceScore = avgResilience / 100;

  return [executionRate, 1 - avgRisk, consistencyScore, streakScore, resilienceScore];
}

export async function saveWeeklySnapshot(): Promise<IdentitySnapshot> {
  const vector = await generateWeeklyVector();
  const habits = await db.habits.toArray();
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const logs = await db.logs
    .where('timestamp')
    .above(weekAgo)
    .toArray();

  const completed = logs.filter(l => l.completed).length;
  const missed = logs.filter(l => !l.completed).length;
  const avgRisk = habits.length > 0
    ? habits.reduce((a, h) => a + h.riskScore, 0) / habits.length
    : 0;

  const snapshot: IdentitySnapshot = {
    vector,
    timestamp: now,
    executionRate: vector[0],
    avgRiskScore: avgRisk,
    totalCompleted: completed,
    totalMissed: missed,
  };

  const id = await db.identity.add(snapshot);
  return { ...snapshot, id };
}

export async function getPeakPerformance(): Promise<IdentitySnapshot | null> {
  const snapshots = await db.identity.toArray();
  if (snapshots.length === 0) return null;

  return snapshots.reduce((peak, current) => {
    const peakMagnitude = vectorMagnitude(peak.vector);
    const currentMagnitude = vectorMagnitude(current.vector);
    return currentMagnitude > peakMagnitude ? current : peak;
  });
}

export async function getIdentityDrift(): Promise<number> {
  const peak = await getPeakPerformance();
  if (!peak) return 0;

  const currentVector = await generateWeeklyVector();
  const peakMagnitude = vectorMagnitude(peak.vector);
  const currentMagnitude = vectorMagnitude(currentVector);

  if (peakMagnitude === 0) return 0;

  return (peakMagnitude - currentMagnitude) / peakMagnitude;
}

export async function shouldDeployIdentityAttack(): Promise<boolean> {
  const drift = await getIdentityDrift();
  return drift > 0.15; // 15% threshold
}

function vectorMagnitude(v: number[]): number {
  return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
}

export function getOverallScore(vector: number[]): number {
  // Weighted average: execution(30%), risk-inv(20%), consistency(20%), streak(15%), resilience(15%)
  const weights = [0.30, 0.20, 0.20, 0.15, 0.15];
  return vector.reduce((sum, v, i) => sum + v * (weights[i] || 0), 0) * 100;
}
