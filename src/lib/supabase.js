/*
 * Browser Supabase client — used for AUTH ONLY (sign in, session, password).
 * Uses the public anon key, which is designed to ship to browsers. All data
 * reads and writes still go through our backend, never directly to Supabase.
 */
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && key ? createClient(url, key) : null
export const authConfigured = Boolean(supabase)
