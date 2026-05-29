# Smart Contracts

**Status:** Canonical doc

NeuralRate now centers its automation trust model on four Solidity surfaces in the repository, plus one preserved strategy adapter.

## Contract Inventory

### 1. `NeuralRatePolicyRegistry.sol`

- file: `contracts/contracts/NeuralRatePolicyRegistry.sol`
- role: active on-chain policy registry per owner vault

What it does:

- stores the active policy for a vault
- records the authorized delegate for autonomous execution
- stores allowlists for assets, protocols, targets, and selectors
- enforces public policy versioning and validity windows
- anchors canonical `snapshotHash` and `snapshotCid` pairs used by execution and receipts

Important functions:

- `publishPolicy(...)`
- `revokeActivePolicy(address ownerEoa,address vaultAddress)`
- `getActivePolicy(address vaultAddress)`
- `anchorSnapshot(address vaultAddress,bytes32 snapshotHash,string snapshotCid,string descriptor)`

### 2. `NeuralRateExecutionGuard.sol`

- file: `contracts/contracts/NeuralRateExecutionGuard.sol`
- role: on-chain execution policy enforcement for the Safe module path

What it does:

- validates the delegate, target, selector, spend amount, slippage, deadline, and snapshot reference
- blocks replay by consuming an `intentHash`
- enforces per-use, daily, and total spend caps
- exposes module-guard style hooks to reject alternate module bypass paths

Important functions:

- `validateAndConsumeExecution(...)`
- `checkModuleTransaction(...)`
- `checkAfterModuleExecution(...)`

### 3. `NeuralRateDecisionReceiptRegistry.sol`

- file: `contracts/contracts/NeuralRateDecisionReceiptRegistry.sol`
- role: public on-chain receipt registry for benchmarkable decisions

What it does:

- creates immutable decision receipts tied to a vault, delegate, policy version, and snapshot
- stores `strategyKey`, `snapshotHash`, `snapshotCID`, predicted APY, and settlement horizon
- lets the configured writer settle realized outcomes later
- emits `DecisionReceiptCreated` and `DecisionReceiptSettled`

Important functions:

- `createDecisionReceipt(...)`
- `settleDecisionReceipt(uint256 receiptId,int256 realizedApyBps,int256 benchmarkApyBps)`
- `setReceiptWriter(address)`

### 4. `NeuralRateVaultModule.sol`

- file: `contracts/contracts/NeuralRateVaultModule.sol`
- role: Safe module used for real vault execution
- live Sepolia module deployment:
  [`0xDAbB583bDE28241F1e3C61B423CF456D07f4DA11`](https://sepolia.mantlescan.xyz/address/0xDAbB583bDE28241F1e3C61B423CF456D07f4DA11)

What it does:

- stores an `authorizedExecutor`
- optionally defers enforcement to `NeuralRateExecutionGuard`
- executes Safe module calls with intent, snapshot, slippage, and deadline metadata
- emits `VaultCallExecuted`

Important functions:

- `setAuthorizedExecutor(address)`
- `setExecutionGuard(address)`
- `executeVaultCall(address safe,address target,uint256 value,bytes calldata data,uint8 operation,bytes32 intentHash,bytes32 snapshotHash,uint256 slippageBps,uint256 deadline)`

### 5. `NeuralRateUsdYStrategyAdapter.sol`

- file: `contracts/contracts/NeuralRateUsdYStrategyAdapter.sol`
- role: preserved USDY-specific execution adapter
- live Sepolia adapter deployment:
  [`0xFeE16FAd13789e9bBA4779D025186341e58799a3`](https://sepolia.mantlescan.xyz/address/0xFeE16FAd13789e9bBA4779D025186341e58799a3)

Current status in the codebase:

- preserved and deployable
- not the default strategy path
- still blocked by the executor on Sepolia unless a canonical venue is configured

## Legacy Sepolia Note

The existing `deployments/mantle-sepolia.json` file still points to the earlier `NeuralRateDecisionBenchmark.sol` deployment on Sepolia. The repository code and deployment scripts now target `NeuralRateDecisionReceiptRegistry.sol` for new deployments, but that redeploy has not been recorded in the manifest yet.

## Execution Truth on Sepolia

- **Real Safe-module execution path:** yes
- **Default live demo:** `mnt-native-transfer`
- **Default live asset:** native `MNT`
- **Policy anchoring and snapshot hashing:** implemented in code
- **Receipt-registry target for new deployments:** implemented in code
- **USDY path on Sepolia:** preserved but blocked without a canonical venue

## Pinned Deployment Behavior

The executor validates pinned deployment metadata before dispatching Safe calls and now also expects the on-chain policy/snapshot path to be available when configured.
