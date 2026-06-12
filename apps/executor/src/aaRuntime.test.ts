import test from "node:test";
import assert from "node:assert/strict";
import type { Address, Hex } from "viem";
import type { UserOperation } from "viem/account-abstraction";
import {
  SAFE7579_STUB_SIGNATURE,
  signPreparedSafe7579UserOperation,
} from "./aaRuntime.js";

const makePreparedUserOperation = (signature: Hex = SAFE7579_STUB_SIGNATURE) => ({
  sender: "0x1111111111111111111111111111111111111111" as Address,
  nonce: 1n,
  factory: undefined,
  factoryData: undefined,
  callData: "0x" as Hex,
  callGasLimit: 100_000n,
  verificationGasLimit: 100_000n,
  preVerificationGas: 50_000n,
  maxFeePerGas: 1_000_000n,
  maxPriorityFeePerGas: 1_000n,
  paymaster: undefined,
  paymasterVerificationGasLimit: undefined,
  paymasterPostOpGasLimit: undefined,
  paymasterData: undefined,
  signature,
}) satisfies UserOperation<"0.7">;

test("signPreparedSafe7579UserOperation replaces the stub signature before submission", async () => {
  const realSignature = `0x${"22".repeat(65)}` as Hex;
  const calls: Array<UserOperation<"0.7"> & { chainId?: number }> = [];
  const account = {
    async signUserOperation(parameters: UserOperation<"0.7"> & { chainId?: number }) {
      calls.push(parameters);
      return realSignature;
    },
  };

  const prepared = makePreparedUserOperation();
  const signed = await signPreparedSafe7579UserOperation(account, prepared, 5003);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.signature, SAFE7579_STUB_SIGNATURE);
  assert.equal(calls[0]?.chainId, 5003);
  assert.equal(signed.signature, realSignature);
});

test("signPreparedSafe7579UserOperation refuses to submit a final stub signature", async () => {
  const account = {
    async signUserOperation() {
      return SAFE7579_STUB_SIGNATURE;
    },
  };

  await assert.rejects(
    () => signPreparedSafe7579UserOperation(account, makePreparedUserOperation(), 5003),
    /stub signature/
  );
});
