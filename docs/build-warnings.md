# Build Warnings

**Status:** Canonical doc

## Privy / Rolldown PURE Annotation Warnings

During `apps/web` production builds, Rolldown may emit `INVALID_ANNOTATION` warnings for third-party modules (notably `@privy-io/react-auth` and transitive `ox` packages).

### Current Assessment

- build succeeds
- output artifacts are generated normally
- warnings are emitted from dependency code, not local app code

### Action Policy

- treat as **known warning** while builds remain successful
- track upstream package updates and Rolldown parser improvements
- re-check warning volume on dependency upgrades

### Escalation Trigger

Open a blocker issue if:

- warnings become build errors
- warnings correlate with runtime wallet-flow regressions
- bundle output changes unexpectedly after dependency upgrades
