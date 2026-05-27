import { expect } from "chai";
import { ethers } from "hardhat";

describe("NeuralRateVaultModule", function () {
  async function deployFixture() {
    const [owner, executor, otherAccount, recipient] = await ethers.getSigners();
    const MockSafe = await ethers.getContractFactory("MockSafeModuleAvatar");
    const safe = await MockSafe.deploy();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy("Mock USDY", "USDY", 18);

    const PolicyRegistry = await ethers.getContractFactory("NeuralRatePolicyRegistry");
    const policyRegistry = await PolicyRegistry.deploy();

    const Module = await ethers.getContractFactory("NeuralRateVaultModule");
    const module = await Module.deploy(executor.address, ethers.ZeroAddress);

    const ExecutionGuard = await ethers.getContractFactory("NeuralRateExecutionGuard");
    const executionGuard = await ExecutionGuard.deploy(await policyRegistry.getAddress(), await module.getAddress());
    await module.setExecutionGuard(await executionGuard.getAddress());

    await safe.setModule(await module.getAddress(), true);
    await safe.setModuleGuard(await executionGuard.getAddress());
    await token.mint(await safe.getAddress(), ethers.parseUnits("1000", 18));

    const block = await ethers.provider.getBlock("latest");
    const now = Number(block?.timestamp ?? Math.floor(Date.now() / 1000));

    await policyRegistry.connect(otherAccount).publishPolicy(
      otherAccount.address,
      await safe.getAddress(),
      executor.address,
      ethers.parseUnits("100", 18),
      ethers.parseUnits("1000", 18),
      ethers.parseUnits("2000", 18),
      now - 60,
      now + 3600,
      50,
      false,
      "vault-v2",
      ["USDY"],
      ["neuralrate-vault-module"],
      [await token.getAddress()],
      ["0xa9059cbb"]
    );

    return { module, safe, token, owner, executor, otherAccount, recipient, policyRegistry, executionGuard };
  }

  it("executes a real token transfer from the Safe when called by the authorized executor", async function () {
    const { module, safe, token, executor, otherAccount, recipient } = await deployFixture();
    const amount = ethers.parseUnits("50", 18);
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("vault-transfer"));
    const calldata = token.interface.encodeFunctionData("transfer", [recipient.address, amount]);

    await expect(
      module
        .connect(executor)
        .executeVaultCall(
          otherAccount.address,
          await safe.getAddress(),
          await token.getAddress(),
          0,
          calldata,
          intentHash,
          ethers.ZeroHash,
          25,
          (await ethers.provider.getBlock("latest"))!.timestamp + 3600
        )
    )
      .to.emit(module, "VaultCallExecuted")
      .withArgs(
        otherAccount.address,
        await safe.getAddress(),
        await token.getAddress(),
        0,
        "0xa9059cbb",
        intentHash,
        ethers.ZeroHash
      );

    expect(await token.balanceOf(recipient.address)).to.equal(amount);
    expect(await token.balanceOf(await safe.getAddress())).to.equal(ethers.parseUnits("950", 18));
  });

  it("executes a native value transfer from the Safe when called by the authorized executor", async function () {
    const { module, safe, executor, otherAccount, recipient, policyRegistry } = await deployFixture();
    const amount = ethers.parseEther("1");
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("native-transfer"));
    const balanceBefore = await ethers.provider.getBalance(recipient.address);
    const block = await ethers.provider.getBlock("latest");

    await policyRegistry.connect(otherAccount).revokeActivePolicy(otherAccount.address, await safe.getAddress());
    await policyRegistry.connect(otherAccount).publishPolicy(
      otherAccount.address,
      await safe.getAddress(),
      executor.address,
      amount,
      ethers.parseEther("5"),
      ethers.parseEther("10"),
      Number(block?.timestamp ?? 0) - 60,
      Number(block?.timestamp ?? 0) + 3600,
      0,
      false,
      "vault-v2-native",
      ["MNT"],
      ["neuralrate-vault-module"],
      [],
      ["0x00000000"]
    );

    await otherAccount.sendTransaction({
      to: await safe.getAddress(),
      value: amount,
    });

    await expect(
      module
        .connect(executor)
        .executeVaultCall(
          otherAccount.address,
          await safe.getAddress(),
          recipient.address,
          amount,
          "0x",
          intentHash,
          ethers.ZeroHash,
          0,
          (block?.timestamp ?? 0) + 3600
        )
    )
      .to.emit(module, "VaultCallExecuted")
      .withArgs(
        otherAccount.address,
        await safe.getAddress(),
        recipient.address,
        amount,
        "0x00000000",
        intentHash,
        ethers.ZeroHash
      );

    const balanceAfter = await ethers.provider.getBalance(recipient.address);
    expect(balanceAfter - balanceBefore).to.equal(amount);
  });

  it("rejects calls from accounts other than the authorized executor", async function () {
    const { module, safe, token, otherAccount, recipient } = await deployFixture();
    const amount = ethers.parseUnits("1", 18);
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("vault-transfer"));
    const calldata = token.interface.encodeFunctionData("transfer", [recipient.address, amount]);

    await expect(
      module
        .connect(otherAccount)
        .executeVaultCall(
          otherAccount.address,
          await safe.getAddress(),
          await token.getAddress(),
          0,
          calldata,
          intentHash,
          ethers.ZeroHash,
          0,
          (await ethers.provider.getBlock("latest"))!.timestamp + 3600
        )
    ).to.be.revertedWith("Only executor can call this");
  });

  it("reverts when the Safe has not enabled the module", async function () {
    const { module, safe, token, executor, otherAccount, recipient } = await deployFixture();
    const amount = ethers.parseUnits("1", 18);
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("vault-transfer"));
    const calldata = token.interface.encodeFunctionData("transfer", [recipient.address, amount]);

    await safe.setModule(await module.getAddress(), false);

    await expect(
      module
        .connect(executor)
        .executeVaultCall(
          otherAccount.address,
          await safe.getAddress(),
          await token.getAddress(),
          0,
          calldata,
          intentHash,
          ethers.ZeroHash,
          0,
          (await ethers.provider.getBlock("latest"))!.timestamp + 3600
        )
    ).to.be.revertedWith("Module not enabled");
  });

  it("blocks replayed intent hashes through the execution guard", async function () {
    const { module, safe, token, executor, otherAccount, recipient } = await deployFixture();
    const amount = ethers.parseUnits("10", 18);
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("same-intent"));
    const calldata = token.interface.encodeFunctionData("transfer", [recipient.address, amount]);
    const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

    await module
      .connect(executor)
      .executeVaultCall(
        otherAccount.address,
        await safe.getAddress(),
        await token.getAddress(),
        0,
        calldata,
        intentHash,
        ethers.ZeroHash,
        25,
        deadline
      );

    await expect(
      module
        .connect(executor)
        .executeVaultCall(
          otherAccount.address,
          await safe.getAddress(),
          await token.getAddress(),
          0,
          calldata,
          intentHash,
          ethers.ZeroHash,
          25,
          deadline
        )
    ).to.be.revertedWith("Intent hash already consumed");
  });
});
