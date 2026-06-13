# Smart Contracts

**Status:** Canonical doc

NeuralRate centers its automation trust model on five Solidity surfaces in the repository, plus one ERC-7579-compliant validator, one preserved strategy adapter, and one testnet-only Mock USDY token harness.

## Contract Inventory

### 1. `NeuralRatePolicyRegistry.sol`

- file: `contracts/contracts/NeuralRatePolicyRegistry.sol`
- role: active on-chain policy registry per owner vault
- live Sepolia registry deployment: [`0x86cD4f8c2528E71a473ED342aa73B8a00de906a4`](https://sepolia.mantlescan.xyz/address/0x86cD4f8c2528E71a473ED342aa73B8a00de906a4)

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
- live Sepolia guard deployment: [`0x666Bc822156824F40F2b70aAaAcBfe87467D79A5`](https://sepolia.mantlescan.xyz/address/0x666Bc822156824F40F2b70aAaAcBfe87467D79A5)

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
- live Sepolia module deployment: [`0xACBB78DAB5D1404C9eeC1E90BCe569cD1acc91bF`](https://sepolia.mantlescan.xyz/address/0xACBB78DAB5D1404C9eeC1E90BCe569cD1acc91bF)

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
- protects the Safe7579 runtime path used by the private executor; the executor must replace the Safe7579 placeholder signature with a managed-signer signature before dispatch.

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

### 7. `MockERC20.sol` as Mock USDY

- file: `contracts/contracts/mocks/MockERC20.sol`
- role: explicit Mantle Sepolia demo harness for USDY-shaped ERC-20 execution
- deployment manifest after deploy: `deployments/mantle-sepolia-mock-usdy.json`
- live Sepolia mock deployment: [`0xC63FB10deD215c6De6cDB438FB2Ce7944F6Af5bE`](https://sepolia.mantlescan.xyz/address/0xC63FB10deD215c6De6cDB438FB2Ce7944F6Af5bE)

Current status in the codebase:

- used only through the labeled `mock-usdy-sepolia-allocation` strategy
- token metadata is `Mock USDY`, symbol `USDY`, `18` decimals
- exposes the ERC-20 behavior needed by the demo path, including `mint`, `transfer`, `approve`, `transferFrom`, `balanceOf`, and `allowance`
- minting is exposed as a UI faucet and as MCP `prepare_mock_usdy_mint`, both labeled testnet-only
- the UI faucet and default MCP mint preparation target the agent Safe vault, not the owner's EOA
- not treated as a canonical Ondo venue
- disclosed as a testnet substitute because Ondo has no canonical public Mantle Sepolia USDY deployment; mainnet uses Ondo's canonical USDY contract

## Sepolia Deployment Sync

All deployed addresses are fully synchronized and validated via `npm run sync:deployments` across worker configs, env files, and executor parameters.

## Execution Truth on Sepolia

- **Real Safe-module execution path:** yes
- **Current USDY demo path:** `mock-usdy-sepolia-allocation`
- **Current USDY demo asset:** Mock USDY at `0xC63FB10deD215c6De6cDB438FB2Ce7944F6Af5bE`
- **Native transfer demo path:** `mnt-native-transfer`
- **Native demo asset:** native `MNT`
- **Policy anchoring and snapshot hashing:** implemented in code
- **Receipt-registry target for new deployments:** implemented in code
- **USDY path on Sepolia:** preserved but blocked without a canonical venue
- **Mock USDY path on Sepolia:** explicit demo harness via `mock-usdy-sepolia-allocation`
- **Latest confirmed strategy tx:** [`0x36281947f5fb3088c29e6926979f150eb10ee03e5be86e4973599bf8823409b6`](https://sepolia.mantlescan.xyz/tx/0x36281947f5fb3088c29e6926979f150eb10ee03e5be86e4973599bf8823409b6)

## Pinned Deployment Behavior

The executor validates pinned deployment metadata before dispatching Safe calls and now also expects the on-chain policy/snapshot path to be available when configured. For Safe7579 jobs, it signs the prepared UserOperation and rejects any final request that still carries the known placeholder signature, preventing `AA24 signature error` regressions from reaching the bundler.
