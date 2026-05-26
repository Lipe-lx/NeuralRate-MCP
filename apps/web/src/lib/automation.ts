import Safe from '@safe-global/protocol-kit';
import { keccak256, stringToHex, type EIP1193Provider } from 'viem';
import { SAFE_SALT_NONCE } from '../config';

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

const waitForTransactionReceipt = async (
  provider: EIP1193Provider,
  txHash: string,
  attempts = 40,
  delayMs = 1500
) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const receipt = await provider.request({
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    });

    if (receipt) {
      return receipt;
    }

    await wait(delayMs);
  }

  throw new Error(`Transaction ${txHash} was not confirmed in time.`);
};

const openSafeByAddress = async (ownerAddress: string, provider: EIP1193Provider, safeAddress: string) =>
  Safe.init({
    provider: provider as any,
    signer: ownerAddress,
    safeAddress,
  });

export async function resolveUserSafeVault(
  ownerAddress: string,
  wallet: WalletAccess,
  saltNonce?: string
) {
  const provider = await wallet.getEthereumProvider();
  const safe = await buildPredictedSafe({
    ownerAddress,
    provider,
    saltNonce,
  });

  const deployment = await safe.createSafeDeploymentTransaction();
  const safeAddress = (await safe.getAddress()).toLowerCase();
  const isDeployed = await safe.isSafeDeployed();

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
  const provider = await wallet.getEthereumProvider();
  const predicted = await resolveUserSafeVault(ownerAddress, wallet, saltNonce);

  if (predicted.isDeployed) {
    return {
      safeAddress: predicted.safeAddress,
      txHash: null,
      alreadyDeployed: true,
    };
  }

  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [predicted.deploymentRequest],
  });

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
  saltNonce?: string
): Promise<VaultModuleResult> {
  const provider = await wallet.getEthereumProvider();
  const deployment = await deployUserSafeVault(ownerAddress, wallet, saltNonce);

  if (deployment.txHash) {
    await waitForTransactionReceipt(provider, deployment.txHash);
  }

  const safe = await openSafeByAddress(ownerAddress, provider, deployment.safeAddress);
  const alreadyEnabled = await safe.isModuleEnabled(moduleAddress);
  if (alreadyEnabled) {
    return {
      safeAddress: deployment.safeAddress,
      deploymentTxHash: deployment.txHash,
      moduleTxHash: null,
      alreadyEnabled: true,
    };
  }

  const enableModuleTx = await safe.createEnableModuleTx(moduleAddress);
  const result = await safe.executeTransaction(enableModuleTx);
  await waitForTransactionReceipt(provider, result.hash);

  return {
    safeAddress: deployment.safeAddress,
    deploymentTxHash: deployment.txHash,
    moduleTxHash: result.hash,
    alreadyEnabled: false,
  };
}

export async function disableVaultModule(
  ownerAddress: string,
  wallet: WalletAccess,
  safeAddress: string,
  moduleAddress: string
) {
  const provider = await wallet.getEthereumProvider();
  const safe = await openSafeByAddress(ownerAddress, provider, safeAddress);
  const enabled = await safe.isModuleEnabled(moduleAddress);
  if (!enabled) {
    return null;
  }

  const disableModuleTx = await safe.createDisableModuleTx(moduleAddress);
  const result = await safe.executeTransaction(disableModuleTx);
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
