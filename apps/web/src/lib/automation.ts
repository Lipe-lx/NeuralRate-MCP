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

export async function ensureVaultModuleEnabled(
  ownerAddress: string,
  wallet: WalletAccess,
  moduleAddress: string,
  saltNonce?: string,
  onProgress?: (stepKey: string, status: 'signing' | 'confirming' | 'done' | 'failed') => void
): Promise<VaultModuleResult> {
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

  const safe = await openSafeByAddress(ownerAddress, provider, deployment.safeAddress);
  const alreadyEnabled = await retryOnUnknownBlock(() => safe.isModuleEnabled(moduleAddress));
  if (alreadyEnabled) {
    onProgress?.('vault_module', 'done');
    return {
      safeAddress: deployment.safeAddress,
      deploymentTxHash: deployment.txHash,
      moduleTxHash: null,
      alreadyEnabled: true,
    };
  }

  onProgress?.('vault_module', 'signing');
  let result;
  try {
    const enableModuleTx = await retryOnUnknownBlock(() => safe.createEnableModuleTx(moduleAddress));
    result = await retryOnUnknownBlock(() => safe.executeTransaction(enableModuleTx));
    onProgress?.('vault_module', 'confirming');
    await waitForTransactionReceipt(provider, result.hash);
    onProgress?.('vault_module', 'done');
  } catch (error) {
    onProgress?.('vault_module', 'failed');
    throw error;
  }

  return {
    safeAddress: deployment.safeAddress,
    deploymentTxHash: deployment.txHash,
    moduleTxHash: result.hash,
    alreadyEnabled: false,
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

  // 1. deploy_safe
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

  let safe = await openSafeByAddress(ownerAddress, provider, deployment.safeAddress);
  let moduleTxHash: string | null = null;

  // 2. vault_module
  const vaultModuleAlreadyEnabled = await retryOnUnknownBlock(() => safe.isModuleEnabled(moduleAddress));
  if (!vaultModuleAlreadyEnabled) {
    onProgress?.('vault_module', 'signing');
    try {
      const enableModuleTx = await retryOnUnknownBlock(() => safe.createEnableModuleTx(moduleAddress));
      const result = await retryOnUnknownBlock(() => safe.executeTransaction(enableModuleTx));
      onProgress?.('vault_module', 'confirming');
      await waitForTransactionReceipt(provider, result.hash);
      moduleTxHash = result.hash;
      safe = await openSafeByAddress(ownerAddress, provider, deployment.safeAddress);
      onProgress?.('vault_module', 'done');
    } catch (error) {
      onProgress?.('vault_module', 'failed');
      throw error;
    }
  } else {
    onProgress?.('vault_module', 'done');
  }

  let moduleGuardTxHash: string | null = null;
  let safe7579InstallTxHash: string | null = null;
  let validatorInstallTxHash: string | null = null;
  let validatorRotateTxHash: string | null = null;
  let fallbackTxHash: string | null = null;
  let safe7579InitError: string | null = null;

  const safe7579Enabled = await retryOnUnknownBlock(() => safe.isModuleEnabled(SAFE_7579_ADAPTER_ADDRESS));
  const delegateValidatorInitData = buildDelegateValidatorInitData(
    NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS,
    moduleAddress
  );

  // 3. safe7579
  if (!safe7579Enabled) {
    onProgress?.('safe7579', 'signing');
    try {
      const enableSafe7579ModuleTx = await retryOnUnknownBlock(() => safe.createEnableModuleTx(SAFE_7579_ADAPTER_ADDRESS));
      const enableSafe7579ModuleResult = await retryOnUnknownBlock(() => safe.executeTransaction(enableSafe7579ModuleTx));
      onProgress?.('safe7579', 'confirming');
      await waitForTransactionReceipt(provider, enableSafe7579ModuleResult.hash);
      safe7579InstallTxHash = enableSafe7579ModuleResult.hash;
      safe = await openSafeByAddress(ownerAddress, provider, deployment.safeAddress);
      onProgress?.('safe7579', 'done');
    } catch (error) {
      onProgress?.('safe7579', 'failed');
      throw error;
    }
  } else {
    onProgress?.('safe7579', 'done');
  }

  // 4. fallback
  const fallbackHandler = (await retryOnUnknownBlock(() => safe.getFallbackHandler())).toLowerCase();
  if (fallbackHandler !== SAFE_7579_ADAPTER_ADDRESS.toLowerCase()) {
    onProgress?.('fallback', 'signing');
    try {
      const enableFallbackTx = await retryOnUnknownBlock(() =>
        safe.createEnableFallbackHandlerTx(SAFE_7579_ADAPTER_ADDRESS)
      );
      const result = await retryOnUnknownBlock(() => safe.executeTransaction(enableFallbackTx));
      onProgress?.('fallback', 'confirming');
      await waitForTransactionReceipt(provider, result.hash);
      fallbackTxHash = result.hash;
      safe = await openSafeByAddress(ownerAddress, provider, deployment.safeAddress);
      onProgress?.('fallback', 'done');
    } catch (error) {
      onProgress?.('fallback', 'failed');
      throw error;
    }
  } else {
    onProgress?.('fallback', 'done');
  }

  try {
    onProgress?.('safe7579', 'signing');
    await executeSafeTransactions(
      safe,
      provider,
      [
        buildSafe7579SelfCall(
          deployment.safeAddress,
          encodeFunctionData({
            abi: safe7579AdapterAbi,
            functionName: 'initializeAccount',
            args: [
              [],
              {
                registry: ZERO_ADDRESS as `0x${string}`,
                attesters: [] as `0x${string}`[],
                threshold: 0,
              },
            ],
          })
        ),
      ],
      (status) => onProgress?.('safe7579', status)
    );
    safe = await openSafeByAddress(ownerAddress, provider, deployment.safeAddress);
    onProgress?.('safe7579', 'done');
  } catch (error) {
    safe7579InitError = describeError(error) || 'Safe7579 initializeAccount reverted.';
    onProgress?.('safe7579', 'done');
  }

  const installedDelegate = await retryOnUnknownBlock(() =>
    getInstalledDelegate(provider, deployment.safeAddress, DELEGATE_VALIDATOR_ADDRESS)
  );
  
  // 5. delegate
  if (installedDelegate === ZERO_ADDRESS) {
    onProgress?.('delegate', 'signing');
    try {
      validatorInstallTxHash = await executeSafeTransactions(
        safe,
        provider,
        [
          buildSafe7579SelfCall(
            deployment.safeAddress,
            encodeFunctionData({
              abi: safe7579AdapterAbi,
              functionName: 'installModule',
              args: [
                MODULE_TYPE_VALIDATOR,
                DELEGATE_VALIDATOR_ADDRESS as `0x${string}`,
                delegateValidatorInitData,
              ],
            })
          ),
        ],
        (status) => onProgress?.('delegate', status)
      );
      safe = await openSafeByAddress(ownerAddress, provider, deployment.safeAddress);
      onProgress?.('delegate', 'done');
    } catch (error) {
      onProgress?.('delegate', 'failed');
      throw error;
    }
  } else if (installedDelegate !== NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS.toLowerCase()) {
    onProgress?.('delegate', 'signing');
    try {
      validatorRotateTxHash = await executeSafeTransactions(
        safe,
        provider,
        [
          {
            to: DELEGATE_VALIDATOR_ADDRESS,
            value: '0',
            data: encodeFunctionData({
              abi: delegateValidatorAbi,
              functionName: 'setDelegate',
              args: [NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS as `0x${string}`],
            }),
          },
        ],
        (status) => onProgress?.('delegate', status)
      );
      safe = await openSafeByAddress(ownerAddress, provider, deployment.safeAddress);
      onProgress?.('delegate', 'done');
    } catch (error) {
      onProgress?.('delegate', 'failed');
      throw error;
    }
  } else {
    onProgress?.('delegate', 'done');
  }

  if (safe7579InitError && !validatorInstallTxHash && installedDelegate === ZERO_ADDRESS) {
    throw new Error(`Failed to initialize Safe7579 adapter for the existing Safe. ${safe7579InitError}`);
  }

  // 6. guard
  if (NEURALRATE_EXECUTION_GUARD_CONTRACT) {
    const currentModuleGuard = (await retryOnUnknownBlock(() => safe.getModuleGuard())).toLowerCase();
    if (currentModuleGuard !== NEURALRATE_EXECUTION_GUARD_CONTRACT.toLowerCase()) {
      onProgress?.('guard', 'signing');
      try {
        const enableModuleGuardTx = await retryOnUnknownBlock(() =>
          safe.createEnableModuleGuardTx(NEURALRATE_EXECUTION_GUARD_CONTRACT)
        );
        const result = await retryOnUnknownBlock(() => safe.executeTransaction(enableModuleGuardTx));
        onProgress?.('guard', 'confirming');
        await waitForTransactionReceipt(provider, result.hash);
        moduleGuardTxHash = result.hash;
        onProgress?.('guard', 'done');
      } catch (error) {
        onProgress?.('guard', 'failed');
        const detail = describeError(error);
        throw new Error(
          `Failed to enable execution guard after runtime prerequisites were installed.${
            detail ? ` ${detail}` : ''
          }`
        );
      }
    } else {
      onProgress?.('guard', 'done');
    }
  }

  return {
    aaMode: 'safe7579-delegate-validator',
    safeAddress: deployment.safeAddress,
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
