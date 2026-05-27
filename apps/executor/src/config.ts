const required = (name: string, fallback?: string) => {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const optional = (name: string, fallback?: string) => process.env[name] ?? fallback ?? null;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const requiredAddress = (name: string) => {
  const value = required(name).trim();
  if (value.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
    throw new Error(`Environment variable ${name} is still set to the zero address placeholder.`);
  }
  return value;
};

export const config = {
  port: Number(process.env.EXECUTOR_PORT || 8788),
  dataApiBaseUrl: required("NEURALRATE_DATA_API_BASE_URL", "http://127.0.0.1:8787/api"),
  mantleSepoliaRpcUrl: required("MANTLE_SEPOLIA_RPC_URL", "https://rpc.sepolia.mantle.xyz"),
  biconomyApiKey: optional("BICONOMY_API_KEY"),
  biconomyMeeUrl: optional("BICONOMY_MEE_URL"),
  vaultProviderStrategy: required("NEURALRATE_VAULT_PROVIDER_STRATEGY", "safe"),
  onboardingProvider: required("NEURALRATE_ONBOARDING_PROVIDER", "privy"),
  managedSignerProvider: required("NEURALRATE_MANAGED_SIGNER_PROVIDER", "turnkey"),
  benchmarkContract: requiredAddress("NEURALRATE_BENCHMARK_CONTRACT"),
  policyRegistryContract: optional("NEURALRATE_POLICY_REGISTRY_CONTRACT"),
  executionGuardContract: optional("NEURALRATE_EXECUTION_GUARD_CONTRACT"),
  safe4337ModuleAddress: optional("NEURALRATE_SAFE_4337_MODULE_ADDRESS"),
  safe7579AdapterAddress: optional("NEURALRATE_SAFE_7579_ADAPTER_ADDRESS"),
  agentSmartWallet: requiredAddress("NEURALRATE_AGENT_SMART_WALLET"),
  agentSessionSignerAddress: requiredAddress("NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS"),
  sessionPolicyVersion: required("NEURALRATE_SESSION_POLICY_VERSION", "v1"),
  internalApiToken: required("NEURALRATE_INTERNAL_API_TOKEN", "local-neuralrate-internal"),
  managedSignerUrl: optional("NEURALRATE_MANAGED_SIGNER_URL"),
  managedSignerToken: optional("NEURALRATE_MANAGED_SIGNER_TOKEN"),
  turnkeyApiBaseUrl: required("TURNKEY_API_BASE_URL", "https://api.turnkey.com"),
  turnkeyOrganizationId: optional("TURNKEY_ORGANIZATION_ID"),
  turnkeyApiPublicKey: optional("TURNKEY_API_PUBLIC_KEY"),
  turnkeyApiPrivateKey: optional("TURNKEY_API_PRIVATE_KEY"),
  turnkeyWalletAccountAddress: optional("TURNKEY_WALLET_ACCOUNT_ADDRESS", process.env.NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS),
  turnkeyWalletAccountId: optional("TURNKEY_WALLET_ACCOUNT_ID"),
};
