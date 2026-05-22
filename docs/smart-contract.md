# Smart Contract

To enforce trust and transparency, StableSync MCP logs decisions on-chain using a Solidity smart contract deployed on the **Mantle Sepolia Testnet** (Chain ID `5003`). 

The contract acts as an immutable registry for decisions and performance benchmarks.

---

## 📄 Contract Specifications

* **Contract File:** `StableSyncDecisionBenchmark.sol`
* **Solidity Compiler Version:** `^0.8.20`
* **License:** `MIT`

---

## 💾 State Variables and Structs

### State Variables
1. **`address public agent`**
   Stores the authorized account allowed to write decision data and settle outcomes. Initialized to `msg.sender` in the constructor.
2. **`uint256 public nextDecisionId = 1`**
   An auto-incrementing ID assigned to newly created decision records.
3. **`mapping(uint256 => DecisionMeta) public decisions`**
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

### `onlyAgent()`
Restricts function execution exclusively to the authorized agent address.
```solidity
modifier onlyAgent() {
    require(msg.sender == agent, "Only registered agent can call this");
    _;
}
```

---

## 📢 Events

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

### `createDecision`
Logs an autonomous decision on-chain. Only executable by the registered agent.
```solidity
function createDecision(
    address _requestedBy,
    string calldata _dataSnapshotHash,
    int256 _predictedApyBps,
    uint256 _settlementHorizonHours
) external onlyAgent returns (uint256)
```
* **Logic:**
  1. Captures the auto-incremented ID: `id = nextDecisionId++`.
  2. Creates and maps a new `DecisionMeta` struct with `isSettled: false` and `createdAt: block.timestamp`.
  3. Emits a `DecisionCreated` event.
  4. Returns the decision ID.

### `settleDecision`
Flags a decision as completed, evaluating the accuracy of the prediction and outperformance compared to risk-free US Treasury Rates. Only executable by the registered agent.
```solidity
function settleDecision(
    uint256 _decisionId,
    int256 _realizedApyBps,
    int256 _tbillApyBps
) external onlyAgent
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
