# Smart Contract

To enforce trust and transparency, NeuralRate MCP supports benchmark registration on-chain using a Solidity smart contract deployed on the **Mantle Sepolia Testnet** (Chain ID `5003`):

*   **Canonical Contract Address:** `0xc51560a5512d2A5756435d87319aeaE1bA480165`
*   **Mantle Sepolia Explorer Link:** [0xc51560a5512d2A5756435d87319aeaE1bA480165](https://sepolia.mantlescan.xyz/address/0xc51560a5512d2A5756435d87319aeaE1bA480165)

The contract acts as an immutable registry for benchmark decisions and performance outcomes. The public ERC-8004 agent identity is tracked separately in the Mantle identity registry; this contract does **not** embed `agentId` in each event.

The contract is configured with the **Turnkey Smart Wallet** (`0xc57130F28f3d670cA75AD9a78784966B767E55e3`) as the canonical `benchmarkWriter`, enforcing that only the autonomous agent can post performance benchmark metrics.


---

## 📄 Contract Specifications

* **Contract File:** `NeuralRateDecisionBenchmark.sol`
* **Solidity Compiler Version:** `^0.8.20`
* **License:** `MIT`

---

## 💾 State Variables and Structs

### State Variables
1. **`address public owner`**
   Administrative owner allowed to rotate the benchmark writer.
2. **`address public benchmarkWriter`**
   Stores the authorized account allowed to write decision data and settle outcomes. This is designed for the NeuralRate agent smart wallet rather than a fixed user EOA.
3. **`uint256 public nextDecisionId = 1`**
   An auto-incrementing ID assigned to newly created decision records.
4. **`mapping(uint256 => DecisionMeta) public decisions`**
   Maps an integer ID to its respective metadata record on-chain.

### Struct `DecisionMeta`
Represents the structural data of an autonomous recommendation:
```solidity
struct DecisionMeta {
    uint256 decisionId;
    address requestedBy;
    string dataSnapshotHash;
    int256 predictedApyBps;
    uint256 settlementHorizonHours;
    uint256 createdAt;
    bool isSettled;
}
```

---

## 🔒 Modifiers

### `onlyOwner()`
Restricts function execution exclusively to the contract owner.
```solidity
modifier onlyOwner() {
    require(msg.sender == owner, "Only owner can call this");
    _;
}
```

### `onlyBenchmarkWriter()`
Restricts function execution exclusively to the configured benchmark writer.
```solidity
modifier onlyBenchmarkWriter() {
    require(msg.sender == benchmarkWriter, "Only benchmark writer can call this");
    _;
}
```

---

## 📢 Events

### `BenchmarkWriterUpdated`
Fired when the owner rotates the benchmark writer.
```solidity
event BenchmarkWriterUpdated(
    address indexed previousWriter,
    address indexed newWriter
);
```

### `DecisionCreated`
Fired when a new yield allocation recommendation is registered on-chain.
```solidity
event DecisionCreated(
    uint256 indexed decisionId,
    address indexed requestedBy,
    string dataSnapshotHash,
    int256 predictedApyBps,
    uint256 settlementHorizonHours
);
```

### `DecisionSettled`
Fired when the investment horizon matures, logging performance metrics.
```solidity
event DecisionSettled(
    uint256 indexed decisionId,
    int256 realizedApyBps,
    int256 predictionErrorBps,
    int256 outperformanceBps
);
```

---

## ⚙️ External Functions

### `constructor`
Initializes the owner and sets the first benchmark writer.
```solidity
constructor(address initialBenchmarkWriter)
```

### `agent()`
Compatibility getter that returns the current benchmark writer.
```solidity
function agent() external view returns (address)
```

### `setBenchmarkWriter`
Allows the owner to rotate the benchmark writer to a new smart wallet.
```solidity
function setBenchmarkWriter(address newBenchmarkWriter) external onlyOwner
```

### `createDecision`
Logs a benchmark decision on-chain. Only executable by the configured benchmark writer.
```solidity
function createDecision(
    address _requestedBy,
    string calldata _dataSnapshotHash,
    int256 _predictedApyBps,
    uint256 _settlementHorizonHours
) external onlyBenchmarkWriter returns (uint256)
```
* **Logic:**
  1. Captures the auto-incremented ID: `id = nextDecisionId++`.
  2. Creates and maps a new `DecisionMeta` struct with `isSettled: false` and `createdAt: block.timestamp`.
  3. Emits a `DecisionCreated` event.
  4. Returns the decision ID.

### `settleDecision`
Flags a decision as completed, evaluating the accuracy of the prediction and outperformance compared to risk-free US Treasury Rates. Only executable by the configured benchmark writer.
```solidity
function settleDecision(
    uint256 _decisionId,
    int256 _realizedApyBps,
    int256 _tbillApyBps
) external onlyBenchmarkWriter
```
* **Logic:**
  1. Fetches the mapped decision from storage.
  2. Requires that the decision exists and has not yet been settled.
  3. Sets `isSettled = true`.
  4. Calculates APY prediction error in basis points:
     $$\text{predictionErrorBps} = \text{realizedApyBps} - \text{predictedApyBps}$$
  5. Calculates outperformance relative to Treasury yield in basis points:
     $$\text{outperformanceBps} = \text{realizedApyBps} - \text{tbillApyBps}$$
  6. Emits a `DecisionSettled` event.
