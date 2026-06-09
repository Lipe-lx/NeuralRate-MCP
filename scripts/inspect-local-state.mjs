import fs from "fs";

const ownerEoa = "0x54fcb49cd7281140e17721f65f00e49a809400bc";
const dbState = JSON.parse(fs.readFileSync("scripts/user-db-state.json", "utf8"));

const asString = (value) => (typeof value === "string" ? value : "");
const asNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const asJson = (str, fallback) => {
  try {
    return str ? JSON.parse(str) : fallback;
  } catch {
    return fallback;
  }
};

const normalizeRecord = (record) => {
  if (!record) return null;
  return {
    ...record,
    allowed_contracts: asJson(record.allowed_contracts_json, []),
    allowed_selectors: asJson(record.allowed_selectors_json, []),
    allowed_assets: asJson(record.allowed_assets_json, []),
    denied_assets: asJson(record.denied_assets_json, []),
    allowed_protocols: asJson(record.allowed_protocols_json, []),
    denied_protocols: asJson(record.denied_protocols_json, []),
    allowed_domains: asJson(record.allowed_domains_json, []),
    raw_policy: asJson(record.raw_policy_json, {}),
    session_details: asJson(record.session_details_json, null),
    payload: asJson(record.payload_json, {}),
    last_funding_intent: asJson(record.last_funding_intent_json, null),
    applied_constraints: asJson(record.applied_constraints_json, {}),
    rationale: asJson(record.rationale_json, {}),
  };
};

const getActiveAutomationGrant = (grants) => {
  const now = new Date().toISOString();
  return grants
    .map(normalizeRecord)
    .filter((g) => g && g.status === 'active' && g.revoked_at === null && g.expires_at >= now)
    .sort((a, b) => b.id - a.id)[0] || null;
};

const getActiveMcpMutationSession = (sessions) => {
  const now = new Date().toISOString();
  return sessions
    .map(normalizeRecord)
    .filter((s) => s && s.status === 'active' && s.revoked_at === null && s.expires_at >= now)
    .sort((a, b) => b.id - a.id)[0] || null;
};

const isActiveScopedDomain = (record, requiredDomain) =>
  asString(record?.status) === "active" &&
  Array.isArray(record?.allowed_domains) &&
  (record.allowed_domains).map((value) => String(value)).includes(requiredDomain);

const isPolicyActiveNow = (policy, nowMs) => {
  if (!policy) return false;
  const validAfter = asNumber(policy.validAfter);
  const validUntil = asNumber(policy.validUntil);
  if (validAfter > 0 && nowMs < validAfter * 1000) return false;
  if (validUntil > 0 && nowMs > validUntil * 1000) return false;
  return true;
};

// Find vault/config
const vault = dbState.user_vaults[0] || null;
const config = dbState.user_agent_configs[0] || null;
const activeGrant = getActiveAutomationGrant(dbState.automation_grants);
const activeMcpSession = getActiveMcpMutationSession(dbState.mcp_mutation_sessions);

console.log("Vault:", vault ? vault.vault_address : "null");
console.log("Active Grant:", activeGrant ? activeGrant.grant_id : "null");
console.log("Active MCP Session:", activeMcpSession ? activeMcpSession.session_id : "null");

console.log("--- Checks ---");
console.log("vault?.vault_id:", Boolean(vault?.vault_id));
console.log("config?.user_id:", Boolean(config?.user_id));
console.log("activeGrant status:", activeGrant?.status);
console.log("activeGrant allowed_domains:", activeGrant?.allowed_domains);
console.log("isActiveScopedDomain(activeGrant, 'execution'):", isActiveScopedDomain(activeGrant, "execution"));
console.log("activeMcpSession status:", activeMcpSession?.status);
console.log("activeMcpSession allowed_domains:", activeMcpSession?.allowed_domains);
console.log("isActiveScopedDomain(activeMcpSession, 'execution'):", isActiveScopedDomain(activeMcpSession, "execution"));

// Policy checks
const policy = dbState.automation_policies.find(p => p.status === 'active');
console.log("Active policy found:", Boolean(policy));
if (policy) {
  console.log("Policy validity after:", policy.valid_after);
  console.log("Policy validity until:", policy.valid_until);
}
