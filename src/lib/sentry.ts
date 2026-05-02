/**
 * SENTRY NLP PARSER
 * Single-field command line that interprets intent and structures it.
 * 
 * Syntax examples:
 *   "Wake up at 6am everyday #p1 #health"
 *   "Submit report by friday #p2 #work"
 *   "Meditate alternate days 7:30am #p1 #mind"
 *   "Cold shower everyday 5:30am #p1 #discipline"
 *   "Buy groceries tomorrow #p3 #errand"
 */

import * as chrono from 'chrono-node';
import type { Habit, Task, RecurrenceRule } from './db';

interface ParseResult {
  type: 'habit' | 'task';
  data: Partial<Habit> | Partial<Task>;
}

// ── Regex Layers ───────────────────────────────────────────────────────────────

const PRIORITY_REGEX = /#p([1-4])/i;
const TAG_REGEX = /#([a-zA-Z][a-zA-Z0-9]*)/g;

const RECURRENCE_PATTERNS: { pattern: RegExp; getRule: (match: RegExpMatchArray) => RecurrenceRule }[] = [
  {
    pattern: /\bevery\s*day\b|\bdaily\b|\beveryday\b/i,
    getRule: () => ({ type: 'daily' }),
  },
  {
    pattern: /\balternate\s*(?:day)?s?\b|\bevery\s*other\s*day\b/i,
    getRule: () => ({ type: 'alternate', interval: 2 }),
  },
  {
    pattern: /\bweekends?\b/i,
    getRule: () => ({ type: 'weekends', days: [0, 6] }),
  },
  {
    pattern: /\bweekdays?\b/i,
    getRule: () => ({ type: 'weekdays', days: [1, 2, 3, 4, 5] }),
  },
  {
    pattern: /\bevery\s+(\d+)(?:st|nd|rd|th)?\s*(?:day)?\b/i,
    getRule: (match) => ({ type: 'nth_day', interval: parseInt(match[1]) }),
  },
  {
    pattern: /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s*,\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday))*/i,
    getRule: (match) => {
      const dayMap: Record<string, number> = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6,
      };
      const fullMatch = match[0];
      const days: number[] = [];
      const dayRegex = /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi;
      let m;
      while ((m = dayRegex.exec(fullMatch)) !== null) {
        days.push(dayMap[m[1].toLowerCase()]);
      }
      return { type: 'specific_days', days };
    },
  },
];

// ── Time Extraction ────────────────────────────────────────────────────────────

function extractTargetTime(input: string): string | null {
  // Try explicit time patterns first
  const timeMatch = input.match(/\b(\d{1,2}):?(\d{2})?\s*(am|pm)\b/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2] || '0');
    const period = timeMatch[3].toLowerCase();
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  // Fallback: chrono
  const parsed = chrono.parse(input);
  if (parsed.length > 0 && parsed[0].start.isCertain('hour')) {
    const h = parsed[0].start.get('hour') || 0;
    const m = parsed[0].start.get('minute') || 0;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  return null;
}

// ── Clean Title ────────────────────────────────────────────────────────────────

function cleanTitle(input: string): string {
  let title = input;
  // Remove priority tags
  title = title.replace(PRIORITY_REGEX, '');
  // Remove all hashtags
  title = title.replace(/#[a-zA-Z][a-zA-Z0-9]*/g, '');
  // Remove recurrence keywords
  RECURRENCE_PATTERNS.forEach(({ pattern }) => {
    title = title.replace(pattern, '');
  });
  // Remove time patterns
  title = title.replace(/\b\d{1,2}:?\d{0,2}\s*(am|pm)\b/gi, '');
  // Remove chrono-parseable date phrases
  title = title.replace(/\b(at|by|on|before|after|tomorrow|today|tonight|next\s+\w+)\b/gi, '');
  // Clean up whitespace
  title = title.replace(/\s+/g, ' ').trim();
  return title;
}

// ── Main Parser ────────────────────────────────────────────────────────────────

export function parseSentryInput(input: string): ParseResult {
  const trimmed = input.trim();

  // Extract priority (default: 3)
  const priorityMatch = trimmed.match(PRIORITY_REGEX);
  const priority = priorityMatch ? (parseInt(priorityMatch[1]) as 1 | 2 | 3 | 4) : 3;

  // Extract tags (exclude priority tag)
  const tags: string[] = [];
  let tagMatch;
  const tagRegex = /#([a-zA-Z][a-zA-Z0-9]*)/g;
  while ((tagMatch = tagRegex.exec(trimmed)) !== null) {
    const tag = tagMatch[1].toLowerCase();
    if (!tag.match(/^p[1-4]$/i)) {
      tags.push(tag);
    }
  }

  // Check for recurrence → Habit
  let recurrence: RecurrenceRule | null = null;
  for (const { pattern, getRule } of RECURRENCE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      recurrence = getRule(match);
      break;
    }
  }

  const title = cleanTitle(trimmed);

  if (recurrence) {
    // It's a HABIT
    const targetTime = extractTargetTime(trimmed) || '08:00';
    return {
      type: 'habit',
      data: {
        title,
        priority,
        tags,
        targetTime,
        recurrence,
        riskScore: 0,
        resilienceValue: 100,
        streakCount: 0,
        createdAt: Date.now(),
        isBreached: false,
        lastCompleted: null,
      } as Partial<Habit>,
    };
  } else {
    // It's a TASK — always resolve dates to the future
    const chronoParsed = chrono.parse(trimmed, new Date(), { forwardDate: true });
    const dueDate = chronoParsed.length > 0 ? chronoParsed[0].start.date().getTime() : null;

    return {
      type: 'task',
      data: {
        title,
        priority,
        tags,
        dueDate,
        status: 'pending',
        createdAt: Date.now(),
        completedAt: null,
      } as Partial<Task>,
    };
  }
}
