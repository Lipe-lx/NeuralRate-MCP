# Release Audit 2026-05-29

Generated at: 2026-05-29T00:13:34.903Z

## Contract Snapshot

- Benchmark registry: `0xC0C836A220D006398cdE4D5caf529196E63f81A8`
- Policy registry: `0xc4580b5831f36eCc3E4865e635c970C75DD9869C`
- Execution guard: `0xe6a70b147fB54F693d1ADAF566Fa52d871D2412b`

## Required Manual Checks

1. Run `npm run preflight:public`
2. Run `npm run test:all`
3. Confirm `/verify` deployment bundle is updated
4. Confirm `/api/health` reports required capabilities
5. Confirm signed read auth on sensitive endpoints

## Notes

- This artifact is generated automatically and should be kept with release PR context.
