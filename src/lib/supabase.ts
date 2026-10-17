import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill them in, then restart npm run dev.',
  )
}

// Only the public (anon/publishable) key belongs in the browser. Never put the service_role / secret key here.
export const supabase = createClient(url, anonKey)
