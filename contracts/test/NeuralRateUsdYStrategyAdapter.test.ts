import { expect } from "chai";
import { ethers } from "hardhat";

describe("NeuralRateUsdYStrategyAdapter", function () {
  async function deployFixture() {
    const [owner, executor, otherAccount] = await ethers.getSigners();
    const Adapter = await ethers.getContractFactory("NeuralRateUsdYStrategyAdapter");
    const contract = await Adapter.deploy(executor.address);
    return { contract, owner, executor, otherAccount };
  }

  it("sets the expected owner and authorized executor", async function () {
    const { contract, owner, executor } = await deployFixture();
    expect(await contract.owner()).to.equal(owner.address);
    expect(await contract.authorizedExecutor()).to.equal(executor.address);
  });

  it("records a USDY stable allocation execution", async function () {
    const { contract, executor, otherAccount } = await deployFixture();
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("usdy-intent"));

    const tx = await contract
      .connect(executor)
      .executeUsdYStableAllocation(otherAccount.address, otherAccount.address, 1000, 50, intentHash);

    await expect(tx)
      .to.emit(contract, "UsdYStableAllocationExecuted")
      .withArgs(1, otherAccount.address, otherAccount.address, 1000, 50, intentHash);

    const execution = await contract.executions(1);
    expect(execution.amountUsd).to.equal(1000);
    expect(execution.slippageBps).to.equal(50);
    expect(execution.intentHash).to.equal(intentHash);
  });

  it("rejects calls from accounts other than the authorized executor", async function () {
    const { contract, otherAccount } = await deployFixture();
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("usdy-intent"));

    await expect(
      contract
        .connect(otherAccount)
        .executeUsdYStableAllocation(otherAccount.address, otherAccount.address, 1000, 50, intentHash)
    ).to.be.revertedWith("Only executor can call this");
  });

  it("allows the owner to rotate the authorized executor", async function () {
    const { contract, owner, executor, otherAccount } = await deployFixture();

    await expect(contract.connect(owner).setAuthorizedExecutor(otherAccount.address))
      .to.emit(contract, "AuthorizedExecutorUpdated")
      .withArgs(executor.address, otherAccount.address);

    expect(await contract.authorizedExecutor()).to.equal(otherAccount.address);
  });
});
