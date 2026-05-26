import { expect } from "chai";
import { ethers } from "hardhat";

describe("NeuralRateVaultModule", function () {
  async function deployFixture() {
    const [owner, executor, otherAccount, recipient] = await ethers.getSigners();
    const Module = await ethers.getContractFactory("NeuralRateVaultModule");
    const module = await Module.deploy(executor.address);

    const MockSafe = await ethers.getContractFactory("MockSafeModuleAvatar");
    const safe = await MockSafe.deploy();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy("Mock USDY", "USDY", 18);

    await safe.setModule(await module.getAddress(), true);
    await token.mint(await safe.getAddress(), ethers.parseUnits("1000", 18));

    return { module, safe, token, owner, executor, otherAccount, recipient };
  }

  it("executes a real token transfer from the Safe when called by the authorized executor", async function () {
    const { module, safe, token, executor, otherAccount, recipient } = await deployFixture();
    const amount = ethers.parseUnits("50", 18);
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("vault-transfer"));
    const calldata = token.interface.encodeFunctionData("transfer", [recipient.address, amount]);

    await expect(
      module
        .connect(executor)
        .executeVaultCall(otherAccount.address, await safe.getAddress(), await token.getAddress(), 0, calldata, intentHash)
    )
      .to.emit(module, "VaultCallExecuted")
      .withArgs(otherAccount.address, await safe.getAddress(), await token.getAddress(), 0, "0xa9059cbb", intentHash);

    expect(await token.balanceOf(recipient.address)).to.equal(amount);
    expect(await token.balanceOf(await safe.getAddress())).to.equal(ethers.parseUnits("950", 18));
  });

  it("executes a native value transfer from the Safe when called by the authorized executor", async function () {
    const { module, safe, executor, otherAccount, recipient } = await deployFixture();
    const amount = ethers.parseEther("1");
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("native-transfer"));
    const balanceBefore = await ethers.provider.getBalance(recipient.address);

    await otherAccount.sendTransaction({
      to: await safe.getAddress(),
      value: amount,
    });

    await expect(
      module
        .connect(executor)
        .executeVaultCall(otherAccount.address, await safe.getAddress(), recipient.address, amount, "0x", intentHash)
    )
      .to.emit(module, "VaultCallExecuted")
      .withArgs(otherAccount.address, await safe.getAddress(), recipient.address, amount, "0x00000000", intentHash);

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
        .executeVaultCall(otherAccount.address, await safe.getAddress(), await token.getAddress(), 0, calldata, intentHash)
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
        .executeVaultCall(otherAccount.address, await safe.getAddress(), await token.getAddress(), 0, calldata, intentHash)
    ).to.be.revertedWith("Module not enabled");
  });
});
