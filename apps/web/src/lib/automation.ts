import Safe from '@safe-global/protocol-kit';
import type { MetaTransactionData } from '@safe-global/types-kit';
import {
  decodeFunctionResult,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  stringToHex,
  type EIP1193Provider,
} from 'viem';
import {
  DELEGATE_VALIDATOR_ADDRESS,
  NEURALRATE_EXECUTION_GUARD_CONTRACT,
  NEURALRATE_POLICY_REGISTRY_CONTRACT,
  NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS,
  SAFE_7579_ADAPTER_ADDRESS,
  SAFE_SALT_NONCE,
} from '../config';
import { describeRpcError, isRecoverableReadRpcError, withReadRpcFallback } from './rpcFallback';

export type PreparedAutomationSession = {
  sessionId: string;
  policyId: string;
  benchmarkPolicyId: string;
  policyVersion: string;
  userSmartAccount: string;
  agentSessionSigner: string;
  agentSmartWallet: string;
  benchmarkContract: string;
  chainId: number;
  executionPolicy: {
    usageLimit: number;
    validAfter: string;
    validUntil: string;
  };
};

export type SessionActivationResult = {
  userSmartAccount: string;
  grantTxHash: string | null;
  sessionDetails: Record<string, unknown>;
  permissionId: string | null;
  validAfter: string;
  validUntil: string;
  consentMessage: string;
  consentSignature: string;
  consentDigest: string;
  providerSessionRef: string;
  providerPermissionRef: string | null;
};

type WalletAccess = {
  getEthereumProvider: () => Promise<EIP1193Provider>;
  signMessage: (message: string) => Promise<string>;
};

type SafeInitArgs = {
  ownerAddress: string;
  provider: EIP1193Provider;
  saltNonce?: string;
};

type VaultModuleResult = {
  safeAddress: string;
  deploymentTxHash: string | null;
  moduleTxHash: string | null;
  alreadyEnabled: boolean;
};

type AutonomousRuntimeResult = VaultModuleResult & {
  aaMode: 'safe7579-delegate-validator';
  safe7579InstallTxHash: string | null;
  validatorInstallTxHash: string | null;
  validatorRotateTxHash: string | null;
  fallbackTxHash: string | null;
  moduleGuardTxHash: string | null;
  safe7579Enabled: boolean;
  delegateValidatorConfigured: boolean;
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const MODULE_TYPE_VALIDATOR = 1n;
const UNKNOWN_BLOCK_RETRY_DELAYS_MS = [800, 1500, 2500, 4000] as const;
const POST_RECEIPT_PROPAGATION_DELAY_MS = 900;
const safe7579AdapterAbi = [{
  type: 'function',
  name: 'initializeAccount',
  stateMutability: 'nonpayable',
  inputs: [
    {
      name: 'modules',
      type: 'tuple[]',
      components: [
        { name: 'module', type: 'address' },
        { name: 'initData', type: 'bytes' },
        { name: 'moduleType', type: 'uint256' },
      ],
    },
    {
      name: 'registryInit',
      type: 'tuple',
      components: [
        { name: 'registry', type: 'address' },
        { name: 'attesters', type: 'address[]' },
        { name: 'threshold', type: 'uint8' },
      ],
    },
  ],
  outputs: [],
}, {
  type: 'function',
  name: 'installModule',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'moduleType', type: 'uint256' },
    { name: 'module', type: 'address' },
    { name: 'initData', type: 'bytes' },
  ],
  outputs: [],
}] as const;

const delegateValidatorAbi = [
  {
    type: 'function',
    name: 'getDelegate',
    stateMutability: 'view',
    inputs: [{ name: 'smartAccount', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'setDelegate',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newDelegate', type: 'address' }],
    outputs: [],
  },
] as const;

const safeManagementAbi = [
  {
    type: 'function',
    name: 'enableModule',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'module', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setFallbackHandler',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'handler', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setModuleGuard',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'moduleGuard', type: 'address' }],
    outputs: [],
  },
] as const;

const buildPredictedSafe = async ({ ownerAddress, provider, saltNonce }: SafeInitArgs) =>
  Safe.init({
    provider: provider as any,
    signer: ownerAddress,
    predictedSafe: {
      safeAccountConfig: {
        owners: [ownerAddress],
        threshold: 1,
      },
      safeDeploymentConfig: {
        saltNonce: saltNonce ?? SAFE_SALT_NONCE,
        safeVersion: '1.5.0',
      },
    },
  });

const normalizeValue = (value: unknown) => {
  if (typeof value === 'bigint') {
    return `0x${value.toString(16)}`;
  }
  return value ?? '0x0';
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const isUnknownBlockError = (error: unknown) => /unknown block/i.test(describeRpcError(error));

const isSafeAlreadyDeployedError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as {
    message?: unknown;
    details?: unknown;
    shortMessage?: unknown;
    cause?: { message?: unknown; details?: unknown } | null;
  };

  const description = [
    record.message,
    record.details,
    record.shortMessage,
    record.cause?.message,
    record.cause?.details,
  ]
    .filter((value) => typeof value === 'string')
    .join(' ');

  return /safe already deployed/i.test(description);
};

const describeError = describeRpcError;

const retryOnUnknownBlock = async <T>(action: () => Promise<T>) => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= UNKNOWN_BLOCK_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (!isUnknownBlockError(error) || attempt === UNKNOWN_BLOCK_RETRY_DELAYS_MS.length) {
        throw error;
      }

      await wait(UNKNOWN_BLOCK_RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
};

const waitForTransactionReceipt = async (
  provider: EIP1193Provider,
  txHash: string,
  attempts = 40,
  delayMs = 1500
) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let receipt = null;
    try {
      receipt = await provider.request({
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      });
    } catch (error) {
      if (!isRecoverableReadRpcError(error)) {
        throw error;
      }
    }

    if (receipt) {
      await wait(POST_RECEIPT_PROPAGATION_DELAY_MS);
      return receipt;
    }

    await wait(delayMs);
  }

  throw new Error(`Transaction ${txHash} was not confirmed in time.`);
};

const openSafeByAddress = async (ownerAddress: string, provider: EIP1193Provider, safeAddress: string) =>
  retryOnUnknownBlock(() =>
    Safe.init({
      provider: provider as any,
      signer: ownerAddress,
      safeAddress,
    })
  );

const executeSafeTransactions = async (
  safe: Awaited<ReturnType<typeof openSafeByAddress>>,
  provider: EIP1193Provider,
  transactions: MetaTransactionData[],
  onProgress?: (status: 'signing' | 'confirming') => void
) => {
  const safeTx = await retryOnUnknownBlock(() => safe.createTransaction({ transactions }));
  onProgress?.('signing');
  const result = await retryOnUnknownBlock(() => safe.executeTransaction(safeTx));
  onProgress?.('confirming');
  await waitForTransactionReceipt(provider, result.hash);
  return result.hash;
};

const buildSafe7579SelfCall = (
  safeAddress: string,
  data: `0x${string}`
): MetaTransactionData => ({
  // Safe7579 mutating entrypoints must be reached through the Safe fallback handler.
  to: safeAddress,
  value: '0',
  data,
});

const buildEnableModuleSelfCall = (safeAddress: string, moduleAddress: string): MetaTransactionData => ({
  to: safeAddress,
  value: '0',
  data: encodeFunctionData({
    abi: safeManagementAbi,
    functionName: 'enableModule',
    args: [moduleAddress as `0x${string}`],
  }),
});

const buildFallbackHandlerSelfCall = (safeAddress: string, handlerAddress: string): MetaTransactionData => ({
  to: safeAddress,
  value: '0',
  data: encodeFunctionData({
    abi: safeManagementAbi,
    functionName: 'setFallbackHandler',
    args: [handlerAddress as `0x${string}`],
  }),
});

const buildModuleGuardSelfCall = (safeAddress: string, guardAddress: string): MetaTransactionData => ({
  to: safeAddress,
  value: '0',
  data: encodeFunctionData({
    abi: safeManagementAbi,
    functionName: 'setModuleGuard',
    args: [guardAddress as `0x${string}`],
  }),
});

const readContractViaProvider = async (
  provider: EIP1193Provider,
  call: { to: string; data: string }
) =>
  retryOnUnknownBlock(() =>
    provider.request({
      method: 'eth_call',
      params: [call, 'latest'],
    }) as Promise<string>
  );

const buildDelegateValidatorInitData = (delegateAddress: string, vaultModuleAddress: string) =>
  encodeAbiParameters(
    [
      { name: 'delegate', type: 'address' },
      { name: 'policyRegistry', type: 'address' },
      { name: 'vaultModule', type: 'address' },
    ],
    [
      delegateAddress as `0x${string}`,
      (NEURALRATE_POLICY_REGISTRY_CONTRACT || ZERO_ADDRESS) as `0x${string}`,
      (vaultModuleAddress || ZERO_ADDRESS) as `0x${string}`,
    ]
  );

const getInstalledDelegate = async (
  provider: EIP1193Provider,
  safeAddress: string,
  validatorAddress: string
) => {
  const data = encodeFunctionData({
    abi: delegateValidatorAbi,
    functionName: 'getDelegate',
    args: [safeAddress as `0x${string}`],
  });
  const result = await readContractViaProvider(provider, { to: validatorAddress, data });
  return decodeFunctionResult({
    abi: delegateValidatorAbi,
    functionName: 'getDelegate',
    data: result as `0x${string}`,
  }).toLowerCase();
};

export async function resolveUserSafeVault(
  ownerAddress: string,
  wallet: WalletAccess,
  saltNonce?: string
) {
  const provider = withReadRpcFallback(await wallet.getEthereumProvider());
  const safe = await retryOnUnknownBlock(() =>
    buildPredictedSafe({
      ownerAddress,
      provider,
      saltNonce,
    })
  );

  const safeAddress = (await safe.getAddress()).toLowerCase();
  const isDeployed = await retryOnUnknownBlock(() => safe.isSafeDeployed());

  if (isDeployed) {
    return {
      safeAddress,
      isDeployed: true,
      deploymentRequest: null,
    };
  }

  let deployment: Awaited<ReturnType<typeof safe.createSafeDeploymentTransaction>>;
  try {
    deployment = await retryOnUnknownBlock(() => safe.createSafeDeploymentTransaction());
  } catch (error) {
    if (isSafeAlreadyDeployedError(error)) {
      return {
        safeAddress,
        isDeployed: true,
        deploymentRequest: null,
      };
    }
    throw error;
  }

  return {
    safeAddress,
    isDeployed,
    deploymentRequest: {
      from: ownerAddress,
      to: deployment.to,
      data: deployment.data,
      value: normalizeValue(deployment.value),
    },
  };
}

export async function deployUserSafeVault(
  ownerAddress: string,
  wallet: WalletAccess,
  saltNonce?: string
) {
  const provider = withReadRpcFallback(await wallet.getEthereumProvider());
  const predicted = await resolveUserSafeVault(ownerAddress, wallet, saltNonce);

  if (predicted.isDeployed) {
    return {
      safeAddress: predicted.safeAddress,
      txHash: null,
      alreadyDeployed: true,
    };
  }

  const txHash = await retryOnUnknownBlock(() =>
    provider.request({
      method: 'eth_sendTransaction',
      params: [predicted.deploymentRequest!],
    })
  );

  return {
    safeAddress: predicted.safeAddress,
    txHash: String(txHash),
    alreadyDeployed: false,
  };
}

export async function ensureAutonomousVaultRuntime(
  ownerAddress: string,
  wallet: WalletAccess,
  moduleAddress: string,
  saltNonce?: string,
  onProgress?: (stepKey: string, status: 'signing' | 'confirming' | 'done' | 'failed') => void
): Promise<AutonomousRuntimeResult> {
  if (!SAFE_7579_ADAPTER_ADDRESS || !DELEGATE_VALIDATOR_ADDRESS) {
    throw new Error('Configure Safe7579 adapter and delegate validator addresses before enabling AA runtime.');
  }
  if (!NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS || /^0x0{40}$/i.test(NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS)) {
    throw new Error('Configure the NeuralRate agent session signer address before enabling AA runtime.');
  }

  const provider = withReadRpcFallback(await wallet.getEthereumProvider());

  const predicted = await resolveUserSafeVault(ownerAddress, wallet, saltNonce);
  if (!predicted.isDeployed) {
    onProgress?.('deploy_safe', 'signing');
  } else {
    onProgress?.('deploy_safe', 'done');
  }

  let deployment;
  try {
    deployment = await deployUserSafeVault(ownerAddress, wallet, saltNonce);
    if (deployment.txHash) {
      onProgress?.('deploy_safe', 'confirming');
      await waitForTransactionReceipt(provider, deployment.txHash);
      onProgress?.('deploy_safe', 'done');
    }
  } catch (error) {
    onProgress?.('deploy_safe', 'failed');
    throw error;
  }

  const safeAddress = deployment.safeAddress;
  const safe = await openSafeByAddress(ownerAddress, provider, safeAddress);
  let moduleTxHash: string | null = null;
  const vaultModuleAlreadyEnabled = await retryOnUnknownBlock(() => safe.isModuleEnabled(moduleAddress));
  let moduleGuardTxHash: string | null = null;
  let safe7579InstallTxHash: string | null = null;
  let validatorInstallTxHash: string | null = null;
  let validatorRotateTxHash: string | null = null;
  let fallbackTxHash: string | null = null;
  const safe7579Enabled = await retryOnUnknownBlock(() => safe.isModuleEnabled(SAFE_7579_ADAPTER_ADDRESS));
  const fallbackHandler = (await retryOnUnknownBlock(() => safe.getFallbackHandler())).toLowerCase();
  const fallbackHandlerReady = fallbackHandler === SAFE_7579_ADAPTER_ADDRESS.toLowerCase();
  const currentModuleGuard = NEURALRATE_EXECUTION_GUARD_CONTRACT
    ? (await retryOnUnknownBlock(() => safe.getModuleGuard())).toLowerCase()
    : ZERO_ADDRESS;
  const moduleGuardReady = Boolean(
    NEURALRATE_EXECUTION_GUARD_CONTRACT &&
    currentModuleGuard === NEURALRATE_EXECUTION_GUARD_CONTRACT.toLowerCase()
  );
  const installedDelegate = await retryOnUnknownBlock(() =>
    getInstalledDelegate(provider, safeAddress, DELEGATE_VALIDATOR_ADDRESS)
  );
  const delegateValidatorInitData = buildDelegateValidatorInitData(
    NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS,
    moduleAddress
  );

  const setupTransactions: MetaTransactionData[] = [];
  const touchedSteps = new Set<string>();

  if (!vaultModuleAlreadyEnabled) {
    setupTransactions.push(buildEnableModuleSelfCall(safeAddress, moduleAddress));
    touchedSteps.add('vault_module');
  }
  if (!safe7579Enabled) {
    setupTransactions.push(buildEnableModuleSelfCall(safeAddress, SAFE_7579_ADAPTER_ADDRESS));
    touchedSteps.add('safe7579');
  }
  if (!fallbackHandlerReady) {
    setupTransactions.push(buildFallbackHandlerSelfCall(safeAddress, SAFE_7579_ADAPTER_ADDRESS));
    touchedSteps.add('fallback');
  }
  if (NEURALRATE_EXECUTION_GUARD_CONTRACT && !moduleGuardReady) {
    setupTransactions.push(buildModuleGuardSelfCall(safeAddress, NEURALRATE_EXECUTION_GUARD_CONTRACT));
    touchedSteps.add('guard');
  }
  if (installedDelegate === ZERO_ADDRESS) {
    const validatorCall = safe7579Enabled && fallbackHandlerReady
      ? encodeFunctionData({
          abi: safe7579AdapterAbi,
          functionName: 'installModule',
          args: [
            MODULE_TYPE_VALIDATOR,
            DELEGATE_VALIDATOR_ADDRESS as `0x${string}`,
            delegateValidatorInitData,
          ],
        })
      : encodeFunctionData({
          abi: safe7579AdapterAbi,
          functionName: 'initializeAccount',
          args: [
            [
              {
                module: DELEGATE_VALIDATOR_ADDRESS as `0x${string}`,
                initData: delegateValidatorInitData,
                moduleType: MODULE_TYPE_VALIDATOR,
              },
            ],
            {
              registry: ZERO_ADDRESS as `0x${string}`,
              attesters: [] as `0x${string}`[],
              threshold: 0,
            },
          ],
        });
    setupTransactions.push(buildSafe7579SelfCall(safeAddress, validatorCall));
    touchedSteps.add('delegate');
  } else if (installedDelegate !== NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS.toLowerCase()) {
    setupTransactions.push({
      to: DELEGATE_VALIDATOR_ADDRESS,
      value: '0',
      data: encodeFunctionData({
        abi: delegateValidatorAbi,
        functionName: 'setDelegate',
        args: [NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS as `0x${string}`],
      }),
    });
    touchedSteps.add('delegate');
  }

  for (const key of ['vault_module', 'safe7579', 'fallback', 'delegate', 'guard']) {
    if (!touchedSteps.has(key)) {
      onProgress?.(key, 'done');
    }
  }

  if (setupTransactions.length > 0) {
    try {
      const setupTxHash = await executeSafeTransactions(
        safe,
        provider,
        setupTransactions,
        (status) => {
          for (const step of touchedSteps) {
            onProgress?.(step, status);
          }
        }
      );
      for (const step of touchedSteps) {
        onProgress?.(step, 'done');
      }
      if (touchedSteps.has('vault_module')) moduleTxHash = setupTxHash;
      if (touchedSteps.has('safe7579')) safe7579InstallTxHash = setupTxHash;
      if (touchedSteps.has('fallback')) fallbackTxHash = setupTxHash;
      if (touchedSteps.has('guard')) moduleGuardTxHash = setupTxHash;
      if (touchedSteps.has('delegate')) {
        if (installedDelegate === ZERO_ADDRESS) {
          validatorInstallTxHash = setupTxHash;
        } else {
          validatorRotateTxHash = setupTxHash;
        }
      }
    } catch (error) {
      for (const step of touchedSteps) {
        onProgress?.(step, 'failed');
      }
      const detail = describeError(error);
      throw new Error(`Failed to activate the canonical Safe7579/ERC-4337 runtime.${detail ? ` ${detail}` : ''}`);
    }
  }

  return {
    aaMode: 'safe7579-delegate-validator',
    safeAddress,
    deploymentTxHash: deployment.txHash,
    moduleTxHash,
    alreadyEnabled: vaultModuleAlreadyEnabled,
    safe7579InstallTxHash,
    validatorInstallTxHash,
    validatorRotateTxHash,
    fallbackTxHash,
    moduleGuardTxHash,
    safe7579Enabled: true,
    delegateValidatorConfigured: true,
  };
}

export async function disableVaultModule(
  ownerAddress: string,
  wallet: WalletAccess,
  safeAddress: string,
  moduleAddress: string
) {
  const provider = withReadRpcFallback(await wallet.getEthereumProvider());
  const safe = await openSafeByAddress(ownerAddress, provider, safeAddress);
  const enabled = await retryOnUnknownBlock(() => safe.isModuleEnabled(moduleAddress));
  if (!enabled) {
    return null;
  }

  const disableModuleTx = await retryOnUnknownBlock(() => safe.createDisableModuleTx(moduleAddress));
  const result = await retryOnUnknownBlock(() => safe.executeTransaction(disableModuleTx));
  await waitForTransactionReceipt(provider, result.hash);
  return result.hash;
}

const buildConsentMessage = (ownerAddress: string, preparedSession: PreparedAutomationSession) => [
  'NeuralRate Vault Automation Consent',
  `Owner: ${ownerAddress.toLowerCase()}`,
  `Vault: ${preparedSession.userSmartAccount.toLowerCase()}`,
  `Policy: ${preparedSession.policyId}`,
  `Benchmark Policy: ${preparedSession.benchmarkPolicyId}`,
  `Session: ${preparedSession.sessionId}`,
  `Policy Version: ${preparedSession.policyVersion}`,
  `Chain ID: ${preparedSession.chainId}`,
  `Agent Wallet: ${preparedSession.agentSmartWallet.toLowerCase()}`,
  `Agent Session Signer: ${preparedSession.agentSessionSigner.toLowerCase()}`,
  `Benchmark Contract: ${preparedSession.benchmarkContract.toLowerCase()}`,
  `Valid After: ${preparedSession.executionPolicy.validAfter}`,
  `Valid Until: ${preparedSession.executionPolicy.validUntil}`,
  `Usage Limit: ${preparedSession.executionPolicy.usageLimit}`,
  '',
  'I approve NeuralRate to automate actions only within this dedicated user vault and within the recorded policy limits.',
].join('\n');

export async function authorizeAutomationSession(args: {
  ownerAddress: string;
  preparedSession: PreparedAutomationSession;
  wallet: WalletAccess;
  providerUserId?: string | null;
  walletProvider: string;
}) {
  const consentMessage = buildConsentMessage(args.ownerAddress, args.preparedSession);
  const consentSignature = await args.wallet.signMessage(consentMessage);
  const consentHash = keccak256(stringToHex(`${consentMessage}\n${consentSignature}`));
  const providerPermissionRef = `${args.walletProvider}:${consentHash}`;
  const providerSessionRef = `${args.walletProvider}:${args.providerUserId || args.ownerAddress.toLowerCase()}`;

  return {
    userSmartAccount: args.preparedSession.userSmartAccount.toLowerCase(),
    grantTxHash: null,
    sessionDetails: {
      consentMessage,
      consentSignature,
      consentDigest: consentHash,
      providerSessionRef,
      providerPermissionRef,
      automationModel: 'privy-safe-turnkey',
    },
    permissionId: consentHash,
    validAfter: args.preparedSession.executionPolicy.validAfter,
    validUntil: args.preparedSession.executionPolicy.validUntil,
    consentMessage,
    consentSignature,
    consentDigest: consentHash,
    providerSessionRef,
    providerPermissionRef,
  } satisfies SessionActivationResult;
}
