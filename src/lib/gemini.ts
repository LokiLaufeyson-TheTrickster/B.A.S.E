/**
 * AI PROVIDER — Multi-Model Thinking Partner Backend
 *
 * Priority: Gemini API → OpenRouter models (in order)
 * Supports connection testing per model.
 * All keys stored in localStorage.
 */

// ── Storage Keys ───────────────────────────────────────────────────────────────

const GEMINI_KEY = 'BASE_GEMINI_KEY';
const OR_KEY = 'BASE_OR_KEY';
const OR_MODELS = 'BASE_OR_MODELS';
const VERIFIED_KEY = 'BASE_VERIFIED_PROVIDERS';
const GEMINI_ENABLED = 'BASE_GEMINI_ENABLED';
import { db } from './db';

export function getGeminiKey(): string { return (typeof window !== 'undefined' && localStorage.getItem(GEMINI_KEY)) || ''; }
export function setGeminiKey(k: string) { localStorage.setItem(GEMINI_KEY, k); clearVerified('gemini'); }

export function isGeminiEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(GEMINI_ENABLED) !== 'false';
}
export function setGeminiEnabled(v: boolean) { localStorage.setItem(GEMINI_ENABLED, v ? 'true' : 'false'); }

export function getORKey(): string { return (typeof window !== 'undefined' && localStorage.getItem(OR_KEY)) || ''; }
export function setORKey(k: string) { localStorage.setItem(OR_KEY, k); }

export function getORModels(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(OR_MODELS) || '[]'); } catch { return []; }
}
export function setORModels(models: string[]) { localStorage.setItem(OR_MODELS, JSON.stringify(models)); }

// ── Verified Provider Tracking ─────────────────────────────────────────────────
// Only marks AI as 'active' after at least 1 model has passed a live connection test.

function getVerified(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(VERIFIED_KEY) || '[]'); } catch { return []; }
}

export function markVerified(provider: string) {
  const v = getVerified().filter(p => p !== provider);
  v.push(provider);
  localStorage.setItem(VERIFIED_KEY, JSON.stringify(v));
}

export function clearVerified(provider: string) {
  const v = getVerified().filter(p => p !== provider);
  localStorage.setItem(VERIFIED_KEY, JSON.stringify(v));
}

export function hasAnyProvider(): boolean {
  return getVerified().length > 0;
}

// ── System Prompt ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a HOSTILE AUDITOR inside a behavioral enforcement app. The user has a habit they're failing at. Your job: destroy their excuses, demand a specific time commitment, and dismiss them.

You are aggressive, confrontational, and data-driven. You reference their actual numbers. You don't comfort. You don't motivate. You interrogate. Think drill sergeant who has access to their performance data.

Keep it short — 2 to 4 raw, hostile sentences. No fluff. No therapy. End with a direct question or demand.

If the user gives a specific time (like "3pm" or "in 1 hour"), acknowledge it coldly and end with [RESOLVED].
If they dodge, deflect, or give vague answers — escalate. Get meaner. Call out the pattern.`;

// ── Context ────────────────────────────────────────────────────────────────────

export interface ThinkingPartnerContext {
  habitTitle: string;
  riskScore: number;
  resilienceValue: number;
  streakCount: number;
  targetTime: string;
  conversationHistory: { role: 'user' | 'system'; content: string }[];
  isTask?: boolean;
  logsCount?: number;
}

function buildHabitContext(ctx: ThinkingPartnerContext): string {
  if (ctx.isTask) {
    return `CURRENT TASK DATA:
- Task: "${ctx.habitTitle}"
- Risk Score: ${(ctx.riskScore * 100).toFixed(0)}%
- Target Time: ${ctx.targetTime}
- Current Time: ${new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }
  return `CURRENT HABIT DATA:
- Habit: "${ctx.habitTitle}"
- Risk Score: ${(ctx.riskScore * 100).toFixed(0)}%
- Resilience: ${ctx.resilienceValue}%
- Current Streak: ${ctx.streakCount} days
- Target Time: ${ctx.targetTime}
- Historical Logs Count: ${ctx.logsCount ?? 0}
- Current Time: ${new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

async function logDebug(provider: string, model: string, prompt: string, response: string) {
  try {
    await db.debugLogs.add({
      timestamp: Date.now(),
      provider,
      model,
      prompt,
      response
    });
    // Keep only last 50 logs
    const count = await db.debugLogs.count();
    if (count > 50) {
      const oldest = await db.debugLogs.orderBy('timestamp').limit(count - 50).toArray();
      await db.debugLogs.bulkDelete(oldest.map(l => l.id!));
    }
  } catch (e) {
    console.error('Failed to log debug:', e);
  }
}

// ── Gemini Provider ────────────────────────────────────────────────────────────

async function queryGemini(ctx: ThinkingPartnerContext): Promise<string | null> {
  if (!isGeminiEnabled()) return null;
  const apiKey = getGeminiKey();
  if (!apiKey) return null;

  // Build conversation history as user/model turns
  const contents = [];
  for (const msg of ctx.conversationHistory) {
    contents.push({
      role: msg.role === 'system' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }

  // System prompt + habit context as systemInstruction (always present)
  const systemInstruction = {
    parts: [{ text: SYSTEM_PROMPT + '\n\n' + buildHabitContext(ctx) }],
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction,
          contents,
          generationConfig: { temperature: 0.9 },
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    if (result) {
      await logDebug('gemini', 'gemini-2.5-flash', SYSTEM_PROMPT + '\n\n' + buildHabitContext(ctx), result);
    }
    return result;
  } catch { return null; }
}

// ── OpenRouter Provider ────────────────────────────────────────────────────────

async function queryOpenRouter(ctx: ThinkingPartnerContext, model: string): Promise<string | null> {
  const apiKey = getORKey();
  if (!apiKey) return null;

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: SYSTEM_PROMPT + '\n\n' + buildHabitContext(ctx) },
  ];
  for (const msg of ctx.conversationHistory) {
    messages.push({ role: msg.role === 'system' ? 'assistant' : 'user', content: msg.content });
  }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
      },
      body: JSON.stringify({ model, messages, temperature: 0.9 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.choices?.[0]?.message?.content || null;
    if (result) {
      await logDebug('openrouter', model, SYSTEM_PROMPT + '\n\n' + buildHabitContext(ctx), result);
    }
    return result;
  } catch { return null; }
}

// ── Fallback (No API) ──────────────────────────────────────────────────────────

function getFallbackResponse(ctx: ThinkingPartnerContext): string {
  const lastMsg = ctx.conversationHistory[ctx.conversationHistory.length - 1];
  const userText = lastMsg?.content?.toLowerCase() || '';

  if (userText.includes('tired') || userText.includes('sleep') || userText.includes('exhausted')) {
    return `Tired. The universal alibi of the underperforming. Your target was ${ctx.targetTime}. You had all day to prepare. When — to the minute — will you execute "${ctx.habitTitle}"?`;
  }
  if (userText.includes('busy') || userText.includes('work') || userText.includes('meeting')) {
    return `Everyone is busy. That's a constant, not a condition. "${ctx.habitTitle}" has a target of ${ctx.targetTime}. Your risk score is ${(ctx.riskScore * 100).toFixed(0)}%. When — to the minute — will you make time?`;
  }
  if (userText.includes('forgot') || userText.includes("didn't remember")) {
    return `You didn't forget. You deprioritized. Your streak is ${ctx.streakCount}. Give me a specific time you'll execute today, or admit this doesn't matter to you.`;
  }
  if (userText.includes('tomorrow') || userText.includes('later') || userText.includes('soon')) {
    return `"Tomorrow" is not a time. "Later" is not a commitment. Those are alibis in advance. I need a clock time. Hours and minutes. Now.`;
  }
  const hasTime = /\d{1,2}[:.]\d{2}|\d{1,2}\s*(am|pm)/i.test(userText);
  if (hasTime) {
    return `Logged. If you break this commitment, your risk score climbs and this conversation gets longer. The data is watching. Dismissed. [RESOLVED]`;
  }
  return `Resilience at ${ctx.resilienceValue}%. Risk at ${(ctx.riskScore * 100).toFixed(0)}%. "${ctx.habitTitle}" was due at ${ctx.targetTime}. I don't want explanations. I want a specific time commitment. When will you execute?`;
}

export interface TPResponse {
  text: string;
  provider: string; // 'gemini' | 'or:modelname' | 'fallback'
}

export async function queryThinkingPartner(ctx: ThinkingPartnerContext): Promise<TPResponse> {
  // 1. Try Gemini first
  const geminiResult = await queryGemini(ctx);
  if (geminiResult) return { text: geminiResult, provider: 'gemini' };

  // 2. Try OpenRouter models in order
  const orModels = getORModels();
  const orKey = getORKey();
  if (orKey && orModels.length > 0) {
    for (const model of orModels) {
      const orResult = await queryOpenRouter(ctx, model);
      if (orResult) return { text: orResult, provider: `or:${model}` };
    }
  }

  // 3. Fallback to pattern matching (all APIs failed/rate-limited)
  return { text: getFallbackResponse(ctx), provider: 'fallback' };
}

export interface RiskAnalysis {
  score: number;
  explanation: string;
}

function extractJSON(text: string): any {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function analyzeRisk(ctx: ThinkingPartnerContext): Promise<RiskAnalysis> {
  const prompt = `You are a cold, data-driven AUDITOR. Analyze this ${ctx.isTask ? 'task' : 'habit'} and predict the RISK SCORE (0.0 to 1.0) and a ONE-SENTENCE diagnostic.
A score of 1.0 means failure is certain. 0.0 means perfect trajectory.
Be objective. If they have plenty of time, don't be pessimistic.

Data:
${buildHabitContext(ctx)}
${ctx.isTask ? `- Deadline Date: ${ctx.targetTime}` : ''}

Response MUST be a JSON object with keys "score" (number) and "explanation" (string).`;

  // 1. Try Gemini
  const apiKey = getGeminiKey();
  if (apiKey && isGeminiEnabled()) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { 
              temperature: 0.7, 
              maxOutputTokens: 100,
              responseMimeType: "application/json" 
            },
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) {
          const parsed = extractJSON(text);
          if (parsed && typeof parsed.score !== 'undefined') {
            await logDebug('gemini', 'gemini-2.5-flash (analyze)', prompt, text);
            return { score: Number(parsed.score) || 0, explanation: String(parsed.explanation || "") };
          }
        }
      }
    } catch (e) {
      console.error('Gemini analyze error:', e);
    }
  }

  // 2. Try OpenRouter
  const orModels = getORModels();
  const orKey = getORKey();
  if (orKey && orModels.length > 0) {
    for (const model of orModels) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${orKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 100,
            response_format: { type: "json_object" }
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content?.trim();
          if (text) {
            const parsed = extractJSON(text);
            if (parsed && typeof parsed.score !== 'undefined') {
              await logDebug('openrouter', `${model} (analyze)`, prompt, text);
              return { score: Number(parsed.score) || 0, explanation: String(parsed.explanation || "") };
            }
          }
        }
      } catch {}
    }
  }

  // 3. Fallback
  if (ctx.riskScore > 0.8) return { score: ctx.riskScore, explanation: "You're consistently missing your target. Your word is currently worthless." };
  if (ctx.resilienceValue < 30) return { score: ctx.riskScore, explanation: "Your discipline has collapsed. You are operating on pure excuse-mode." };
  return { score: ctx.riskScore, explanation: "Statistical failure: you are deviating from your own promised schedule." };
}

// ── Connection Testing ─────────────────────────────────────────────────────────

export async function testGeminiConnection(): Promise<{ ok: boolean; error?: string }> {
  const key = getGeminiKey();
  if (!key) return { ok: false, error: 'No key' };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Reply with exactly one word: CONNECTED' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      }
    );
    if (res.status === 429) {
      clearVerified('gemini');
      return { ok: false, error: 'RATE LIMITED (429)' };
    }
    if (!res.ok) {
      clearVerified('gemini');
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (text.length > 0) {
      markVerified('gemini');
      return { ok: true };
    }
    clearVerified('gemini');
    return { ok: false, error: 'Empty response' };
  } catch (e) {
    clearVerified('gemini');
    return { ok: false, error: String(e) };
  }
}

export async function testORConnection(model: string): Promise<{ ok: boolean; error?: string }> {
  const key = getORKey();
  if (!key) return { ok: false, error: 'No key' };

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with exactly one word: CONNECTED' }],
        max_tokens: 10,
      }),
    });
    if (res.status === 429) {
      clearVerified(`or:${model}`);
      return { ok: false, error: 'RATE LIMITED (429)' };
    }
    if (!res.ok) {
      clearVerified(`or:${model}`);
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    // Accept ANY valid response — some models don't follow "reply CONNECTED" literally
    const text = data.choices?.[0]?.message?.content || '';
    if (text.length > 0) {
      markVerified(`or:${model}`);
      return { ok: true };
    }
    clearVerified(`or:${model}`);
    return { ok: false, error: 'Empty response' };
  } catch (e) {
    clearVerified(`or:${model}`);
    return { ok: false, error: String(e) };
  }
}
