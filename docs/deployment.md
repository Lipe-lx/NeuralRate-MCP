# Deployment Flow

**Status:** Canonical doc

This repository uses Cloudflare-managed Git deploys for the public runtime surfaces.

## Source Of Truth

- `apps/web`
  Deploys through Cloudflare Pages Git integration.
- `apps/worker`
  Deploys through Cloudflare Workers Git integration.
- GitHub Actions
  Not part of the deployment path for web or worker in this repository.

If a push updates the tracked branch connected in Cloudflare, Cloudflare is the platform that detects the commit and starts the deployment.

## What A Git Push Does

For the public surfaces already wired in Cloudflare:

- pushing the tracked branch is enough to trigger web deployment
- pushing the tracked branch is enough to trigger worker deployment
- the web deploy now reads a tracked `apps/web/.env.production` file for public `VITE_PUBLIC_*` bindings

This repository does **not** rely on versioned GitHub Actions workflows to publish those two services.

## What A Git Push Does Not Do

A Git push alone does not:

- upload local secrets from `/.env`
- sync Worker secrets unless you explicitly publish them
- guarantee executor host rollout unless that host has its own deployment path outside this repository
- provision non-public frontend secrets; only public `VITE_PUBLIC_*` bindings are tracked for Pages builds

## Worker Auth

Commands:

```bash
npm run cf:secrets:sync
npm run cf:worker:publish
```

This repository publishes Worker secrets and deploys only through your local `wrangler login` session.

Before publishing secrets or deploying the worker, run:

```bash
unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
npx wrangler login
```

Then use:

```bash
npm run cf:secrets:sync
npm run cf:worker:publish
```

If `wrangler login` says you are still authenticated with an API token, that token is coming from your shell environment or shell profile, not from this repository.

If OAuth login succeeds but secret publish still returns `Authentication error [code: 10000]`, your logged-in Cloudflare user does not have access to the target account that owns the Worker. In that case:

```bash
npx wrangler logout
unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
npx wrangler login
```

Then confirm you are logged into the Cloudflare user that has access to the Worker account before retrying the publish.

## Recommended Local Check Before Push

These checks are recommended to reduce regressions before pushing:

```bash
npx tsc -p apps/worker/tsconfig.json
node --import tsx --test apps/worker/src/auth.test.ts apps/worker/src/auth.smoke.test.ts apps/worker/src/grants.test.ts apps/worker/src/services/nansen.test.ts
```

For release hygiene, the repository also keeps these commands:

```bash
npm run sync:deployments
npm run preflight:release
```

These commands become required before push whenever you change runtime variables, public bindings, deployment metadata, or checked-in env examples.

Run:

```bash
npm run sync:deployments
npm run preflight:release
```

Use them to validate local configuration and checked-in deployment metadata before shipping a release-oriented change.

## Operator Notes

- Treat Cloudflare dashboard Git wiring as the deploy trigger configuration.
- Treat `apps/worker/wrangler.toml` as runtime configuration for the Worker, not as proof that GitHub Actions deploys it.
- If future automation is added through GitHub Actions, update this document so it remains the canonical deployment reference.
