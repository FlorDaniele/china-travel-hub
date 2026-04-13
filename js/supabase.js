/**
 * supabase.js — Supabase client stub.
 * In the skeleton phase this module is not imported anywhere.
 * It will be wired up when Supabase integration begins.
 *
 * Uses the ESM CDN build so it works as an ES module without npm.
 */

import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

// Dynamic import from CDN (ESM build)
const { createClient } = await import(
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
);

export const db = createClient(SUPABASE_URL, SUPABASE_KEY);
