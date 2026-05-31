#!/bin/bash
sed -i "s|%%SUPABASE_URL%%|${SUPABASE_URL}|g" env.js
sed -i "s|%%SUPABASE_ANON_KEY%%|${SUPABASE_ANON_KEY}|g" env.js
