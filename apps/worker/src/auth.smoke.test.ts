import test from "node:test";
import assert from "node:assert/strict";
import { privateKeyToAccount } from "viem/accounts";
import { issueMutationNonce, verifyMutationAuthEnvelope } from "./auth";

type NonceRecord = {
  owner_eoa: string;
  nonce: string;
  statement: string;
  issued_at: string;
  expires_at: string;
  used_at: string | null;
};

class FakeStatement {
  private bindings: unknown[] = [];

  constructor(
    private sql: string,
    private store: Map<string, NonceRecord>,
  ) {}

  bind(...values: unknown[]) {
    this.bindings = values;
    return this;
  }

  async run() {
    let changes = 0;
    if (this.sql.includes("INSERT INTO auth_nonces")) {
      const [owner, nonce, statement, issuedAt, expiresAt] = this.bindings as string[];
      this.store.set(nonce, {
        owner_eoa: owner,
        nonce,
        statement,
        issued_at: issuedAt,
        expires_at: expiresAt,
        used_at: null,
      });
      changes = 1;
    }

    if (this.sql.includes("UPDATE auth_nonces SET used_at")) {
      const [usedAt, nonce] = this.bindings as string[];
      const current = this.store.get(nonce);
      if (current && !current.used_at) {
        current.used_at = usedAt;
        this.store.set(nonce, current);
        changes = 1;
      }
    }

    return { success: true, meta: { changes } };
  }

  async first<T>() {
    const nonce = String(this.bindings[0] ?? "");
    return (this.store.get(nonce) ?? null) as T | null;
  }
}

class FakeD1Database {
  private store = new Map<string, NonceRecord>();

  prepare(sql: string) {
    return new FakeStatement(sql, this.store);
  }
}

test("auth smoke: valid signature succeeds and replay is blocked", async () => {
  const db = new FakeD1Database() as unknown as D1Database;
  const owner = privateKeyToAccount("0x59c6995e998f97a5a0044976f4d2c5f9b8f84f0cc1dce5b9b118db980361b1a6");

  const challenge = await issueMutationNonce(db, owner.address);
  const signature = await owner.signMessage({ message: challenge.message });

  const verified = await verifyMutationAuthEnvelope(
    db,
    {
      ownerEoa: challenge.ownerEoa,
      nonce: challenge.nonce,
      issuedAt: challenge.issuedAt,
      expiresAt: challenge.expiresAt,
      signature,
    },
    owner.address,
  );
  assert.equal(verified.ownerEoa, owner.address.toLowerCase());

  await assert.rejects(
    () =>
      verifyMutationAuthEnvelope(
        db,
        {
          ownerEoa: challenge.ownerEoa,
          nonce: challenge.nonce,
          issuedAt: challenge.issuedAt,
          expiresAt: challenge.expiresAt,
          signature,
        },
        owner.address,
      ),
    /already been used/,
  );
});

test("auth smoke: wrong signer is rejected", async () => {
  const db = new FakeD1Database() as unknown as D1Database;
  const owner = privateKeyToAccount("0x59c6995e998f97a5a0044976f4d2c5f9b8f84f0cc1dce5b9b118db980361b1a6");
  const attacker = privateKeyToAccount("0x8b3a350cf5c34c9194ca3a545d5aa2d4f7a2f6f8a9d969f3d4f0f30b3492fcbf");

  const challenge = await issueMutationNonce(db, owner.address);
  const forgedSignature = await attacker.signMessage({ message: challenge.message });

  await assert.rejects(
    () =>
      verifyMutationAuthEnvelope(
        db,
        {
          ownerEoa: challenge.ownerEoa,
          nonce: challenge.nonce,
          issuedAt: challenge.issuedAt,
          expiresAt: challenge.expiresAt,
          signature: forgedSignature,
        },
        owner.address,
      ),
    /does not match the owner/,
  );
});
