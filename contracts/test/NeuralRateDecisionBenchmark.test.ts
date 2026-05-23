import { expect } from "chai";
import { ethers } from "hardhat";

describe("NeuralRateDecisionBenchmark", function () {
  async function deployFixture() {
    const [owner, benchmarkWriter, otherAccount] = await ethers.getSigners();
    const NeuralRateDecisionBenchmark = await ethers.getContractFactory("NeuralRateDecisionBenchmark");
    const contract = await NeuralRateDecisionBenchmark.deploy(benchmarkWriter.address);
    return { contract, owner, benchmarkWriter, otherAccount };
  }

  it("Should set the right benchmark writer", async function () {
    const { contract, owner, benchmarkWriter } = await deployFixture();
    expect(await contract.owner()).to.equal(owner.address);
    expect(await contract.benchmarkWriter()).to.equal(benchmarkWriter.address);
    expect(await contract.agent()).to.equal(benchmarkWriter.address);
  });

  it("Should create a decision and emit event", async function () {
    const { contract, benchmarkWriter, otherAccount } = await deployFixture();

    const tx = await contract.connect(benchmarkWriter).createDecision(
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
    const { contract, benchmarkWriter, otherAccount } = await deployFixture();

    await contract.connect(benchmarkWriter).createDecision(otherAccount.address, "QmHashSnapshot123", 500, 24);

    // realized: 550 (5.5%), tbill: 400 (4%)
    // prediction error = 550 - 500 = 50
    // outperformance = 550 - 400 = 150
    const tx = await contract.connect(benchmarkWriter).settleDecision(1, 550, 400);

    await expect(tx)
      .to.emit(contract, "DecisionSettled")
      .withArgs(1, 550, 50, 150);

    const decision = await contract.decisions(1);
    expect(decision.isSettled).to.be.true;
  });

  it("Should reject calls from non-writer", async function () {
    const { contract, otherAccount } = await deployFixture();

    await expect(
      contract.connect(otherAccount).createDecision(otherAccount.address, "Qm", 100, 24)
    ).to.be.revertedWith("Only benchmark writer can call this");
  });

  it("Should allow the owner to rotate the benchmark writer", async function () {
    const { contract, owner, benchmarkWriter, otherAccount } = await deployFixture();

    await expect(contract.connect(owner).setBenchmarkWriter(otherAccount.address))
      .to.emit(contract, "BenchmarkWriterUpdated")
      .withArgs(benchmarkWriter.address, otherAccount.address);

    expect(await contract.benchmarkWriter()).to.equal(otherAccount.address);
  });
});
