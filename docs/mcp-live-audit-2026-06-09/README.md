# MCP Live E2E Audit Report & Evidence (2026-06-09)

**Audit Date:** 2026-06-09
**Environment:** Staging/Production Cloudflare Worker and Executor
**Chain:** Mantle Sepolia (Chain ID `5003`)
**Target MCP Scoped Endpoints:**
- `/mcp/scoped/benchmark`
- `/mcp/scoped/state`

---

## 1. Executive Summary

This audit report validates the successful integration, signing, and on-chain execution of the **NeuralRate MCP** benchmark queue flow. 

Prior to this validation, two blocking issues were encountered and resolved:
1. **Gas Deficiency:** The Turnkey agent EOA wallet `0xc57130F28f3d670cA75AD9a78784966B767E55e3` had `0.0 MNT`, preventing transaction submission.
2. **Turnkey Configuration Mismatch:** The worker's Turnkey Organization ID was misconfigured as the root User ID (`2caf9bd4...`), which caused a `Turnkey error 5: no organization found` error.

After funding the EOA and syncing the corrected Turnkey credentials to the Cloudflare Worker secrets, a real user session benchmark registration flow was dispatched using the active MCP session token. The transaction was successfully signed by Turnkey, broadcast, and mined on-chain with a **success** status.

---

## 2. On-Chain and Off-Chain Identities

- **Owner EOA:** `0x54FCb49Cd7281140e17721f65f00e49a809400Bc` (Used to fund agent and owns the registry contract)
- **Agent Turnkey EOA:** `0xc57130F28f3d670cA75AD9a78784966B767E55e3` (Signer delegate for worker/executor)
- **NeuralRate Safe Vault:** `0x9ddbbb5f9a3cc1c0e744d20ba6b0fa50fb22a3ff` (Target vault under policy governance)
- **Decision Registry Contract:** `0xC0C836A220D006398cdE4D5caf529196E63f81A8` (Registry contract containing benchmark decision hashes)

---

## 3. Detailed Audit Chronology

### Step 1: Initial E2E Call & Gas Funding
- **Behavior:** The initial MCP `queue_benchmark` tool call failed on-chain because the Turnkey signer wallet did not have sufficient gas.
- **Action:** A transfer of `2.0 MNT` was signed and broadcasted from the Owner EOA to the Turnkey agent EOA.
- **Gas Funding Transaction:**
  - **Tx Hash:** [`0x725a2562872bd98bc97db748c29a5320b9878b20cdcf649f6d9e50649db6b8fe`](https://sepolia.mantlescan.xyz/tx/0x725a2562872bd98bc97db748c29a5320b9878b20cdcf649f6d9e50649db6b8fe)
  - **Amount:** `2.0 MNT`
  - **Block Number:** `39714709`

### Step 2: Turnkey Secrets Alignment
- **Behavior:** The subsequent call failed with a Turnkey signature failure stating `ORGANIZATION_NOT_FOUND`.
- **Action:** The `TURNKEY_ORGANIZATION_ID` configuration was corrected in `.env` and synced to Cloudflare Worker secrets:
  - **Old Configuration (Incorrect User ID):** `2caf9bd4-93ad-41f9-9c67-593f1fdc0a77`
  - **New Configuration (Correct Org ID):** `220bca0d-12b4-4ee7-bddb-2ca6c91bfb61`
  - **Secrets Sync Command:** `npm run cf:executor:secrets:sync`

### Step 3: MCP Live E2E Flow Execution
- **Behavior:** An external client handshake was initialized against the scoped benchmark endpoint `/mcp/scoped/benchmark` using the active session token:
  - **Session Token:** `nrmcp_f6d2d9bc8e21d74ba638c8a705f4a160fcb6b5b3cd9aaf456a6302a33b15eca5`
- **Method Called:** `queue_benchmark`
- **Payload Parameters:**
  - `decisionId`: `demo_decision_1780976206938`
  - `dataSnapshotHash`: `0x194f5450d527aa775a836de57b41d447bb57d70aaac0b5fe8cf04320ac90230a`
- **Output:** The worker successfully accepted the job as `queued`, allocated DB job reference `turnkey:benchmark_56ae7002-7172-46e0-9cc2-fb6c2a97b9ff`, signed, and broadcasted the transaction to the network.

---

## 4. On-Chain Traceability & Verification

The transaction executed by Turnkey on-chain has been verified using a public RPC node:

- **Transaction Hash:** [`0xa9852374dee441c9153220dccec299e03f262076febe776a1de18f9654827d44`](https://sepolia.mantlescan.xyz/tx/0xa9852374dee441c9153220dccec299e03f262076febe776a1de18f9654827d44)
- **Status:** `Success` (Confirmed status `1`)
- **Block Number:** `39715772`
- **Sender (Turnkey Signer EOA):** `0xc57130f28f3d670ca75ad9a78784966b767e55e3`
- **Recipient Contract (Decision Registry):** `0xC0C836A220D006398cdE4D5caf529196E63f81A8`
- **Gas Used:** `365,763`

### D1 Database State Record (Job ID 13)
```json
{
  "id": 13,
  "status": "confirmed",
  "tx_hash": "0xa9852374dee441c9153220dccec299e03f262076febe776a1de18f9654827d44",
  "failure_reason": null,
  "updated_at": "2026-06-09 03:36:59"
}
```

---

## 5. Audit Conclusion

The integration between the Cloudflare Worker, the D1 database, the Turnkey signer delegate, and the Mantle Sepolia blockchain is fully operational. With correct gas funding and organization configuration:
1. Handshake, session tokens, and route-level authorization scopes are properly enforced.
2. The agent signature sequence completes successfully on Turnkey.
3. Transactions are successfully sent to and mined on the Mantle Sepolia network.
4. Correct data lineage (decision and snapshot hashes) is registered on the smart contract.

*All raw JSON structures are stored in [audit_evidence.json](./audit_evidence.json).*
