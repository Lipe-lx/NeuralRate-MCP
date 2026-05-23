/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_API_BASE_URL?: string;
  readonly VITE_PUBLIC_MCP_HTTP_URL?: string;
  readonly VITE_PUBLIC_MCP_SSE_URL?: string;
  readonly VITE_PUBLIC_EXECUTOR_BASE_URL?: string;
  readonly VITE_PUBLIC_MANTLE_RPC_URL?: string;
  readonly VITE_PUBLIC_MANTLE_EXPLORER_BASE_URL?: string;
  readonly VITE_PUBLIC_NEURALRATE_BENCHMARK_CONTRACT?: string;
  readonly VITE_PUBLIC_ERC8004_AGENT_ID?: string;
  readonly VITE_PUBLIC_ERC8004_IDENTITY_REGISTRY?: string;
  readonly VITE_PUBLIC_BICONOMY_API_KEY?: string;
  readonly VITE_PUBLIC_BICONOMY_MEE_URL?: string;
  readonly VITE_PUBLIC_NEURALRATE_AGENT_SMART_WALLET?: string;
  readonly VITE_PUBLIC_SESSION_POLICY_VERSION?: string;
  readonly VITE_PUBLIC_NEURALRATE_VAULT_PROVIDER_STRATEGY?: string;
  readonly VITE_PUBLIC_NEURALRATE_ONBOARDING_PROVIDER?: string;
  readonly VITE_PUBLIC_NEURALRATE_MANAGED_SIGNER_PROVIDER?: string;
  readonly VITE_PUBLIC_PRIVY_APP_ID?: string;
  readonly VITE_PUBLIC_PRIVY_CLIENT_ID?: string;
  readonly VITE_PUBLIC_NEURALRATE_SAFE_SALT_NONCE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
