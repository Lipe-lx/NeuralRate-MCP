# Risk Model Specification

**Status:** Canonical doc

This document specifies the deterministic NeuralRate risk scoring model used by `risk_assess`.

## Model Version

- `risk-model-v1`
- Reference implementation: `apps/worker/src/mcp/tools.ts` (`handleRiskAssess`)

## Output

The model returns:

- `totalScore` in range `0-100`
- `classification` in `{LOW, MEDIUM, HIGH, CRITICAL}`
- per-factor subscores and diagnostics

Classification bands:

- `LOW` if `totalScore >= 80`
- `MEDIUM` if `totalScore >= 60`
- `HIGH` if `totalScore >= 40`
- `CRITICAL` otherwise

## Factor Breakdown

Total score is the sum of 6 factors:

1. TVL Depth (`max 20`)
2. Volume/TVL Utilization (`max 15`)
3. APY Sustainability & Volatility (`max 20`)
4. Yield Composition (`max 15`)
5. IL & Asset Exposure (`max 15`)
6. Institutional Flow (`max 15`)

### 1) TVL Depth (`0-20`)

Input: `protocolTvlUsd = tvl`

- if `tvl >= 100,000,000` -> `20`
- else if `tvl >= 10,000,000` -> `16 + ((tvl - 10,000,000) / 90,000,000) * 4`
- else if `tvl >= 1,000,000` -> `10 + ((tvl - 1,000,000) / 9,000,000) * 6`
- else if `tvl >= 100,000` -> `3 + ((tvl - 100,000) / 900,000) * 7`
- else -> `(tvl / 100,000) * 3`

Rounded to 1 decimal.

### 2) Volume/TVL Utilization (`0-15`)

Inputs: `volumeUsd1d`, `volumeUsd7d`, `protocolTvlUsd`

Lending proxy path:

- if both volume inputs are `null`:
  - `15` if `tvl >= 10,000,000`
  - `12` if `tvl >= 1,000,000`
  - `8` otherwise

DEX path:

- `avgDailyVol = volumeUsd7d > 0 ? volumeUsd7d / 7 : volumeUsd1d`
- `utilizationRatio = tvl > 0 ? (avgDailyVol / tvl) * 100 : 0`
- if `1 <= utilizationRatio <= 50` -> `15`
- else if `50 < utilizationRatio <= 100` -> `10 - ((utilizationRatio - 50) / 50) * 5`
- else if `utilizationRatio > 100` -> `max(0, 5 - ((utilizationRatio - 100) / 100) * 5)`
- else (`utilizationRatio < 1`) -> `utilizationRatio * 10`

Rounded to 1 decimal, floor at `0`.

### 3) APY Sustainability & Volatility (`0-20`)

Inputs: `apy`, `apyMean30d`, `sigma`

Sub-score A (`0-10`) from absolute APY:

- if `apy <= 10` -> `10`
- else if `apy <= 20` -> `8`
- else if `apy <= 50` -> `5 - ((apy - 20) / 30) * 3`
- else -> `max(0, 2 - ((apy - 50) / 50) * 2)`

Sub-score B (`0-10`) from deviation + sigma:

- `meanApy = apyMean30d || apy`
- `deviation = meanApy > 0 ? abs(apy - meanApy) / meanApy : 0`
- start from `10`
- if `deviation > 0.5` -> `3`
- else if `deviation > 0.3` -> `6`
- else if `deviation > 0.1` -> `8`
- sigma penalty:
  - if `sigma > 10` -> minus `3`
  - else if `sigma > 5` -> minus `1`
- clamp at `0`

Factor score = `Sub-score A + Sub-score B`, rounded to 1 decimal.

### 4) Yield Composition (`0-15`)

Inputs: `apyBase`, `apyReward`

- `totalApyParts = apyBase + apyReward`
- `organicRatio = totalApyParts > 0 ? apyBase / totalApyParts : 0.5`
- if `organicRatio >= 0.8` -> `15`
- else if `organicRatio >= 0.5` -> `10 + ((organicRatio - 0.5) / 0.3) * 5`
- else if `organicRatio >= 0.2` -> `5 + ((organicRatio - 0.2) / 0.3) * 5`
- else -> `organicRatio * 25`

Rounded to 1 decimal.

### 5) IL & Asset Exposure (`0-15`)

Inputs: `stablecoin`, `ilRisk`

- if `stablecoin == true` -> `15`
- else if `ilRisk == "no"` -> `12`
- else if `ilRisk == "yes"` -> `5`
- else -> `8`

### 6) Institutional Flow (`0-15`)

Input: `nansenSmartMoneyNetFlow = flow`

- if `flow > 500,000` -> `15`
- else if `flow > 100,000` -> `12`
- else if `flow > 0` -> `10`
- else if `flow > -100,000` -> `7`
- else -> `3`

## Worked Examples

All examples below follow the exact equations above and match the implementation behavior, including rounding.

### Example A: Deep, stable, positive-flow market

Inputs:

- `protocolTvlUsd=150,000,000`
- `apy=8`
- `apyBase=7`
- `apyReward=1`
- `volumeUsd1d=null`
- `volumeUsd7d=null`
- `apyMean30d=8`
- `sigma=1`
- `ilRisk="no"`
- `stablecoin=true`
- `nansenSmartMoneyNetFlow=600,000`

Factor scores:

- TVL: `20.0`
- Utilization: `15.0`
- APY sustainability: `20.0` (`10 + 10`)
- Yield composition: `15.0`
- Asset exposure: `15.0`
- Institutional flow: `15.0`

Result:

- `totalScore = 100.0`
- `classification = LOW`

### Example B: Mid-liquidity, mixed sustainability

Inputs:

- `protocolTvlUsd=5,000,000`
- `apy=24`
- `apyBase=8`
- `apyReward=16`
- `volumeUsd1d=200,000`
- `volumeUsd7d=1,400,000`
- `apyMean30d=20`
- `sigma=6`
- `ilRisk="yes"`
- `stablecoin=false`
- `nansenSmartMoneyNetFlow=50,000`

Factor scores:

- TVL: `12.7`
- Utilization: `15.0` (`avgDailyVol=200,000`, `ratio=4.0%`)
- APY sustainability: `11.6` (`4.6 + 7.0`)
- Yield composition: `7.2` (`organicRatio=0.3333`)
- Asset exposure: `5.0`
- Institutional flow: `10.0`

Result:

- `totalScore = 61.5`
- `classification = MEDIUM`

### Example C: Thin liquidity, unstable yield, risk-off flow

Inputs:

- `protocolTvlUsd=300,000`
- `apy=120`
- `apyBase=2`
- `apyReward=118`
- `volumeUsd1d=500`
- `volumeUsd7d=3,500`
- `apyMean30d=40`
- `sigma=12`
- `ilRisk="yes"`
- `stablecoin=false`
- `nansenSmartMoneyNetFlow=-250,000`

Factor scores:

- TVL: `4.6`
- Utilization: `1.7` (`avgDailyVol=500`, `ratio=0.1667%`)
- APY sustainability: `0.0` (`0.0 + 0.0`)
- Yield composition: `0.4` (`organicRatio=0.0167`)
- Asset exposure: `5.0`
- Institutional flow: `3.0`

Result:

- `totalScore = 14.7`
- `classification = CRITICAL`

## Change Policy

Any scoring logic update must:

- bump model version
- update this spec
- include before/after example outputs
- be reflected in frontend explanation text (`RiskPanel`)
