import test from "node:test";
import assert from "node:assert/strict";
import {
  isVaultModuleProtocol,
  isVaultModuleStrategy,
  shouldUseAARuntimeForPlan,
  shouldUseAARuntimeForStrategy,
} from "./executionRouting.js";

test("VaultModule strategies stay on the legacy signer path", () => {
  assert.equal(isVaultModuleStrategy("mnt-native-transfer"), true);
  assert.equal(isVaultModuleStrategy("usdy-vault-transfer"), true);
  assert.equal(shouldUseAARuntimeForStrategy({
    runtimeCanUseAA: true,
    strategyKey: "mnt-native-transfer",
  }), false);
});

test("VaultModule execution plans do not use Safe7579 AA wrapping", () => {
  assert.equal(isVaultModuleProtocol("neuralrate-vault-module"), true);
  assert.equal(shouldUseAARuntimeForPlan({
    runtimeCanUseAA: true,
    protocolId: "neuralrate-vault-module",
  }), false);
});

test("non-VaultModule plans can still use AA when the runtime supports it", () => {
  assert.equal(shouldUseAARuntimeForPlan({
    runtimeCanUseAA: true,
    protocolId: "neuralrate-usdy-adapter",
  }), true);
  assert.equal(shouldUseAARuntimeForPlan({
    runtimeCanUseAA: false,
    protocolId: "neuralrate-usdy-adapter",
  }), false);
});
