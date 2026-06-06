# Release Audit 2026-06-06

Generated at: 2026-06-06T00:41:59.575Z

## Contract Snapshot

- Benchmark registry: `0xC0C836A220D006398cdE4D5caf529196E63f81A8`
- Policy registry: `0xc4580b5831f36eCc3E4865e635c970C75DD9869C`
- Execution guard: `0x8B2cE65c9B18BF50CF26fa8eDe70b2477dFdca9B`

## Required Manual Checks

1. Run `npm run preflight:public`
2. Run `npm run test:all`
3. Confirm `/verify` deployment bundle is updated
4. Confirm `/api/health` reports required capabilities
5. Confirm signed read auth on sensitive endpoints

## Notes

- This artifact is generated automatically and should be kept with release PR context.
