import { expect } from "chai";
import { ethers } from "hardhat";

describe("StableSyncDecisionBenchmark", function () {
  async function deployFixture() {
    const [agent, otherAccount] = await ethers.getSigners();
    const StableSyncDecisionBenchmark = await ethers.getContractFactory("StableSyncDecisionBenchmark");
    const contract = await StableSyncDecisionBenchmark.deploy();
    return { contract, agent, otherAccount };
  }

  it("Should set the right agent", async function () {
    const { contract, agent } = await deployFixture();
    expect(await contract.agent()).to.equal(agent.address);
  });

  it("Should create a decision and emit event", async function () {
    const { contract, agent, otherAccount } = await deployFixture();

    const tx = await contract.createDecision(
      otherAccount.address,
      "QmHashSnapshot123",
      500, // 5% APY
      24 // 24 hours
    );

    await expect(tx)
      .to.emit(contract, "DecisionCreated")
      .withArgs(1, otherAccount.address, "QmHashSnapshot123", 500, 24);

    const decision = await contract.decisions(1);
    expect(decision.isSettled).to.be.false;
  });

  it("Should settle a decision correctly", async function () {
    const { contract, agent, otherAccount } = await deployFixture();

    await contract.createDecision(otherAccount.address, "QmHashSnapshot123", 500, 24);

    // realized: 550 (5.5%), tbill: 400 (4%)
    // prediction error = 550 - 500 = 50
    // outperformance = 550 - 400 = 150
    const tx = await contract.settleDecision(1, 550, 400);

    await expect(tx)
      .to.emit(contract, "DecisionSettled")
      .withArgs(1, 550, 50, 150);

    const decision = await contract.decisions(1);
    expect(decision.isSettled).to.be.true;
  });

  it("Should reject calls from non-agent", async function () {
    const { contract, otherAccount } = await deployFixture();

    await expect(
      contract.connect(otherAccount).createDecision(otherAccount.address, "Qm", 100, 24)
    ).to.be.revertedWith("Only registered agent can call this");
  });
});
