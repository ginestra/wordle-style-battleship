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
  const storageKey = authStorageKeyForHash(location.hash);
  client = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      ...(storageKey ? { storageKey } : {})
    }
  });
  return client;
}

export function authStorageKeyForHash(hash) {
  const parameters = new URLSearchParams(String(hash || "").replace(/^#/, ""));
  const gameId = parameters.get("game");
  const isGuest = parameters.has("join") || parameters.get("player") === "guest";
  const isUuid = gameId && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(gameId);
  if (!isUuid || !isGuest) return null;
  // A room-specific key keeps the guest separate from a creator in the same browser.
  return `fleet-guest-${gameId}`;
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
