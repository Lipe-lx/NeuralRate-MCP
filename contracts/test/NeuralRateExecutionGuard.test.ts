import { expect } from "chai";
import { ethers } from "hardhat";

describe("NeuralRateExecutionGuard", function () {
  async function deployFixture() {
    const [deployer, ownerEoa, delegate, recipient] = await ethers.getSigners();
    const PolicyRegistry = await ethers.getContractFactory("NeuralRatePolicyRegistry");
    const policyRegistry = await PolicyRegistry.deploy();

    const MockSafe = await ethers.getContractFactory("MockSafeModuleAvatar");
    const safe = await MockSafe.deploy();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy("Mock USDY", "USDY", 18);

    const Module = await ethers.getContractFactory("NeuralRateVaultModule");
    const module = await Module.deploy(delegate.address, ethers.ZeroAddress);

    const Guard = await ethers.getContractFactory("NeuralRateExecutionGuard");
    const guard = await Guard.deploy(await policyRegistry.getAddress(), await module.getAddress());
    await module.setExecutionGuard(await guard.getAddress());

    await safe.setModule(await module.getAddress(), true);
    await safe.setModuleGuard(await guard.getAddress());
    await token.mint(await safe.getAddress(), ethers.parseUnits("1000", 18));

    const block = await ethers.provider.getBlock("latest");
    const now = Number(block?.timestamp ?? Math.floor(Date.now() / 1000));

    await policyRegistry.connect(ownerEoa).publishPolicy(
      ownerEoa.address,
      await safe.getAddress(),
      delegate.address,
      ethers.parseUnits("100", 18),
      ethers.parseUnits("150", 18),
      ethers.parseUnits("500", 18),
      now - 60,
      now + 7200,
      50,
      true,
      "vault-v2",
      ["USDY"],
      ["neuralrate-vault-module"],
      [await token.getAddress()],
      ["0xa9059cbb"]
    );

    const snapshotHash = ethers.keccak256(ethers.toUtf8Bytes("anchored-snapshot"));
    await policyRegistry.connect(delegate).anchorSnapshot(
      await safe.getAddress(),
      snapshotHash,
      "ipfs://anchored-snapshot",
      "defillama+fred+nansen"
    );

    return { ownerEoa, delegate, recipient, safe, token, module, guard, policyRegistry, snapshotHash };
  }

  it("requires an anchored snapshot when the active policy says so", async function () {
    const { module, safe, token, delegate, ownerEoa, recipient } = await deployFixture();
    const amount = ethers.parseUnits("10", 18);
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("needs-snapshot"));
    const calldata = token.interface.encodeFunctionData("transfer", [recipient.address, amount]);
    const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

    await expect(
      module.connect(delegate).executeVaultCall(
        ownerEoa.address,
        await safe.getAddress(),
        await token.getAddress(),
        0,
        calldata,
        intentHash,
        ethers.ZeroHash,
        25,
        deadline
      )
    ).to.be.revertedWith("Snapshot not anchored");
  });

  it("blocks alternate enabled modules through the Safe module guard", async function () {
    const { safe, token, recipient, guard } = await deployFixture();
    const OtherModule = await ethers.getContractFactory("MockModuleCaller");
    const otherModule = await OtherModule.deploy();
    const amount = ethers.parseUnits("10", 18);
    const calldata = token.interface.encodeFunctionData("transfer", [recipient.address, amount]);

    await safe.setModule(await otherModule.getAddress(), true);
    expect(await safe.moduleGuard()).to.equal(await guard.getAddress());

    await expect(
      otherModule.executeViaSafe(await safe.getAddress(), await token.getAddress(), 0, calldata)
    ).to.be.revertedWith("Untrusted module");
  });

  it("advertises the Safe module guard interface for Safe 1.5.0 installation", async function () {
    const { guard } = await deployFixture();
    expect(await guard.supportsInterface("0x58401ed8")).to.equal(true);
    expect(await guard.supportsInterface("0x01ffc9a7")).to.equal(true);
  });

  it("permits AA executions where the Safe is the effective executor", async function () {
    const { module, safe, token, ownerEoa, recipient, snapshotHash } = await deployFixture();
    const amount = ethers.parseUnits("10", 18);
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("aa-execution"));
    const calldata = token.interface.encodeFunctionData("transfer", [recipient.address, amount]);
    const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
    const moduleCall = module.interface.encodeFunctionData("executeVaultCall", [
      ownerEoa.address,
      await safe.getAddress(),
      await token.getAddress(),
      0,
      calldata,
      intentHash,
      snapshotHash,
      25,
      deadline,
    ]);

    await expect(
      safe.callAsSafe(await module.getAddress(), moduleCall)
    ).to.emit(module, "VaultCallExecuted");
  });
});
