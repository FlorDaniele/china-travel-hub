# China Travel Hub — Claude Code Instructions

## Project brief
Read the full project brief before starting any task. It is the single source of truth for all decisions: structure, features, visual design, database schema, and accessibility.
Brief URL: https://www.notion.so/339a7c7df45181bc96d2dc87fa261dac

## What we're building
A personal, mobile-first web app to plan and track a solo trip across China. Stack: HTML, CSS, Vanilla JavaScript, Supabase. Hosted on GitHub Pages.

## Non-negotiable rules

### Code style
- Vanilla JavaScript only. No frameworks, no React, no Vue, no jQuery.
- ES modules (import/export), not CommonJS (require).
- CSS custom properties (variables) for all colours and spacing. Define them in main.css.
- All colours must pass WCAG 2.1 AA contrast (minimum 4.5:1 for text).
- Touch targets minimum 44×44px on all interactive elements.
- All images must have descriptive alt text.
- Form inputs must have visible labels, not placeholder-only.

### File structure
Follow the structure defined in the brief exactly:
- `/css/` — one file per section (main, nav, overview, city, expenses, reminders)
- `/js/` — one file per section (app, supabase, storage, overview, city, expenses, reminders)
- `/assets/` — images only
- `config.js` — Supabase credentials only, never hardcoded in HTML or other JS files
- `BRIEF.md` — project brief reference copy (do not edit)

### Supabase
- Always import from `config.js`. Never hardcode credentials anywhere else.
- Every DB operation must have a try/catch. On failure, fall back to localStorage.
- Write to localStorage on every successful Supabase fetch (for offline support).

### Accessibility
- WCAG 2.1 Level AA is required, not optional.
- Every interactive element needs a visible focus state.
- Never convey information by colour alone — always pair with text or icon.

### Mobile-first
- Design at 390px width first, then scale up to 1280px.
- The floating bottom nav bar is the primary navigation on all screen sizes.

## Workflow rules
- Always read the brief before starting a new feature.
- Plan before coding: describe what files you'll touch and why before writing a single line.
- After implementing anything, verify it works: check the browser, check accessibility, check mobile layout.
- Commit after each completed feature, not at the end of a long session.
- Commit messages: use present tense, be specific. Example: "Add floating nav bar with 3 tabs"
- Never delete existing working code without asking first.
- If something is unclear, ask before building the wrong thing.

## Context-aware mode logic
The app has two modes: planning (before June 6 2026) and travel (from June 6 2026).
- Mode is stored in Supabase `settings` table (key: `mode`, key: `manual_mode_override`)
- Auto-switch based on date, manual override always available
- Overview tab renders differently depending on mode — check the brief for details

## Bilingual content
All place names, food items, and city names must show three versions:
1. English name (large)
2. 汉字 Hànzì (medium, same line or directly below)
3. Pīnyīn romanisation (small, below Hànzì)

## Do not
- Do not use any CSS framework (no Tailwind, no Bootstrap)
- Do not use any JS library except the Supabase client
- Do not hardcode any data — everything comes from Supabase
- Do not make the CLAUDE.md file longer than it needs to be
- Do not push config.js or CLAUDE.local.md to GitHub
