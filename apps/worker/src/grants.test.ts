import test from "node:test";
import assert from "node:assert/strict";
import { privateKeyToAccount } from "viem/accounts";
import {
  authorizationDurationToHours,
  buildAuthorizationExpiresAt,
  buildAutomationGrantDraft,
  normalizeAuthorizationTtlHours,
  validateAuthorizationWindow,
  verifyAutomationGrantSignature,
} from "./grants";

const futureWindow = () => {
  const issuedAt = new Date(Date.now() - 60_000).toISOString();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return { issuedAt, expiresAt };
};

test("automation grant verifies for the signing owner", async () => {
  const account = privateKeyToAccount("0x59c6995e998f97a5a0044976f4d2c5f9b8f84f0cc1dce5b9b118db980361b1a6");
  const { issuedAt, expiresAt } = futureWindow();
  const draft = buildAutomationGrantDraft({
    ownerEoa: account.address,
    userId: "user_123",
    vaultId: "vault_123",
    vaultAddress: "0x1111111111111111111111111111111111111111",
    agentSubject: "erc8004:49",
    policyVersion: "vault-v1",
    allowedDomains: ["state", "execution"],
    issuedAt,
    expiresAt,
    nonce: "nonce_123",
  });

  const signature = await account.signMessage({ message: draft.message });
  const verified = await verifyAutomationGrantSignature({
    ownerEoa: draft.ownerEoa,
    userId: draft.userId,
    vaultId: draft.vaultId,
    vaultAddress: draft.vaultAddress,
    agentSubject: draft.agentSubject,
    policyVersion: draft.policyVersion,
    allowedDomains: draft.allowedDomains,
    nonce: draft.nonce,
    issuedAt: draft.issuedAt,
    expiresAt: draft.expiresAt,
    signature,
  });

  assert.equal(verified.ownerEoa, account.address.toLowerCase());
  assert.deepEqual(verified.allowedDomains, ["state", "execution"]);
});

test("automation grant rejects signatures from another wallet", async () => {
  const owner = privateKeyToAccount("0x59c6995e998f97a5a0044976f4d2c5f9b8f84f0cc1dce5b9b118db980361b1a6");
  const attacker = privateKeyToAccount("0x5de4111afa1a4b94908f831fdb9fee9601e606a9c7c3aff342a2e59954e07de7");
  const { issuedAt, expiresAt } = futureWindow();
  const draft = buildAutomationGrantDraft({
    ownerEoa: owner.address,
    userId: "user_456",
    vaultId: "vault_456",
    vaultAddress: "0x2222222222222222222222222222222222222222",
    agentSubject: "erc8004:49",
    policyVersion: "vault-v1",
    allowedDomains: ["benchmark"],
    issuedAt,
    expiresAt,
    nonce: "nonce_456",
  });

  const signature = await attacker.signMessage({ message: draft.message });

  await assert.rejects(
    () =>
      verifyAutomationGrantSignature({
        ownerEoa: draft.ownerEoa,
        userId: draft.userId,
        vaultId: draft.vaultId,
        vaultAddress: draft.vaultAddress,
        agentSubject: draft.agentSubject,
        policyVersion: draft.policyVersion,
        allowedDomains: draft.allowedDomains,
        nonce: draft.nonce,
        issuedAt: draft.issuedAt,
        expiresAt: draft.expiresAt,
        signature,
      }),
    /does not match the owner/
  );
});

test("automation grant rejects expired payloads", async () => {
  const account = privateKeyToAccount("0x59c6995e998f97a5a0044976f4d2c5f9b8f84f0cc1dce5b9b118db980361b1a6");
  const draft = buildAutomationGrantDraft({
    ownerEoa: account.address,
    userId: "user_789",
    vaultId: "vault_789",
    vaultAddress: "0x3333333333333333333333333333333333333333",
    agentSubject: "erc8004:49",
    policyVersion: "vault-v1",
    allowedDomains: ["config"],
    issuedAt: "2026-05-24T00:00:00.000Z",
    expiresAt: "2026-05-24T01:00:00.000Z",
    nonce: "nonce_789",
  });

  const signature = await account.signMessage({ message: draft.message });

  await assert.rejects(
    () =>
      verifyAutomationGrantSignature({
        ownerEoa: draft.ownerEoa,
        userId: draft.userId,
        vaultId: draft.vaultId,
        vaultAddress: draft.vaultAddress,
        agentSubject: draft.agentSubject,
        policyVersion: draft.policyVersion,
        allowedDomains: draft.allowedDomains,
        nonce: draft.nonce,
        issuedAt: draft.issuedAt,
        expiresAt: draft.expiresAt,
        signature,
      }),
    /already expired/
  );
});

test("authorization duration is bounded and produces a deterministic expiry", () => {
  const issuedAt = "2026-06-12T12:00:00.000Z";

  assert.equal(normalizeAuthorizationTtlHours(undefined), 12);
  assert.equal(normalizeAuthorizationTtlHours(72), 72);
  assert.equal(authorizationDurationToHours({ days: 1, hours: 12 }), 36);
  assert.equal(authorizationDurationToHours({ months: 1 }), 720);
  assert.equal(buildAuthorizationExpiresAt(issuedAt, 72), "2026-06-15T12:00:00.000Z");
  assert.equal(
    validateAuthorizationWindow(issuedAt, "2026-06-19T12:00:00.000Z"),
    "2026-06-19T12:00:00.000Z",
  );
  assert.throws(() => normalizeAuthorizationTtlHours(0), /between 1 and 8640 hours/);
  assert.throws(
    () => authorizationDurationToHours({ months: 12, hours: 1 }),
    /between 1 and 8640 hours/,
  );
});
