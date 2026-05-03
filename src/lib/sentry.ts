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

export interface SentryPart {
  id: string;
  type: 'recurrence' | 'priority' | 'tag' | 'date' | 'time';
  text: string;
}

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

export function extractSentryParts(input: string): SentryPart[] {
  const parts: SentryPart[] = [];
  const trimmed = input.trim();

  // Priority
  const pMatch = trimmed.match(PRIORITY_REGEX);
  if (pMatch) {
    parts.push({ id: `p-${pMatch[1]}`, type: 'priority', text: pMatch[0] });
  }

  // Tags
  let tMatch;
  const tRegex = /#([a-zA-Z][a-zA-Z0-9]*)/g;
  while ((tMatch = tRegex.exec(trimmed)) !== null) {
    if (!tMatch[1].match(/^p[1-4]$/i)) {
      parts.push({ id: `t-${tMatch[1]}`, type: 'tag', text: tMatch[0] });
    }
  }

  // Recurrence
  RECURRENCE_PATTERNS.forEach(({ pattern }, i) => {
    const match = trimmed.match(pattern);
    if (match) {
      parts.push({ id: `r-${i}`, type: 'recurrence', text: match[0] });
    }
  });

  // Time
  const timeMatch = trimmed.match(/\b\d{1,2}:?\d{0,2}\s*(am|pm)\b/gi);
  if (timeMatch) {
    timeMatch.forEach((m, i) => {
      parts.push({ id: `tm-${i}`, type: 'time', text: m });
    });
  }

  // Date phrases (tomorrow, today, friday, etc.)
  const chronoParsed = chrono.parse(trimmed, new Date(), { forwardDate: true });
  chronoParsed.forEach((p, i) => {
    // Only add if it's not already covered by time-only regex (avoid duplicates)
    if (!p.text.match(/^\d{1,2}:?\d{0,2}\s*(am|pm)$/i)) {
      parts.push({ id: `d-${i}`, type: 'date', text: p.text });
    }
  });

  return parts;
}

function cleanTitle(input: string, ignoredParts: string[] = []): string {
  let title = input;
  const allParts = extractSentryParts(input);
  
  allParts.forEach(part => {
    if (!ignoredParts.includes(part.id)) {
      // Escape for regex and remove only that instance
      const escaped = part.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      title = title.replace(new RegExp(escaped, 'i'), '');
    }
  });

  // Clean up whitespace
  title = title.replace(/\s+/g, ' ').trim();
  return title;
}

// ── Main Parser ────────────────────────────────────────────────────────────────

export function parseSentryInput(input: string, ignoredParts: string[] = []): ParseResult {
  const trimmed = input.trim();
  const allParts = extractSentryParts(input).filter(p => !ignoredParts.includes(p.id));

  // Extract priority (default: 3)
  const priorityPart = allParts.find(p => p.type === 'priority');
  const priority = priorityPart ? (parseInt(priorityPart.text.replace('#p', '')) as 1 | 2 | 3 | 4) : 3;

  // Extract tags
  const tags = allParts.filter(p => p.type === 'tag').map(p => p.text.replace('#', '').toLowerCase());

  // Check for recurrence → Habit
  let recurrence: RecurrenceRule | null = null;
  const recurrencePart = allParts.find(p => p.type === 'recurrence');
  if (recurrencePart) {
    for (const { pattern, getRule } of RECURRENCE_PATTERNS) {
      const match = recurrencePart.text.match(pattern);
      if (match) {
        recurrence = getRule(match);
        break;
      }
    }
  }

  const title = cleanTitle(trimmed, ignoredParts);

  if (recurrence) {
    // It's a HABIT
    // Find time part if not ignored
    const timePart = allParts.find(p => p.type === 'time');
    const targetTime = timePart ? extractTargetTime(timePart.text) || '08:00' : '08:00';
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
    const datePart = allParts.find(p => p.type === 'date' || p.type === 'time');
    let dueDate: number | null = null;
    if (datePart) {
      const chronoParsed = chrono.parse(datePart.text, new Date(), { forwardDate: true });
      if (chronoParsed.length > 0) {
      const start = chronoParsed[0].start;
      // If time is not specified, default to end of day (23:59:59)
      if (!start.isCertain('hour')) {
        (start as any).assign('hour', 23);
        (start as any).assign('minute', 59);
        (start as any).assign('second', 59);
      }
      dueDate = start.date().getTime();
      }
    }

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
