# Deployment Flow

**Status:** Canonical doc

This repository uses a mixed deployment model.

- `apps/web`
  can continue deploying through Cloudflare Pages Git integration
- `apps/worker`
  is published through local Wrangler CLI
- `apps/executor`
  is a private Cloudflare Worker published through local Wrangler CLI and reached only through service binding from the public worker

## Source Of Truth

- `apps/web`
  Deploys through Cloudflare Pages Git integration.
- `apps/worker`
  Deploys through `wrangler deploy` using repository scripts.
- `apps/executor`
  Deploys through `wrangler deploy` using repository scripts.
- GitHub Actions
  Not part of the deployment path for web, worker, or executor in this repository.

## What A Git Push Does

For the public surfaces already wired in Cloudflare:

- pushing the tracked branch is enough to trigger web deployment
- the web deploy now reads a tracked `apps/web/.env.production` file for public `VITE_PUBLIC_*` bindings

This repository does **not** rely on versioned GitHub Actions workflows to publish runtime services.

## What A Git Push Does Not Do

A Git push alone does not:

- upload local secrets from `/.env`
- sync Worker secrets unless you explicitly publish them
- publish the public worker
- publish the private executor
- provision non-public frontend secrets; only public `VITE_PUBLIC_*` bindings are tracked for Pages builds

## Production Publish Path

Commands:

```bash
npm run cf:worker:secrets:sync
npm run cf:executor:secrets:sync
npm run cf:prod:publish
```

This repository publishes Cloudflare secrets and deploys only through your local `wrangler login` session.

Before publishing secrets or deploying the workers, run:

```bash
unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
npx wrangler login
```

Then use:

```bash
npm run cf:worker:secrets:sync
npm run cf:executor:secrets:sync
npm run cf:prod:publish
```

Always sync both Worker secret profiles locally before a release push or publish. The publish command deploys the private executor first and then the public worker because the public worker depends on the executor service binding.

`npm run cf:prod:publish` publishes runtime code in this order:

1. private executor
2. public worker

This order matters because the public worker depends on the executor service binding.

If `wrangler login` says you are still authenticated with an API token, that token is coming from your shell environment or shell profile, not from this repository.

If OAuth login succeeds but secret publish still returns `Authentication error [code: 10000]`, your logged-in Cloudflare user does not have access to the target account that owns the Worker. In that case:

```bash
npx wrangler logout
unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
npx wrangler login
```

Then confirm you are logged into the Cloudflare user that has access to the target account before retrying the publish.

## Runtime Model

- `apps/web`
  remains public
- `apps/worker`
  remains public
- `apps/executor`
  is private
  - `workers_dev = false`
  - no public hostname is required
  - the public worker reaches it through `[[services]] binding = "EXECUTOR"`

`EXECUTOR_BASE_URL` is now a local-development fallback only. In production it should stay empty unless you are intentionally using a temporary non-loopback migration fallback.

## Recommended Local Check Before Push

These checks are recommended to reduce regressions before pushing:

```bash
npx tsc -p apps/worker/tsconfig.json
node --import tsx --test apps/worker/src/auth.test.ts apps/worker/src/auth.smoke.test.ts apps/worker/src/grants.test.ts apps/worker/src/services/nansen.test.ts
```

For executor, ERC-4337, Safe7579, paymaster, or strategy routing changes, run:

```bash
npm --workspace apps/executor test
npx tsc -p apps/executor/tsconfig.json --noEmit
```

For runtime state, MCP scoped state, vault UI, or telemetry changes, run:

```bash
npm --workspace apps/worker test
npx tsc -p apps/worker/tsconfig.json --noEmit
npm --workspace apps/web test
npm --workspace apps/web run build
```

For release hygiene, the repository also keeps these commands:

```bash
npm run sync:deployments
npm run preflight:release
```

These commands become required before publish whenever you change runtime variables, public bindings, service bindings, deployment metadata, or checked-in env examples.

Run:

```bash
npm run sync:deployments
npm run preflight:release
```

Use them to validate local configuration and checked-in deployment metadata before shipping a release-oriented change.

## Operator Notes

- Treat Cloudflare dashboard Git wiring as the deploy trigger configuration.
- Treat `apps/worker/wrangler.toml` and `apps/executor/wrangler.toml` as runtime configuration plus binding metadata.
- Treat `npm run cf:prod:publish` as the canonical production publish command for worker + executor.
- If future automation is added through GitHub Actions, update this document so it remains the canonical deployment reference.
