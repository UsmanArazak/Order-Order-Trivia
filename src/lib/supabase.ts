import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isConfigured) {
  console.warn(
    'Supabase URL or Anon Key is missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file to connect to the database.'
  );
}

// Export the client. If not configured, we cast null as any to satisfy typescript,
// but we check this in the components to display a clear configuration warning instead of crashing.
export const supabase = isConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as any);

export const hasSupabaseConfig = isConfigured;
