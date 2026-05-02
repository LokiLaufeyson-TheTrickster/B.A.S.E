# B.A.S.E. — Behavioral Analysis & Systematic Enforcement

A hostile, AI-powered behavioral warfare engine. Track habits, enforce deadlines, and confront your own excuses through an interrogation-style AI partner.

**No comfort. No motivation. Just data and accountability.**

---

## What It Does

- **Habit Tracking** — Lock habits with time targets, frequency, priority, and tags. The system monitors your compliance and calculates risk scores.
- **Task Management** — NLP-powered input parses natural language ("Submit report friday #p2 #work") into structured tasks with deadlines.
- **Thinking Partner** — An AI-powered hostile auditor that confronts you when you're failing. Uses your actual data (risk score, resilience, streak) against you.
- **Risk Engine** — Calculates per-habit risk based on completion patterns. Miss your window? Risk climbs. Skip days? Resilience drops.
- **Breach Detection** — When a habit crosses the risk threshold, the system triggers a breach overlay forcing confrontation.
- **Dojo** — Audio track management for focus/motivation sessions.

## AI Architecture

Multi-provider fallback chain:

```
Gemini 2.5 Flash (Primary)
    ↓ fails/disabled/rate-limited
OpenRouter Model #1
    ↓ fails
OpenRouter Model #2...N
    ↓ all fail
Offline Pattern-Matching Fallback
```

- **Gemini** can be enabled/disabled from Settings
- **OpenRouter** supports unlimited model strings in priority order
- **Connection Testing** — Per-model "Test" button validates connectivity
- **Provider status** only shows ACTIVE after at least 1 model passes a live test
- All API keys stored client-side in `localStorage` — never sent to any server

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) |
| Database | Dexie.js (IndexedDB) |
| AI | Gemini API + OpenRouter API |
| NLP Parser | chrono-node (date parsing) |
| Styling | Vanilla CSS — tactical brutalism palette |
| State | Local-first, zero backend |

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### API Keys (Optional)

Click ⚙ in the header to configure:
- **Gemini API Key** — Get from [aistudio.google.com](https://aistudio.google.com/apikey)
- **OpenRouter API Key** — Get from [openrouter.ai](https://openrouter.ai/keys)

Without keys, the Thinking Partner uses offline pattern-matching fallback.

## Input Syntax

```
Cold shower 6am everyday #p1 #discipline #health    → Habit
Submit report friday #p2 #work                      → Task (next Friday)
Buy groceries tomorrow #p3 #errand                  → Task (tomorrow)
Read 30 pages 9pm weekdays #p2 #growth              → Habit (Mon-Fri)
```

## Design Philosophy

**Tactical Brutalism.** Black/white/crimson. Monospace typography. No rounded corners on your excuses. The interface is deliberately hostile — it's a tool for people who are tired of gentle productivity apps that let them fail quietly.

---

*Built with zero patience for mediocrity.*
