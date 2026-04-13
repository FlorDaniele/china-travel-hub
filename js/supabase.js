/* ============================================================
   SUPABASE.JS — Supabase client singleton
   Imported by all modules that need database access.
   Credentials come from config.js (gitignored).
   ============================================================ */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
