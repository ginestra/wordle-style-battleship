import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";

const binary = path.resolve("node_modules", ".bin", process.platform === "win32" ? "supabase.cmd" : "supabase");
const status = JSON.parse(execFileSync(binary, ["status", "-o", "json"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"]
}));

const result = spawnSync(process.execPath, ["scripts/smoke-supabase.js"], {
  env: {
    ...process.env,
    SUPABASE_URL: status.API_URL,
    SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY
  },
  stdio: "inherit"
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
