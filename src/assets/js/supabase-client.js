import { createClient } from "@supabase/supabase-js";

let client;

function readConfig() {
  const node = document.querySelector("#app-config");
  if (!node) throw new Error("Application configuration is missing.");
  return JSON.parse(node.textContent);
}

export function getSupabase() {
  if (client) return client;
  const { supabaseUrl, supabasePublishableKey } = readConfig();
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Supabase is not configured. Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY to .env, then rebuild.");
  }
  client = createClient(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  return client;
}

export async function ensureAnonymousSession() {
  const supabase = getSupabase();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (session) return session;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}

export async function rpc(name, parameters = {}) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc(name, parameters);
  if (error) throw error;
  return data;
}
