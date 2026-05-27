import { expect } from "chai";
import { ethers } from "hardhat";

describe("NeuralRateDecisionReceiptRegistry", function () {
  async function deployFixture() {
    const [owner, receiptWriter, delegate, vaultOwner] = await ethers.getSigners();
    const ReceiptRegistry = await ethers.getContractFactory("NeuralRateDecisionReceiptRegistry");
    const contract = await ReceiptRegistry.deploy(receiptWriter.address);
    return { contract, owner, receiptWriter, delegate, vaultOwner };
  }

  it("sets the receipt writer on deployment", async function () {
    const { contract, owner, receiptWriter } = await deployFixture();
    expect(await contract.owner()).to.equal(owner.address);
    expect(await contract.receiptWriter()).to.equal(receiptWriter.address);
  });

  it("creates a decision receipt with the richer audit fields", async function () {
    const { contract, receiptWriter, delegate, vaultOwner } = await deployFixture();
    const snapshotHash = ethers.keccak256(ethers.toUtf8Bytes("snapshot-1"));

    await expect(
      contract.connect(receiptWriter).createDecisionReceipt(
        vaultOwner.address,
        "0x1111111111111111111111111111111111111111",
        delegate.address,
        "decision_001",
        "vault-v2",
        "mnt-native-transfer",
        snapshotHash,
        "ipfs://snapshot-1",
        500,
        24
      )
    )
      .to.emit(contract, "DecisionReceiptCreated")
      .withArgs(
        1,
        "decision_001",
        "0x1111111111111111111111111111111111111111",
        delegate.address,
        "vault-v2",
        "mnt-native-transfer",
        snapshotHash,
        "ipfs://snapshot-1",
        500,
        24
      );

    const receipt = await contract.receipts(1);
    expect(receipt.settled).to.equal(false);
    expect(receipt.snapshotHash).to.equal(snapshotHash);
    expect(receipt.delegate).to.equal(delegate.address);
  });

  it("settles a receipt and emits the derived benchmark math", async function () {
    const { contract, receiptWriter, delegate, vaultOwner } = await deployFixture();
    const snapshotHash = ethers.keccak256(ethers.toUtf8Bytes("snapshot-2"));

    await contract.connect(receiptWriter).createDecisionReceipt(
      vaultOwner.address,
      "0x1111111111111111111111111111111111111111",
      delegate.address,
      "decision_002",
      "vault-v2",
      "mnt-native-transfer",
      snapshotHash,
      "ipfs://snapshot-2",
      500,
      24
    );

    await expect(contract.connect(receiptWriter).settleDecisionReceipt(1, 575, 420))
      .to.emit(contract, "DecisionReceiptSettled")
      .withArgs(1, 575, 420, 75, 155);

    const receipt = await contract.receipts(1);
    expect(receipt.settled).to.equal(true);
    expect(receipt.realizedApyBps).to.equal(575);
  });

  it("rejects calls from non-writers", async function () {
    const { contract, delegate } = await deployFixture();
    const snapshotHash = ethers.keccak256(ethers.toUtf8Bytes("snapshot-3"));

    await expect(
      contract.connect(delegate).createDecisionReceipt(
        delegate.address,
        "0x1111111111111111111111111111111111111111",
        delegate.address,
        "decision_003",
        "vault-v2",
        "mnt-native-transfer",
        snapshotHash,
        "ipfs://snapshot-3",
        500,
        24
      )
    ).to.be.revertedWith("Only receipt writer can call this");
  });
});
