# Napkin Runbook — China Travel Hub

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)

1. **[2026-05-26] Browser caches ES modules aggressively**
   Do instead: switch preview server to a new port (e.g. 8002 vs 8001) to bust the module registry. Revert after confirming fix.

2. **[2026-05-26] Nav bar must be light theme (white/frosted glass pill)**
   Do instead: never apply dark styles to the nav bar. Entire app is light theme.

## Supabase Patterns

1. **[2026-05-26] Always wrap DB ops in try/catch and fall back to localStorage**
   Do instead: every Supabase query uses try/catch; on catch, read/write localStorage.

2. **[2026-05-26] Never hardcode Supabase credentials outside config.js**
   Do instead: import from config.js only. config.js is gitignored.

## Code Style Guardrails

1. **[2026-05-26] Vanilla JS only — no frameworks, no jQuery**
   Do instead: ES modules (import/export), CSS custom properties, zero dependencies except Supabase client.

2. **[2026-05-26] All colours must pass WCAG 2.1 AA (4.5:1 minimum)**
   Do instead: use --text-primary (#45455B) and --text-secondary (#6B6B80) on white backgrounds. Check new colours before committing.

## User Directives

1. **[2026-05-26] Plan before coding — list files to touch, wait for approval**
   Do instead: always describe every file/table change before writing a single line of code.

2. **[2026-05-26] Always tell user which file is being edited before editing it**
   Do instead: state the file path at the start of each edit block.

3. **[2026-05-26] Never delete working code without asking first**
   Do instead: flag any deletion risk before making it.
