# China Travel Hub — Claude Code Instructions

This file is the operational source of truth for coding sessions. If anything here conflicts with the Notion brief, this file wins. The brief is background context (product vision, feature reasoning): https://www.notion.so/339a7c7df45181bc96d2dc87fa261dac

## Session opener (mandatory, every session)
1. Read this file in full.
2. Read `.claude/napkin.md` (curated runbook of past mistakes and fixes).
3. Run the branch check before touching any file:
```bash
git checkout -b feature/short-topic   # one short-lived branch per session
git branch                            # confirm you are NOT on main
```
4. Do not write any code until you have presented a plan and received explicit approval.

## What we're building
A personal, single-user web app to plan and track a solo trip across China (Beijing, Xi'an, Chengdu, Chongqing, Shanghai — June 6–25, 2026). It doubles as a portfolio case study documenting an AI-assisted design and development workflow, so code quality and visual polish are the product.

Live at: https://china-travel-hub.vercel.app

## Stack and hosting
- HTML, CSS, Vanilla JavaScript (ES modules). No build step except `build.sh`.
- Supabase (Postgres) backend. No auth — single user, RLS enabled with anon full-access policies.
- Hosted on Vercel. Every push to `main` auto-deploys.
- Credentials: production reads `window._env` (values injected into `env.js` by `build.sh` from Vercel env vars `SUPABASE_URL` / `SUPABASE_ANON_KEY`). Local dev falls back to `config.js` (gitignored). Never hardcode credentials anywhere else. Never commit `config.js` or `CLAUDE.local.md`.
- Local dev server: `python3 server.py [port]` (serves with no-cache headers). If the browser serves stale ES modules, switch to a new port to bust the module cache.

## File structure (real, current)
```
index.html          — all markup, both modes. Bottom nav is currently removed
                      (desktop mid-fidelity prototype); tab panels remain.
css/
  main.css          — design tokens, reset, typography, utilities. Tokens live here ONLY.
  overview.css      — desktop bento grid + most section styles (largest file)
  travel.css        — Travel mode sections
  modal.css         — modal + sidebar styles
  nav.css           — nav styles (nav currently removed from markup)
  city.css, expenses.css, reminders.css — stubs, do not build into these without asking
js/
  app.js            — entry point, tab switching, init
  supabase.js       — client singleton (env.js → config.js fallback)
  storage.js        — localStorage helpers, key prefix `cth_`
  overview.js       — Overview tab logic + hardcoded city display data (largest file)
  travel-steps.js, travel-transport.js, travel-hotels.js — Travel mode sections
  sidebar.js, modal.js
  city.js, expenses.js, reminders.js — stubs (TODO), deferred to V2. Do not implement unless explicitly asked.
assets/             — images, airline/rail logos (SVG), case-study screenshots
env.js, build.sh    — Vercel credential injection (committed)
server.py           — local no-cache dev server
.claude/napkin.md   — runbook, read at session start
```
New code for existing sections goes where that section already lives (`overview.*`, `travel.*`), not into the stub files. Before creating any new file, propose it in the plan and wait for approval.

## Design system (hard rules)

### Canonical palette — Chinese-inspired (defined in main.css)
- Terracotta `#ee6146` (`--terracotta`) — the ONLY active-state colour, across all components
- Golden yellow `#dfbc5e` (`--warm-gold`), parchment `#e6e0ae` (`--warm-gold-light`)
- Deep red `#d73c37`, dark red `#b51f09` — cultural accents only, NEVER error signals
- Text primary `#45455B` (`--text-primary`), text secondary `#6B6B80` (`--text-secondary`)
- Border `#E8E8E8` (`--border`), UI stroke `#C2C2C2` (`--border-ui`)
- Action links/buttons: Celadon Jade `--action #2E5C54` / `--action-hover #3D7268`
- Error states: neutral grey (`--status-error #888780`) only. Red is decoration, not danger.
- The legacy `--color-*` token set at the top of main.css is deprecated mobile-era styling. Do not use it in new code. Do not delete it without asking.

### Spacing and sizing
- Layout spacing: multiples of 8px. Component-internal spacing: multiples of 4px.
- Font sizes: multiples of 4px, 12px minimum. No exceptions.
- Global typography rule: no text inside a card may be equal to or larger than its section title.
- Any spacing or border-radius value introduced in one section must apply globally. Never invent a one-off value; check main.css tokens and existing CSS first, reuse what exists.
- Shadows: warm cream-toned only (`--shadow-*` in main.css). Never pure black shadows.
- Theme is light everywhere. Never apply dark styles to any component.

### Before any structural or style decision
Read the existing CSS first. If a style already exists (e.g. "View all →" link style), reference the same class or copy its exact property values. Never approximate from memory.

## Accessibility (WCAG 2.1 AA, required, not optional)
- All text colours ≥ 4.5:1 contrast on their background. Verify before committing any new colour.
- Touch targets ≥ 44×44px on interactive elements.
- Every interactive element has a visible focus state.
- Never convey information by colour alone — pair with text or icon.
- All images have descriptive alt text. Form inputs have visible labels, never placeholder-only.
- No scroll traps (WCAG 2.1 SC 2.5.5).

## Supabase
- Tables in use: `activities`, `bookings`, `daily_stats`, `hotels`, `itinerary`, `packing_list`, `reminders`, `settings`, `transports`, `trip_config`.
- `settings` holds `mode` and `manual_mode_override`. `trip_config` holds `demo_reference_date` (currently May 15 2026 — reference point for Reminders done/overdue/upcoming distribution) and departure date override.
- Every DB operation wrapped in try/catch. On failure, fall back to localStorage.
- Write to localStorage (prefix `cth_`, via storage.js helpers) on every successful fetch.
- Trip data (bookings, reminders, transports, hotels, stats, packing) comes from Supabase — never hardcode it. Static presentation content (city names/汉字/pīnyīn, image paths) may live in code as it does today.
- Schema changes are made via Supabase migrations outside this session flow; never alter the schema from app code.

## Modes
Two modes: planning (before June 6 2026) and travel (from June 6 2026). Auto-switch by date; manual override always wins. The Overview tab renders differently per mode — both modes must be verified after any Overview change.

## Bilingual content
All place names, food items, and city names show three versions:
1. English name (large)
2. 汉字 Hànzì (medium, same line or directly below)
3. Pīnyīn romanisation (small, below Hànzì)

## Responsive strategy
Desktop-first was a deliberate trade-off (documented in the case study). Desktop layout (1280px) is the baseline. Mobile is a delta pass — targeted overrides at <480px, not a rewrite. Do not restructure desktop CSS to "improve" mobile; add scoped overrides.

## Workflow rules (hard rules)
- Plan before coding: list every file you will touch and describe the approach. Wait for explicit approval before writing any code.
- `str_replace` edits only. Never rewrite a full file. Never output a full file unless explicitly asked.
- State the file path at the start of each edit block, before editing it.
- Never delete existing working code without asking first. Flag any deletion risk in the plan.
- If a screenshot is attached, it is labelled at the top of the prompt as the TARGET design. Match it; do not screenshot-guess current state — read the code instead.
- Features deferred to a future session get a `// TODO` comment, not a partial implementation.
- If something is unclear, ask before building the wrong thing.

## Branching and deployment
- Never commit directly to `main`. Vercel deploys every push to `main`.
- One session = one short-lived branch (`feature/short-topic` or `fix/short-topic`) = one merge = one deploy.
- End of session: commit, push the branch, squash-merge to `main`, then delete the branch locally and remotely.
- If working in a Claude Code worktree: after merging, copy changed files back to the main working directory so Live Server reflects them.
- Commit messages: conventional prefix + present tense + specific. Examples from history: `fix: checkbox color unified, checkmark optical alignment`, `feat: Vercel env vars support for Supabase connection`.
- Commit after each completed change set, not one giant commit at session end.

## Definition of done (run before calling any task finished)
1. The change matches the approved plan — nothing extra was touched.
2. `npx eslint js/` passes with no new errors.
3. Verified in the browser at 1280px AND at 390px (or confirmed the change is desktop-only and mobile is unaffected).
4. Both planning and travel modes checked if the Overview tab was touched.
5. New colours checked for ≥ 4.5:1 contrast; spacing/typography values are on the 8px/4px grid.
6. No text inside a card ≥ its section title size.
7. Focus states and keyboard access work on any new interactive element.
8. No console errors; Supabase failure path (localStorage fallback) not broken.
9. `config.js` and `CLAUDE.local.md` not staged.
10. Committed on the session branch with a conventional message.

## Do not
- Do not use any CSS framework (no Tailwind, no Bootstrap) or JS library except the Supabase client.
- Do not use React, Vue, jQuery, or CommonJS. ES modules only.
- Do not build the Expenses, City, or Reminders tabs — V2 scope, explicit request only.
- Do not use the deprecated `--color-*` legacy tokens in new code.
- Do not introduce new design-token values without approval.
- Do not push `config.js` or `CLAUDE.local.md` to GitHub.
- Do not make this file longer than it needs to be — when updating it, replace outdated rules instead of stacking new ones on top.
