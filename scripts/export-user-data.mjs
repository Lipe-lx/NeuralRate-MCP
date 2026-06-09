import { execSync } from "child_process";
import fs from "fs";

const ownerEoa = "0x54fcb49cd7281140e17721f65f00e49a809400bc";

const tables = [
  "user_profiles",
  "user_agent_configs",
  "user_vaults",
  "user_accounts",
  "vault_permissions",
  "automation_policies",
  "automation_sessions",
  "automation_jobs",
  "benchmark_jobs",
  "automation_grants",
  "mcp_mutation_sessions"
];

const dbState = {};

for (const table of tables) {
  try {
    const command = `npx wrangler d1 execute neuralrate-decisions --remote --command "SELECT * FROM ${table} WHERE owner_eoa = '${ownerEoa}'" --json`;
    const output = execSync(command, { encoding: "utf8" });
    const parsed = JSON.parse(output);
    dbState[table] = parsed[0]?.results || [];
  } catch (e) {
    console.error(`Failed to export table ${table}:`, e.message);
    dbState[table] = [];
  }
}

fs.writeFileSync("scripts/user-db-state.json", JSON.stringify(dbState, null, 2));
console.log("Exported user DB state to scripts/user-db-state.json");
