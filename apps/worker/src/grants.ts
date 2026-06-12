import { recoverMessageAddress } from "viem";

export const DEFAULT_AUTHORIZATION_TTL_HOURS = 12;
export const MIN_AUTHORIZATION_TTL_HOURS = 1;
export const AUTHORIZATION_HOURS_PER_DAY = 24;
export const AUTHORIZATION_DAYS_PER_MONTH = 30;
export const MAX_AUTHORIZATION_TTL_HOURS =
  12 * AUTHORIZATION_DAYS_PER_MONTH * AUTHORIZATION_HOURS_PER_DAY;
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_GRANT_TTL_MS = DEFAULT_AUTHORIZATION_TTL_HOURS * HOUR_MS;

export type AuthorizationDuration = {
  months?: number;
  days?: number;
  hours?: number;
};

export const authorizationDurationToHours = (duration: AuthorizationDuration) => {
  const months = duration.months ?? 0;
  const days = duration.days ?? 0;
  const hours = duration.hours ?? 0;
  if (
    !Number.isInteger(months) ||
    !Number.isInteger(days) ||
    !Number.isInteger(hours) ||
    months < 0 ||
    days < 0 ||
    hours < 0
  ) {
    throw new Error("Authorization months, days, and hours must be non-negative integers.");
  }
  return normalizeAuthorizationTtlHours(
    months * AUTHORIZATION_DAYS_PER_MONTH * AUTHORIZATION_HOURS_PER_DAY +
      days * AUTHORIZATION_HOURS_PER_DAY +
      hours
  );
};

export const normalizeAuthorizationTtlHours = (value: number | null | undefined) => {
  const ttlHours = value ?? DEFAULT_AUTHORIZATION_TTL_HOURS;
  if (
    !Number.isInteger(ttlHours) ||
    ttlHours < MIN_AUTHORIZATION_TTL_HOURS ||
    ttlHours > MAX_AUTHORIZATION_TTL_HOURS
  ) {
    throw new Error(
      `Authorization duration must be an integer between ${MIN_AUTHORIZATION_TTL_HOURS} and ${MAX_AUTHORIZATION_TTL_HOURS} hours.`
    );
  }
  return ttlHours;
};

export const buildAuthorizationExpiresAt = (issuedAt: string, ttlHours: number) => {
  const issuedAtMs = Date.parse(issuedAt);
  if (!Number.isFinite(issuedAtMs)) {
    throw new Error("Authorization issuedAt is invalid.");
  }
  return new Date(issuedAtMs + normalizeAuthorizationTtlHours(ttlHours) * HOUR_MS).toISOString();
};

export const validateAuthorizationWindow = (issuedAt: string, expiresAt: string) => {
  const issuedAtMs = Date.parse(issuedAt);
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(issuedAtMs) || !Number.isFinite(expiresAtMs)) {
    throw new Error("Authorization timestamps are invalid.");
  }
  const durationHours = (expiresAtMs - issuedAtMs) / HOUR_MS;
  if (
    durationHours < MIN_AUTHORIZATION_TTL_HOURS ||
    durationHours > MAX_AUTHORIZATION_TTL_HOURS
  ) {
    throw new Error(
      `Authorization duration must be between ${MIN_AUTHORIZATION_TTL_HOURS} and ${MAX_AUTHORIZATION_TTL_HOURS} hours.`
    );
  }
  return expiresAt;
};

export const AUTOMATION_GRANT_DOMAIN_VALUES = [
  "state",
  "config",
  "benchmark",
  "execution",
] as const;

export type AutomationGrantDomain = (typeof AUTOMATION_GRANT_DOMAIN_VALUES)[number];

export type AutomationGrantDraft = {
  ownerEoa: string;
  userId: string;
  vaultId: string;
  vaultAddress: string;
  agentSubject: string;
  policyVersion: string;
  allowedDomains: AutomationGrantDomain[];
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  message: string;
};

type VerifyAutomationGrantArgs = Omit<AutomationGrantDraft, "message"> & {
  signature: string;
};

const normalizeAddress = (value: string) => value.trim().toLowerCase();

const uniqueDomains = (domains: readonly string[]) => {
  const normalized = domains
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is AutomationGrantDomain =>
      (AUTOMATION_GRANT_DOMAIN_VALUES as readonly string[]).includes(value)
    );
  return Array.from(new Set(normalized));
};

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const buildAutomationGrantMessage = (draft: Omit<AutomationGrantDraft, "message">) =>
  [
    "NeuralRate MCP Automation Grant",
    `Owner: ${normalizeAddress(draft.ownerEoa)}`,
    `User ID: ${draft.userId}`,
    `Vault ID: ${draft.vaultId}`,
    `Vault Address: ${normalizeAddress(draft.vaultAddress)}`,
    `Agent Subject: ${draft.agentSubject}`,
    `Policy Version: ${draft.policyVersion}`,
    `Allowed Domains: ${draft.allowedDomains.join(",")}`,
    `Nonce: ${draft.nonce}`,
    `Issued At: ${draft.issuedAt}`,
    `Expires At: ${draft.expiresAt}`,
    "Chain ID: 5003",
    "Statement: I grant NeuralRate MCP scoped automation authority for this vault within the stated domains and limits.",
  ].join("\n");

export const buildAutomationGrantDraft = (args: {
  ownerEoa: string;
  userId: string;
  vaultId: string;
  vaultAddress: string;
  agentSubject: string;
  policyVersion: string;
  allowedDomains?: string[];
  issuedAt?: string;
  expiresAt?: string;
  nonce?: string;
}) => {
  const issuedAt = args.issuedAt ?? new Date().toISOString();
  const expiresAt = args.expiresAt ?? new Date(Date.now() + DEFAULT_GRANT_TTL_MS).toISOString();
  const allowedDomains = uniqueDomains(
    args.allowedDomains?.length ? args.allowedDomains : AUTOMATION_GRANT_DOMAIN_VALUES
  );

  const draft = {
    ownerEoa: normalizeAddress(args.ownerEoa),
    userId: args.userId,
    vaultId: args.vaultId,
    vaultAddress: normalizeAddress(args.vaultAddress),
    agentSubject: args.agentSubject.trim(),
    policyVersion: args.policyVersion.trim(),
    allowedDomains,
    nonce: args.nonce ?? crypto.randomUUID(),
    issuedAt,
    expiresAt,
  } satisfies Omit<AutomationGrantDraft, "message">;

  return {
    ...draft,
    message: buildAutomationGrantMessage(draft),
  } satisfies AutomationGrantDraft;
};

export async function verifyAutomationGrantSignature(args: VerifyAutomationGrantArgs) {
  const allowedDomains = uniqueDomains(args.allowedDomains);
  if (allowedDomains.length === 0) {
    throw new Error("Grant must include at least one allowed domain.");
  }

  const issuedAtTs = Date.parse(args.issuedAt);
  const expiresAtTs = Date.parse(args.expiresAt);
  if (!Number.isFinite(issuedAtTs) || !Number.isFinite(expiresAtTs)) {
    throw new Error("Grant timestamps are invalid.");
  }
  if (expiresAtTs <= issuedAtTs) {
    throw new Error("Grant expiresAt must be later than issuedAt.");
  }
  if (expiresAtTs < Date.now()) {
    throw new Error("Grant has already expired.");
  }

  const message = buildAutomationGrantMessage({
    ownerEoa: args.ownerEoa,
    userId: args.userId,
    vaultId: args.vaultId,
    vaultAddress: args.vaultAddress,
    agentSubject: args.agentSubject,
    policyVersion: args.policyVersion,
    allowedDomains,
    nonce: args.nonce,
    issuedAt: args.issuedAt,
    expiresAt: args.expiresAt,
  });

  const recovered = await recoverMessageAddress({
    message,
    signature: args.signature as `0x${string}`,
  });

  if (normalizeAddress(recovered) !== normalizeAddress(args.ownerEoa)) {
    throw new Error("Grant signature does not match the owner.");
  }

  return {
    ownerEoa: normalizeAddress(args.ownerEoa),
    vaultAddress: normalizeAddress(args.vaultAddress),
    allowedDomains,
    message,
    recoveredOwner: normalizeAddress(recovered),
  };
}

export async function hashSessionToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const createSessionToken = () => `nrmcp_${randomToken()}`;
