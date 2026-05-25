import { recoverMessageAddress } from "viem";

const AUTH_NONCE_TTL_MS = 5 * 60 * 1000;
const AUTH_STATEMENT = "Authorize this NeuralRate mutation request on Mantle.";

export type MutationAuthEnvelope = {
  ownerEoa: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  signature: string;
};

type AuthNonceRecord = {
  owner_eoa: string;
  nonce: string;
  statement: string;
  issued_at: string;
  expires_at: string;
  used_at: string | null;
};

const normalizeAddress = (value: string) => value.trim().toLowerCase();

export const buildMutationAuthMessage = (args: {
  ownerEoa: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  statement?: string;
}) =>
  [
    "NeuralRate Mutation Authorization",
    `Owner: ${normalizeAddress(args.ownerEoa)}`,
    `Nonce: ${args.nonce}`,
    `Issued At: ${args.issuedAt}`,
    `Expires At: ${args.expiresAt}`,
    "Chain ID: 5003",
    `Statement: ${args.statement ?? AUTH_STATEMENT}`,
  ].join("\n");

export const isInternalMutationRequest = (request: Request, internalToken?: string | null) => {
  if (!internalToken) {
    return false;
  }

  const providedToken = request.headers.get("x-neuralrate-internal-token")?.trim();
  return Boolean(providedToken) && providedToken === internalToken;
};

export async function issueMutationNonce(db: D1Database, ownerEoa: string) {
  const normalizedOwner = normalizeAddress(ownerEoa);
  const nonce = crypto.randomUUID();
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + AUTH_NONCE_TTL_MS).toISOString();

  await db
    .prepare(`
      INSERT INTO auth_nonces (owner_eoa, nonce, statement, issued_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `)
    .bind(normalizedOwner, nonce, AUTH_STATEMENT, issuedAt, expiresAt)
    .run();

  return {
    ownerEoa: normalizedOwner,
    nonce,
    statement: AUTH_STATEMENT,
    issuedAt,
    expiresAt,
    message: buildMutationAuthMessage({
      ownerEoa: normalizedOwner,
      nonce,
      issuedAt,
      expiresAt,
    }),
  };
}

const getNonceRecord = async (db: D1Database, nonce: string) =>
  db.prepare("SELECT * FROM auth_nonces WHERE nonce = ? LIMIT 1").bind(nonce).first<AuthNonceRecord>();

const consumeNonce = async (db: D1Database, nonce: string) => {
  const usedAt = new Date().toISOString();
  const result = await db
    .prepare("UPDATE auth_nonces SET used_at = ? WHERE nonce = ? AND used_at IS NULL")
    .bind(usedAt, nonce)
    .run();

  const changes = Number((result as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0);
  if (!result.success || changes === 0) {
    throw new Error("Failed to consume auth nonce.");
  }
};

export async function verifyMutationAuthEnvelope(db: D1Database, auth: MutationAuthEnvelope, expectedOwnerEoa: string) {
  const normalizedOwner = normalizeAddress(expectedOwnerEoa);
  if (normalizeAddress(auth.ownerEoa) !== normalizedOwner) {
    throw new Error("Signed owner does not match the mutation owner.");
  }

  const nonceRecord = await getNonceRecord(db, auth.nonce);
  if (!nonceRecord) {
    throw new Error("Auth nonce was not issued.");
  }

  if (normalizeAddress(nonceRecord.owner_eoa) !== normalizedOwner) {
    throw new Error("Auth nonce owner mismatch.");
  }

  if (nonceRecord.used_at) {
    throw new Error("Auth nonce has already been used.");
  }

  if (nonceRecord.issued_at !== auth.issuedAt || nonceRecord.expires_at !== auth.expiresAt) {
    throw new Error("Auth nonce timestamps do not match the signed payload.");
  }

  const expiresAtTs = Date.parse(nonceRecord.expires_at);
  if (!Number.isFinite(expiresAtTs) || expiresAtTs < Date.now()) {
    throw new Error("Auth nonce has expired.");
  }

  const message = buildMutationAuthMessage({
    ownerEoa: nonceRecord.owner_eoa,
    nonce: nonceRecord.nonce,
    issuedAt: nonceRecord.issued_at,
    expiresAt: nonceRecord.expires_at,
    statement: nonceRecord.statement,
  });

  const recovered = await recoverMessageAddress({
    message,
    signature: auth.signature as `0x${string}`,
  });

  if (normalizeAddress(recovered) !== normalizedOwner) {
    throw new Error("Mutation signature does not match the owner.");
  }

  await consumeNonce(db, auth.nonce);

  return {
    ownerEoa: normalizedOwner,
    message,
  };
}
