import { ethers } from "hardhat";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { BaseContract, ContractFactory } from "ethers";

type DeploymentManifest = {
  network: string;
  chainId: number;
  contractName: string;
  address: string;
  txHash: string;
  expectedBytecodeHash: string;
  constructorArgs: readonly unknown[];
  updatedAt: string;
};

const MANTLE_SEPOLIA_CHAIN_ID = 5003;
const DEFAULT_ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const DEFAULT_ERC7484_REGISTRY = "0x000000000069E2a187AEFFb852bF3cCdC95151B2";
const repoRoot = path.resolve(__dirname, "../..");
const deploymentDir = path.join(repoRoot, "deployments");

const safe7579Artifact = JSON.parse(
  readFileSync(path.join(repoRoot, "contracts/vendor/safe7579/Safe7579.json"), "utf8")
);
const safe7579LaunchpadArtifact = JSON.parse(
  readFileSync(path.join(repoRoot, "contracts/vendor/safe7579/Safe7579Launchpad.json"), "utf8")
);
const safe4337Artifact = JSON.parse(
  readFileSync(
    path.join(
      repoRoot,
      "node_modules/@safe-global/safe-4337/build/artifacts/contracts/Safe4337Module.sol/Safe4337Module.json"
    ),
    "utf8"
  )
);
const safeModuleSetupArtifact = JSON.parse(
  readFileSync(
    path.join(
      repoRoot,
      "node_modules/@safe-global/safe-4337/build/artifacts/contracts/SafeModuleSetup.sol/SafeModuleSetup.json"
    ),
    "utf8"
  )
);

const waitForRuntimeCode = async (address: string, attempts = 12, delayMs = 2000) => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const runtimeCode = await ethers.provider.getCode(address);
    if (runtimeCode && runtimeCode !== "0x") {
      return runtimeCode;
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`No runtime bytecode found at ${address} after ${attempts} attempts.`);
};

const manifestPathFor = (artifactName: string) =>
  path.join(deploymentDir, `mantle-sepolia-${artifactName}.json`);

const readManifest = (artifactName: string): DeploymentManifest | null => {
  const manifestPath = manifestPathFor(artifactName);
  if (!existsSync(manifestPath)) {
    return null;
  }

  return JSON.parse(readFileSync(manifestPath, "utf8")) as DeploymentManifest;
};

const estimateDeployGasLimit = async (
  factory: ContractFactory,
  signerAddress: string,
  deployArgs: readonly unknown[] = []
) => {
  const deployTx = await factory.getDeployTransaction(...deployArgs);
  if (!deployTx.data) {
    throw new Error("Deploy transaction is missing init code.");
  }

  const estimatedGas = await ethers.provider.estimateGas({
    from: signerAddress,
    data: deployTx.data,
  });

  // Mantle Sepolia can fluctuate slightly on contract deployments; keep a modest buffer.
  return (estimatedGas * 120n) / 100n;
};

const writeManifest = async (args: {
  contractName: string;
  artifactName: string;
  contract: BaseContract;
  constructorArgs?: readonly unknown[];
}) => {
  const address = await args.contract.getAddress();
  const runtimeCode = await waitForRuntimeCode(address);
  const expectedBytecodeHash = ethers.keccak256(runtimeCode);
  const txHash = args.contract.deploymentTransaction()?.hash ?? "";
  const manifest: DeploymentManifest = {
    network: "mantleSepolia",
    chainId: MANTLE_SEPOLIA_CHAIN_ID,
    contractName: args.contractName,
    address,
    txHash,
    expectedBytecodeHash,
    constructorArgs: args.constructorArgs ?? [],
    updatedAt: new Date().toISOString(),
  };

  mkdirSync(deploymentDir, { recursive: true });
  const manifestPath = manifestPathFor(args.artifactName);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`${args.contractName} deployed to ${address}`);
  console.log(`Manifest written to ${manifestPath}`);

  return manifest;
};

const reuseManifestIfPresent = async (artifactName: string) => {
  const manifest = readManifest(artifactName);
  if (!manifest) {
    return null;
  }

  const runtimeCode = await ethers.provider.getCode(manifest.address);
  if (!runtimeCode || runtimeCode === "0x") {
    return null;
  }

  console.log(`Reusing ${manifest.contractName} at ${manifest.address}`);
  return manifest;
};

async function main() {
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== MANTLE_SEPOLIA_CHAIN_ID) {
    throw new Error(`This deploy script is locked to Mantle Sepolia (5003). Current chainId: ${chainId}`);
  }

  const entryPointAddress = process.env.NEURALRATE_4337_ENTRYPOINT_ADDRESS?.trim() || DEFAULT_ENTRYPOINT;
  const registryAddress = process.env.NEURALRATE_ERC7484_REGISTRY_ADDRESS?.trim() || DEFAULT_ERC7484_REGISTRY;

  const [signer] = await ethers.getSigners();
  console.log(`Deploying AA stack from ${signer.address}`);
  console.log(`EntryPoint: ${entryPointAddress}`);
  console.log(`ERC-7484 registry: ${registryAddress}`);

  const delegateValidatorFactory = await ethers.getContractFactory("NeuralRateDelegateValidator");
  const safeModuleSetupFactory = new ethers.ContractFactory(
    safeModuleSetupArtifact.abi,
    safeModuleSetupArtifact.bytecode,
    signer
  );
  const safe7579Factory = new ethers.ContractFactory(
    safe7579Artifact.abi,
    safe7579Artifact.bytecode.object,
    signer
  );
  const safe7579LaunchpadFactory = new ethers.ContractFactory(
    safe7579LaunchpadArtifact.abi,
    safe7579LaunchpadArtifact.bytecode.object,
    signer
  );
  const safe4337Factory = new ethers.ContractFactory(
    safe4337Artifact.abi,
    safe4337Artifact.bytecode,
    signer
  );

  const manifests = {
    delegateValidator:
      await reuseManifestIfPresent("delegate-validator") ||
      await (async () => {
        const gasLimit = await estimateDeployGasLimit(delegateValidatorFactory, signer.address);
        const contract = await delegateValidatorFactory.deploy({ gasLimit });
        await contract.waitForDeployment();
        return writeManifest({
          contractName: "NeuralRateDelegateValidator",
          artifactName: "delegate-validator",
          contract,
        });
      })(),
    safeModuleSetup:
      await reuseManifestIfPresent("safe-module-setup") ||
      await (async () => {
        const gasLimit = await estimateDeployGasLimit(safeModuleSetupFactory, signer.address);
        const contract = await safeModuleSetupFactory.deploy({ gasLimit });
        await contract.waitForDeployment();
        return writeManifest({
          contractName: "SafeModuleSetup",
          artifactName: "safe-module-setup",
          contract,
        });
      })(),
    safe7579:
      await reuseManifestIfPresent("safe7579-adapter") ||
      await (async () => {
        const gasLimit = await estimateDeployGasLimit(safe7579Factory, signer.address);
        const contract = await safe7579Factory.deploy({ gasLimit });
        await contract.waitForDeployment();
        return writeManifest({
          contractName: "Safe7579",
          artifactName: "safe7579-adapter",
          contract,
        });
      })(),
    safe7579Launchpad:
      await reuseManifestIfPresent("safe7579-launchpad") ||
      await (async () => {
        const gasLimit = await estimateDeployGasLimit(
          safe7579LaunchpadFactory,
          signer.address,
          [entryPointAddress, registryAddress]
        );
        const contract = await safe7579LaunchpadFactory.deploy(entryPointAddress, registryAddress, { gasLimit });
        await contract.waitForDeployment();
        return writeManifest({
          contractName: "Safe7579Launchpad",
          artifactName: "safe7579-launchpad",
          contract,
          constructorArgs: [entryPointAddress, registryAddress],
        });
      })(),
    safe4337Module:
      await reuseManifestIfPresent("safe4337-module") ||
      await (async () => {
        const gasLimit = await estimateDeployGasLimit(safe4337Factory, signer.address, [entryPointAddress]);
        const contract = await safe4337Factory.deploy(entryPointAddress, { gasLimit });
        await contract.waitForDeployment();
        return writeManifest({
          contractName: "Safe4337Module",
          artifactName: "safe4337-module",
          contract,
          constructorArgs: [entryPointAddress],
        });
      })(),
  };

  const generatedPath = path.join(repoRoot, "apps/executor/src/generated/aaDeployments.ts");
  writeFileSync(
    generatedPath,
    `import type { Address, Hex } from "viem";

export const aaDeployments = {
  chainId: ${MANTLE_SEPOLIA_CHAIN_ID},
  entryPointAddress: "${entryPointAddress}" as Address,
  registryAddress: "${registryAddress}" as Address,
  safe4337ModuleAddress: "${manifests.safe4337Module.address}" as Address,
  safeModuleSetupAddress: "${manifests.safeModuleSetup.address}" as Address,
  safe7579AdapterAddress: "${manifests.safe7579.address}" as Address,
  safe7579LaunchpadAddress: "${manifests.safe7579Launchpad.address}" as Address,
  delegateValidatorAddress: "${manifests.delegateValidator.address}" as Address,
  safe4337BytecodeHash: "${manifests.safe4337Module.expectedBytecodeHash}" as Hex,
  safe7579BytecodeHash: "${manifests.safe7579.expectedBytecodeHash}" as Hex,
};\n`
  );
  console.log(`Generated ${generatedPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
