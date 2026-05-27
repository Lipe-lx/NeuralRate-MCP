const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const defaultLocalOrigin = 'http://localhost:8787';
const defaultPublicWorkerOrigin = 'https://neuralrate-worker.neuralrate.workers.dev';
const defaultPublicRpcUrl = 'https://rpc.sepolia.mantle.xyz';
const defaultExplorerBaseUrl = 'https://sepolia.mantlescan.xyz';
const defaultBenchmarkContract = '0xc51560a5512d2A5756435d87319aeaE1bA480165';
const defaultErc8004AgentId = '49';
const defaultErc8004IdentityRegistry = '0x8004A818BFB912233c491871b3d84c89A494BD9e';
const defaultAgentSmartWallet = '0x0000000000000000000000000000000000000000';
const defaultSessionPolicyVersion = 'v1';
const defaultVaultProviderStrategy = 'safe-primary';
const defaultOnboardingProvider = 'privy';
const defaultManagedSignerProvider = 'turnkey';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const publicPrivyAppId = import.meta.env.VITE_PUBLIC_PRIVY_APP_ID?.trim();
const publicPrivyClientId = import.meta.env.VITE_PUBLIC_PRIVY_CLIENT_ID?.trim();
const publicSafeSaltNonce = import.meta.env.VITE_PUBLIC_NEURALRATE_SAFE_SALT_NONCE?.trim();

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const publicApiBaseUrl = import.meta.env.VITE_PUBLIC_API_BASE_URL?.trim();
const publicMcpHttpUrl = import.meta.env.VITE_PUBLIC_MCP_HTTP_URL?.trim();
const publicScopedMcpHttpUrl = import.meta.env.VITE_PUBLIC_MCP_SCOPED_HTTP_URL?.trim();
const publicMcpSseUrl = import.meta.env.VITE_PUBLIC_MCP_SSE_URL?.trim();
const publicScopedMcpSseUrl = import.meta.env.VITE_PUBLIC_MCP_SCOPED_SSE_URL?.trim();
const publicRpcUrl = import.meta.env.VITE_PUBLIC_MANTLE_RPC_URL?.trim();
const publicExplorerBaseUrl = import.meta.env.VITE_PUBLIC_MANTLE_EXPLORER_BASE_URL?.trim();
const publicBenchmarkContract = import.meta.env.VITE_PUBLIC_NEURALRATE_BENCHMARK_CONTRACT?.trim();
const publicPolicyRegistryContract = import.meta.env.VITE_PUBLIC_NEURALRATE_POLICY_REGISTRY_CONTRACT?.trim();
const publicExecutionGuardContract = import.meta.env.VITE_PUBLIC_NEURALRATE_EXECUTION_GUARD_CONTRACT?.trim();
const publicErc8004AgentId = import.meta.env.VITE_PUBLIC_ERC8004_AGENT_ID?.trim();
const publicErc8004IdentityRegistry = import.meta.env.VITE_PUBLIC_ERC8004_IDENTITY_REGISTRY?.trim();
const publicBiconomyApiKey = import.meta.env.VITE_PUBLIC_BICONOMY_API_KEY?.trim();
const publicBiconomyMeeUrl = import.meta.env.VITE_PUBLIC_BICONOMY_MEE_URL?.trim();
const publicAgentSmartWallet = import.meta.env.VITE_PUBLIC_NEURALRATE_AGENT_SMART_WALLET?.trim();
const publicAgentSessionSigner = import.meta.env.VITE_PUBLIC_NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS?.trim();
const publicSessionPolicyVersion = import.meta.env.VITE_PUBLIC_SESSION_POLICY_VERSION?.trim();
const publicVaultProviderStrategy = import.meta.env.VITE_PUBLIC_NEURALRATE_VAULT_PROVIDER_STRATEGY?.trim();
const publicOnboardingProvider = import.meta.env.VITE_PUBLIC_NEURALRATE_ONBOARDING_PROVIDER?.trim();
const publicManagedSignerProvider = import.meta.env.VITE_PUBLIC_NEURALRATE_MANAGED_SIGNER_PROVIDER?.trim();
const publicSafe4337ModuleAddress = import.meta.env.VITE_PUBLIC_NEURALRATE_SAFE_4337_MODULE_ADDRESS?.trim();
const publicSafe7579AdapterAddress = import.meta.env.VITE_PUBLIC_NEURALRATE_SAFE_7579_ADAPTER_ADDRESS?.trim();
const publicSafe7579LaunchpadAddress = import.meta.env.VITE_PUBLIC_NEURALRATE_SAFE_7579_LAUNCHPAD_ADDRESS?.trim();
const publicDelegateValidatorAddress = import.meta.env.VITE_PUBLIC_NEURALRATE_DELEGATE_VALIDATOR_ADDRESS?.trim();
const public4337EntryPointAddress = import.meta.env.VITE_PUBLIC_NEURALRATE_4337_ENTRYPOINT_ADDRESS?.trim();
const publicDemoStrategyKey = import.meta.env.VITE_PUBLIC_NEURALRATE_DEMO_STRATEGY_KEY?.trim();
const publicDemoTargetAsset = import.meta.env.VITE_PUBLIC_NEURALRATE_DEMO_TARGET_ASSET?.trim();
const publicVaultModuleAddress = import.meta.env.VITE_PUBLIC_NEURALRATE_VAULT_MODULE_ADDRESS?.trim();
const normalizeAddress = (value?: string | null) =>
  value && value.toLowerCase() !== ZERO_ADDRESS.toLowerCase() ? value : '';

const workerOrigin = isLocal
  ? defaultLocalOrigin
  : trimTrailingSlash(
      publicApiBaseUrl?.replace(/\/api\/?$/, '') ||
      publicMcpHttpUrl?.replace(/\/mcp\/?$/, '') ||
      publicMcpSseUrl?.replace(/\/sse\/?$/, '') ||
      defaultPublicWorkerOrigin
    );

export const API_BASE_URL = isLocal
  ? `${defaultLocalOrigin}/api`
  : trimTrailingSlash(publicApiBaseUrl || `${workerOrigin}/api`);

export const MCP_HTTP_URL = isLocal
  ? `${defaultLocalOrigin}/mcp`
  : trimTrailingSlash(publicMcpHttpUrl || `${workerOrigin}/mcp`);

export const MCP_SCOPED_HTTP_URL = isLocal
  ? `${defaultLocalOrigin}/mcp/scoped/execution`
  : trimTrailingSlash(publicScopedMcpHttpUrl || `${workerOrigin}/mcp/scoped/execution`);

export const SSE_URL = isLocal
  ? `${defaultLocalOrigin}/sse`
  : trimTrailingSlash(publicMcpSseUrl || `${workerOrigin}/sse`);

export const SCOPED_SSE_URL = isLocal
  ? `${defaultLocalOrigin}/sse/scoped/execution`
  : trimTrailingSlash(publicScopedMcpSseUrl || `${workerOrigin}/sse/scoped/execution`);

export const MCP_PROTOCOL_URL = MCP_HTTP_URL.replace(/^http/, 'mcp+sse');
export const MANTLE_RPC_URL = trimTrailingSlash(publicRpcUrl || defaultPublicRpcUrl);
export const MANTLE_EXPLORER_BASE_URL = trimTrailingSlash(publicExplorerBaseUrl || defaultExplorerBaseUrl);
export const NEURALRATE_BENCHMARK_CONTRACT = publicBenchmarkContract || defaultBenchmarkContract;
export const NEURALRATE_POLICY_REGISTRY_CONTRACT = normalizeAddress(publicPolicyRegistryContract);
export const NEURALRATE_EXECUTION_GUARD_CONTRACT = normalizeAddress(publicExecutionGuardContract);
export const ERC8004_AGENT_ID = publicErc8004AgentId || defaultErc8004AgentId;
export const ERC8004_IDENTITY_REGISTRY = publicErc8004IdentityRegistry || defaultErc8004IdentityRegistry;
export const BICONOMY_API_KEY = publicBiconomyApiKey || '';
export const BICONOMY_MEE_URL = publicBiconomyMeeUrl || '';
export const NEURALRATE_AGENT_SMART_WALLET = normalizeAddress(publicAgentSmartWallet) || defaultAgentSmartWallet;
export const NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS = normalizeAddress(publicAgentSessionSigner) || defaultAgentSmartWallet;
export const SESSION_POLICY_VERSION = publicSessionPolicyVersion || defaultSessionPolicyVersion;
export const VAULT_PROVIDER_STRATEGY = publicVaultProviderStrategy || defaultVaultProviderStrategy;
export const ONBOARDING_PROVIDER = publicOnboardingProvider || defaultOnboardingProvider;
export const MANAGED_SIGNER_PROVIDER = publicManagedSignerProvider || defaultManagedSignerProvider;
export const SAFE_4337_MODULE_ADDRESS = normalizeAddress(publicSafe4337ModuleAddress);
export const SAFE_7579_ADAPTER_ADDRESS = normalizeAddress(publicSafe7579AdapterAddress);
export const SAFE_7579_LAUNCHPAD_ADDRESS = normalizeAddress(publicSafe7579LaunchpadAddress);
export const DELEGATE_VALIDATOR_ADDRESS = normalizeAddress(publicDelegateValidatorAddress);
export const AA_ENTRYPOINT_ADDRESS = normalizeAddress(public4337EntryPointAddress) || '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
export const PRIVY_APP_ID = publicPrivyAppId || '';
export const PRIVY_CLIENT_ID = publicPrivyClientId || '';
export const PRIVY_ENABLED = Boolean(PRIVY_APP_ID);
export const SAFE_SALT_NONCE = publicSafeSaltNonce || '49';
export const DEMO_STRATEGY_KEY = publicDemoStrategyKey || 'mnt-native-transfer';
export const DEMO_TARGET_ASSET = publicDemoTargetAsset || 'MNT';
export const VAULT_MODULE_ADDRESS = normalizeAddress(publicVaultModuleAddress);
export const VAULT_MODULE_ENABLED = Boolean(VAULT_MODULE_ADDRESS);
