import test from "node:test";
import assert from "node:assert/strict";
import { extractNextNonceFromError, isNonceTooLowError } from "./managedSigner.js";

test("nonce-too-low errors are recognized across RPC formats", () => {
  assert.equal(
    isNonceTooLowError(new Error("failed to forward tx to sequencer, err: 'nonce too low: next nonce 6, tx nonce 5'")),
    true
  );
  assert.equal(
    isNonceTooLowError(new Error("Nonce provided for the transaction is lower than the current nonce of the account.")),
    true
  );
  assert.equal(isNonceTooLowError(new Error("insufficient funds for transfer")), false);
});

test("next nonce is extracted from Mantle sequencer errors", () => {
  assert.equal(
    extractNextNonceFromError(
      new Error("failed to forward tx to sequencer, err: 'nonce too low: next nonce 6, tx nonce 5'")
    ),
    6
  );
  assert.equal(extractNextNonceFromError(new Error("Nonce provided for the transaction is lower than current nonce.")), null);
});
