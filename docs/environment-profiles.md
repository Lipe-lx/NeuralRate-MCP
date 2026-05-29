# Environment Profiles

**Status:** Canonical doc

NeuralRate now operates with three explicit environment profiles.

## Profiles

- `demo`
  - default developer + hackathon profile
  - Mantle Sepolia assumptions allowed
  - verbose UX guidance and permissive feature flags
- `staging`
  - pre-production validation profile
  - release gates, auth boundaries, and audit endpoints must pass
  - mirrors production config shape
- `production`
  - customer-facing profile
  - no Sepolia-only defaults in public messaging
  - mandatory release artifact checks

## Required Config Groups

- chain + contracts
  - benchmark registry address
  - policy registry address
  - execution guard + module addresses
- data providers
  - DefiLlama/FRED/Nansen keys and limits
- auth + sessions
  - mutation auth nonces
  - signed read auth
  - scoped MCP mutation session rules
- execution runtime
  - executor base URL
  - signer/bundler connectivity

## Release Gate Expectations

Before moving `staging` to `production`, run:

- `npm run preflight:public`
- `npm run test:all`
- public verify checks:
  - `/verify` deployment bundle freshness
  - `/docs` links resolve
  - `/api/health` reports all required capabilities for the target profile
