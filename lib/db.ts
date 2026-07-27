import 'server-only';
import { createClient } from '@supabase/supabase-js';

function required(name: 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY') {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

/** Admin client used only by route handlers and server components. Never import in client code. */
export function database() {
  return createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'mixroom-server' } },
  });
}

export function unwrap<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}
