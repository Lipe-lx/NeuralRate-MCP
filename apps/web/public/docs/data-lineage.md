# Data Lineage

**Status:** Canonical doc

NeuralRate now exposes decision lineage in a publicly auditable format.

## What Is Stored

For each decision, the system stores:

- `data_snapshot_hash`
- allocation payload JSON
- applied constraints JSON
- rationale JSON, including:
  - `snapshotLineage.method`
  - `snapshotLineage.payload`
  - `snapshotLineage.hash`
  - `snapshotLineage.snapshotCid`

## Hash Method

- current method label: `keccak256(canonical-json-v1)`
- hash is produced from deterministic snapshot payload fields used for decision logging

## Public Retrieval

- endpoint: `GET /api/decisions/:decisionId/lineage?ownerEoa=...`
- requires signed read auth headers
- returns the persisted lineage envelope for third-party verification

## Audit Flow

1. capture user input and effective constraints
2. generate deterministic snapshot payload and hash
3. persist decision + lineage
4. queue benchmark with same snapshot hash
5. verify on-chain receipt/snapshot references against persisted lineage
