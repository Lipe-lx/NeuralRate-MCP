# NeuralRate E2E Audit Report

Audit date: 2026-05-27
Environment: https://neuralrate.pages.dev/

Post-deploy revalidation completed on 2026-05-27.

## Scope

Smoke testing as a real user using only the public interface.

Rules followed:

- no internal routes were used to shortcut the flow
- no direct internal API calls were used to replace user navigation
- interactions happened through a headless browser on the live site

## Methodology

Browser flows executed:

1. Load the public landing page
2. Open the `AGENT ACCESS` modal
3. Switch pools in `Yield Scanner`
4. Trigger `Nansen Radar`
5. Switch to the `Agent Vault` tab

Local evidence generated:

- `/tmp/neuralrate-landing.png`
- `/tmp/neuralrate-agent-modal.png`
- `/tmp/neuralrate-pool-selected.png`
- `/tmp/neuralrate-nansen.png`
- `/tmp/neuralrate-vault-tab.png`

## Results

### 1. Landing page

[OK] The page loaded and rendered the public terminal.

[OK] The main panels were visible:

- `Risk Assessment`
- `Nansen Radar`
- `Yield Scanner`
- `Connect Wallet`
- `AGENT ACCESS`

### 2. Agent modal

[OK] The `AGENT ACCESS` button opened the MCP connection modal.

[OK] The modal displayed the public agent endpoint and the manual JSON configuration.

[OK] No page errors were recorded while opening or closing the modal.

### 3. Pool selection and risk

[OK] Pool selection in `Yield Scanner` worked as a real user flow.

[OK] The risk score changed from `86.6` to `73.1` after switching pools.

Interpretation:

- this confirms the UI is not static
- changing the asset triggers a real recomputation in the risk panel

### 4. Nansen Radar

[OK] The Nansen toggle was triggered through the UI.

[OK] The panel returned a deterministic final state for the selected pool:

- `No Smart Money netflow snapshot was returned for USDC. Cached lookup status: negative.`

Interpretation:

- the panel did not break
- the enrichment path returned a useful result, even though it was negative

### 5. Vault tab

[OK] Switching to `Agent Vault` worked.

[OK] The vault screen showed the expected initial state for a user who has not bootstrapped yet:

- pending vault
- `Connect Wallet` button
- automation status inactive
- no execution jobs recorded

## Post-Deploy Revalidation

The smoke test was rerun after the latest deploy and passed successfully.

Confirmed in this run:

- `AGENT ACCESS` opened the modal correctly
- pool switching in `Yield Scanner` worked
- the risk score changed from `86.6` to `73.1`
- `Nansen Radar` responded without page errors
- the `Agent Vault` tab opened in the expected state
- no console errors or page exceptions were observed

## Findings

### Confirmed

1. The public site is functional and responsive in the basic flow.
2. The MCP modal is accessible to the user without internal routes.
3. Pool selection changes the risk score in real time.
4. The Nansen panel returns a coherent final state for missing data.
5. The vault tab shows the expected onboarding state for a new user.

### Test limits

1. Real wallet authentication, on-chain bootstrapping, and signed automation actions could not be validated because that requires user credentials.
2. The initial active pool capture was not stable on the first automated read, but the subsequent state change was confirmed successfully.

## Conclusion

The public site passed the main navigation and interaction smoke tests:

- homepage load
- agent modal open
- yield scanner interaction
- risk panel response
- vault area navigation

No console errors or page exceptions were observed during the run.
