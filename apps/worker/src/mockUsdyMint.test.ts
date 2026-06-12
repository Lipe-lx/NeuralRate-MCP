import test from "node:test";
import assert from "node:assert/strict";
import { prepareMockUsdYMintTransaction } from "./mockUsdyMint";
import type { ScopedAutomationAccess } from "./automationControl";

const makeAccess = (): ScopedAutomationAccess => ({
  ownerEoa: "0xc57130f28f3d670ca75ad9a78784966b767e55e3",
  userId: "user_1",
  vaultId: "vault_1",
  vaultAddress: "0x1111111111111111111111111111111111111111",
  agentSubject: "erc8004:49",
  policyVersion: "vault-v1",
  sessionId: "session_1",
  grantId: "grant_1",
  allowedDomains: ["execution"],
  grantExpiresAt: "2026-06-06T00:00:00.000Z",
  authMode: "session",
});

test("prepareMockUsdYMintTransaction returns a wallet-signable mint request to the vault by default", () => {
  const result = prepareMockUsdYMintTransaction(
    {
      NEURALRATE_USDY_TOKEN_ADDRESS: "0x2222222222222222222222222222222222222222",
      NEURALRATE_CHAIN_ID: "5003",
    },
    makeAccess(),
    { amountToken: 25 },
  );

  assert.equal(result.success, true);
  assert.equal(result.mockOnly, true);
  assert.equal(result.token.address, "0x2222222222222222222222222222222222222222");
  assert.equal(result.recipientAddress, "0x1111111111111111111111111111111111111111");
  assert.equal(result.amountRaw, "25000000000000000000");
  assert.equal(result.transactionRequest.from, makeAccess().ownerEoa);
  assert.equal(result.transactionRequest.to, "0x2222222222222222222222222222222222222222");
  assert.match(result.transactionRequest.data, /^0x40c10f19/);
});

test("prepareMockUsdYMintTransaction rejects missing token configuration", () => {
  assert.throws(
    () => prepareMockUsdYMintTransaction({}, makeAccess(), { amountToken: 25 }),
    /NEURALRATE_USDY_TOKEN_ADDRESS/,
  );
});
