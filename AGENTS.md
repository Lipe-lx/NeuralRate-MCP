# Agent Rules

- Before finalizing code changes, run the targeted tests for every changed workspace and the nearest regression test for the user-reported path.
- For runtime, funding, automation, MCP scoped state, or vault UI changes, run at minimum: `npm --workspace apps/worker test`, `npx tsc -p apps/worker/tsconfig.json --noEmit`, `npm --workspace apps/web test`, and `npm --workspace apps/web run build`.
- If any required test cannot be run, report the exact command, the reason, and the residual regression risk before handing work back.
