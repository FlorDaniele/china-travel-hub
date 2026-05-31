/* ============================================================
   SUPABASE.JS — Supabase client singleton
   In production (Vercel): credentials come from window._env,
   injected via env.js at build time.
   Locally: falls back to config.js (gitignored).
   ============================================================ */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

function getEnvVar(key) {
  if (window._env && window._env[key] && !window._env[key].startsWith('%%')) {
    return window._env[key];
  }
  return null;
}

let supabaseUrl = getEnvVar('SUPABASE_URL');
let supabaseKey = getEnvVar('SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseKey) {
  try {
    const { SUPABASE_URL, SUPABASE_KEY } = await import('../config.js');
    supabaseUrl = supabaseUrl || SUPABASE_URL;
    supabaseKey = supabaseKey || SUPABASE_KEY;
  } catch {
    console.warn('supabase.js: config.js not found and window._env not set. Supabase will not connect.');
  }
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');
