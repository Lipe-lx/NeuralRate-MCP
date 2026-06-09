# Custom Agent Rules

- When redeploying contracts or updating secrets, always sync secrets locally first via:
  ```bash
  npm run cf:worker:secrets:sync
  npm run cf:executor:secrets:sync
  ```
  before pushing to GitHub to trigger the CI/CD pipeline. This guarantees Cloudflare is configured with the correct secrets before the code and Wrangler configurations are deployed by CI/CD.
