import { expect } from "chai";
import { ethers } from "hardhat";

describe("NeuralRateDelegateValidator", function () {
  const executeAbi = [
    "function execute(bytes32 mode, bytes executionCalldata)"
  ];
  const CALLTYPE_SINGLE_MODE = `0x${"00".repeat(32)}`;

  const encodeSingleExecution = (target: string, value: bigint, callData = "0x") =>
    ethers.solidityPacked(["address", "uint256", "bytes"], [target, value, callData]);

  const buildAccountCallData = (target: string) => {
    const iface = new ethers.Interface(executeAbi);
    return iface.encodeFunctionData("execute", [
      CALLTYPE_SINGLE_MODE,
      encodeSingleExecution(target, 0n),
    ]);
  };

  async function deployFixture() {
    const [smartAccount] = await ethers.getSigners();
    const delegate = ethers.Wallet.createRandom();
    const otherSigner = ethers.Wallet.createRandom();
    const Validator = await ethers.getContractFactory("NeuralRateDelegateValidator");
    const validator = await Validator.deploy();
    const MockTarget = await ethers.getContractFactory("MockModuleCaller");
    const policyRegistry = await MockTarget.deploy();
    const vaultModule = await MockTarget.deploy();

    await validator.connect(smartAccount).onInstall(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "address"],
        [delegate.address, await policyRegistry.getAddress(), await vaultModule.getAddress()]
      )
    );

    return { validator, smartAccount, delegate, otherSigner, policyRegistry, vaultModule };
  }

  it("validates a raw hash signed by the installed delegate", async function () {
    const { validator, smartAccount, delegate, vaultModule } = await deployFixture();
    const digest = ethers.keccak256(ethers.toUtf8Bytes("delegate-userop"));
    const signature = delegate.signingKey.sign(digest).serialized;
    const userOp = {
      sender: smartAccount.address,
      nonce: 0,
      initCode: "0x",
      callData: buildAccountCallData(await vaultModule.getAddress()),
      accountGasLimits: ethers.ZeroHash,
      preVerificationGas: 0,
      gasFees: ethers.ZeroHash,
      paymasterAndData: "0x",
      signature,
    };

    expect(await validator.validateUserOp(userOp, digest)).to.equal(0);
    expect(await validator.isValidSignatureWithSender(smartAccount.address, digest, signature)).to.equal("0x1626ba7e");
  });

  it("fails validation for non-delegate signatures", async function () {
    const { validator, smartAccount, otherSigner, vaultModule } = await deployFixture();
    const digest = ethers.keccak256(ethers.toUtf8Bytes("invalid-userop"));
    const signature = otherSigner.signingKey.sign(digest).serialized;
    const userOp = {
      sender: smartAccount.address,
      nonce: 0,
      initCode: "0x",
      callData: buildAccountCallData(await vaultModule.getAddress()),
      accountGasLimits: ethers.ZeroHash,
      preVerificationGas: 0,
      gasFees: ethers.ZeroHash,
      paymasterAndData: "0x",
      signature,
    };

    expect(await validator.validateUserOp(userOp, digest)).to.equal(1);
    expect(await validator.isValidSignatureWithSender(smartAccount.address, digest, signature)).to.equal("0xffffffff");
  });

  it("fails validation when the user operation targets an out-of-scope contract", async function () {
    const { validator, smartAccount, delegate, otherSigner } = await deployFixture();
    const digest = ethers.keccak256(ethers.toUtf8Bytes("wrong-target"));
    const signature = delegate.signingKey.sign(digest).serialized;
    const userOp = {
      sender: smartAccount.address,
      nonce: 0,
      initCode: "0x",
      callData: buildAccountCallData(otherSigner.address),
      accountGasLimits: ethers.ZeroHash,
      preVerificationGas: 0,
      gasFees: ethers.ZeroHash,
      paymasterAndData: "0x",
      signature,
    };

    expect(await validator.validateUserOp(userOp, digest)).to.equal(1);
  });

  it("lets the smart account rotate its delegate", async function () {
    const { validator, smartAccount, delegate, otherSigner } = await deployFixture();
    await expect(validator.connect(smartAccount).setDelegate(otherSigner.address))
      .to.emit(validator, "DelegateUpdated")
      .withArgs(smartAccount.address, delegate.address, otherSigner.address);

    expect(await validator.getDelegate(smartAccount.address)).to.equal(otherSigner.address);
  });
});
