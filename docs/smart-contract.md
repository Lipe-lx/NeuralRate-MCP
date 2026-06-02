# Smart Contracts

**Status:** Canonical doc

NeuralRate centers its automation trust model on five Solidity surfaces in the repository, plus one ERC-7579-compliant validator and one preserved strategy adapter.

## Contract Inventory

### 1. `NeuralRatePolicyRegistry.sol`

- file: `contracts/contracts/NeuralRatePolicyRegistry.sol`
- role: active on-chain policy registry per owner vault
- live Sepolia registry deployment: [`0xc4580b5831f36eCc3E4865e635c970C75DD9869C`](https://sepolia.mantlescan.xyz/address/0xc4580b5831f36eCc3E4865e635c970C75DD9869C)

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
- live Sepolia guard deployment: [`0xe6a70b147fB54F693d1ADAF566Fa52d871D2412b`](https://sepolia.mantlescan.xyz/address/0xe6a70b147fB54F693d1ADAF566Fa52d871D2412b)

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
- live Sepolia receipt registry deployment: [`0xC0C836A220D006398cdE4D5caf529196E63f81A8`](https://sepolia.mantlescan.xyz/address/0xC0C836A220D006398cdE4D5caf529196E63f81A8)

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
- live Sepolia module deployment: [`0xf7061501a464e893636a5BF8eB4ab7Ba2819154D`](https://sepolia.mantlescan.xyz/address/0xf7061501a464e893636a5BF8eB4ab7Ba2819154D)

What it does:

- stores an `authorizedExecutor`
- optionally defers enforcement to `NeuralRateExecutionGuard`
- executes Safe module calls with intent, snapshot, slippage, and deadline metadata
- emits `VaultCallExecuted`

Important functions:

- `setAuthorizedExecutor(address)`
- `setExecutionGuard(address)`
- `executeVaultCall(address safe,address target,uint256 value,bytes calldata data,uint8 operation,bytes32 intentHash,bytes32 snapshotHash,uint256 slippageBps,uint256 deadline)`

### 5. `NeuralRateDelegateValidator.sol`

- file: `contracts/contracts/NeuralRateDelegateValidator.sol`
- role: ERC-7579-compliant validator for Smart Account delegate UserOperation validation
- live Sepolia validator deployment: [`0x0A03F7763d53757183aD86C393eEfF6D8177e4cE`](https://sepolia.mantlescan.xyz/address/0x0A03F7763d53757183aD86C393eEfF6D8177e4cE)

What it does:

- implements the ERC-7579 `IValidator` interface to validate Smart Account UserOperations under ERC-4337.
- recovers the signer from the signature and verifies it matches the authorized delegate key.
- restricts the target contract: only allows the delegate to submit UserOperations that call `NeuralRateVaultModule` or the `NeuralRatePolicyRegistry` contract.

Important functions:

- `validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash)`
- `isValidSignatureWithSender(address sender, bytes32 hash, bytes calldata data)`
- `setDelegate(address)`

### 6. `NeuralRateUsdYStrategyAdapter.sol`

- file: `contracts/contracts/NeuralRateUsdYStrategyAdapter.sol`
- role: preserved USDY-specific execution adapter
- live Sepolia adapter deployment: [`0xFeE16FAd13789e9bBA4779D025186341e58799a3`](https://sepolia.mantlescan.xyz/address/0xFeE16FAd13789e9bBA4779D025186341e58799a3)

Current status in the codebase:

- preserved and deployable
- not the default strategy path
- still blocked by the executor on Sepolia unless a canonical venue is configured

## Sepolia Deployment Sync

All deployed addresses are fully synchronized and validated via `npm run sync:deployments` across worker configs, env files, and executor parameters.

## Execution Truth on Sepolia

- **Real Safe-module execution path:** yes
- **Default live demo:** `mnt-native-transfer`
- **Default live asset:** native `MNT`
- **Policy anchoring and snapshot hashing:** implemented in code
- **Receipt-registry target for new deployments:** implemented in code
- **USDY path on Sepolia:** preserved but blocked without a canonical venue

## Pinned Deployment Behavior

The executor validates pinned deployment metadata before dispatching Safe calls and now also expects the on-chain policy/snapshot path to be available when configured.
