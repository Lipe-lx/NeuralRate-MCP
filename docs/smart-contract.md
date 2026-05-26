# Smart Contracts

**Status:** Canonical doc

NeuralRate currently relies on three Solidity contracts in the repository.

## Contract Inventory

### 1. `NeuralRateDecisionBenchmark.sol`

- file: `contracts/contracts/NeuralRateDecisionBenchmark.sol`
- role: public benchmark registry on Mantle Sepolia
- deployed address:
  [`0xc51560a5512d2A5756435d87319aeaE1bA480165`](https://sepolia.mantlescan.xyz/address/0xc51560a5512d2A5756435d87319aeaE1bA480165)

What it does:

- stores benchmark decisions
- lets the configured benchmark writer create decisions
- lets the configured benchmark writer settle decisions
- emits `DecisionCreated` and `DecisionSettled`

Important state:

- `owner`
- `benchmarkWriter`
- `nextDecisionId`
- `decisions`

Important functions:

- `agent()`
- `setBenchmarkWriter(address)`
- `createDecision(address,string,int256,uint256)`
- `settleDecision(uint256,int256,int256)`

The executor uses this contract for real on-chain benchmark writes.

### 2. `NeuralRateVaultModule.sol`

- file: `contracts/contracts/NeuralRateVaultModule.sol`
- role: Safe module for real vault execution
- deployed address:
  [`0xDAbB583bDE28241F1e3C61B423CF456D07f4DA11`](https://sepolia.mantlescan.xyz/address/0xDAbB583bDE28241F1e3C61B423CF456D07f4DA11)

What it does:

- stores an `authorizedExecutor`
- receives real execution requests from that executor
- calls the Safe using `execTransactionFromModule`
- supports native-value and calldata-based execution
- emits `VaultCallExecuted`

Important functions:

- `authorizedExecutor()`
- `setAuthorizedExecutor(address)`
- `executeVaultCall(address safe,address target,uint256 value,bytes calldata data,uint8 operation,bytes32 intentHash)`

This is the contract used by the live Sepolia `MNT` demo path.

### 3. `NeuralRateUsdYStrategyAdapter.sol`

- file: `contracts/contracts/NeuralRateUsdYStrategyAdapter.sol`
- role: preserved USDY-specific execution surface
- deployed address:
  [`0xFeE16FAd13789e9bBA4779D025186341e58799a3`](https://sepolia.mantlescan.xyz/address/0xFeE16FAd13789e9bBA4779D025186341e58799a3)

Current status in the codebase:

- preserved and deployable
- not the default strategy path
- not treated as a canonical Sepolia venue by the executor

This contract remains part of the repository, but the executor now fails closed for `usdy-stable-allocation` unless a canonical Sepolia venue is explicitly configured.

## Execution Truth on Sepolia

- **Real benchmark path:** yes
- **Real Safe-module execution path:** yes
- **Default live demo:** `mnt-native-transfer`
- **Default live asset:** native `MNT`
- **USDY path on Sepolia:** preserved but blocked without a canonical venue

## Pinned Deployment Behavior

The executor consumes the generated module manifest in:

- `apps/executor/src/generated/vaultModuleDeployment.ts`

The planner validates:

- chain ID
- module address
- pinned runtime bytecode hash

This validation happens before vault execution is submitted.
