// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract NeuralRateDecisionReceiptRegistry {
    address public owner;
    address public receiptWriter;

    struct DecisionReceipt {
        uint256 receiptId;
        address ownerEoa;
        address vaultAddress;
        address delegate;
        string externalDecisionId;
        string policyVersion;
        string strategyKey;
        bytes32 snapshotHash;
        string snapshotCID;
        int256 predictedApyBps;
        int256 realizedApyBps;
        int256 benchmarkApyBps;
        uint256 settlementHorizonHours;
        uint256 createdAt;
        uint256 settledAt;
        bool settled;
    }

    mapping(uint256 => DecisionReceipt) public receipts;
    uint256 public nextReceiptId = 1;

    event ReceiptWriterUpdated(address indexed previousWriter, address indexed newWriter);
    event DecisionReceiptCreated(
        uint256 indexed receiptId,
        string externalDecisionId,
        address indexed vaultAddress,
        address indexed delegate,
        string policyVersion,
        string strategyKey,
        bytes32 snapshotHash,
        string snapshotCID,
        int256 predictedApyBps,
        uint256 settlementHorizonHours
    );
    event DecisionReceiptSettled(
        uint256 indexed receiptId,
        int256 realizedApyBps,
        int256 benchmarkApyBps,
        int256 predictionErrorBps,
        int256 outperformanceBps
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    modifier onlyReceiptWriter() {
        require(msg.sender == receiptWriter, "Only receipt writer can call this");
        _;
    }

    constructor(address initialReceiptWriter) {
        require(initialReceiptWriter != address(0), "Invalid receipt writer");
        owner = msg.sender;
        receiptWriter = initialReceiptWriter;
        emit ReceiptWriterUpdated(address(0), initialReceiptWriter);
    }

    function setReceiptWriter(address newReceiptWriter) external onlyOwner {
        require(newReceiptWriter != address(0), "Invalid receipt writer");
        address previous = receiptWriter;
        receiptWriter = newReceiptWriter;
        emit ReceiptWriterUpdated(previous, newReceiptWriter);
    }

    function createDecisionReceipt(
        address ownerEoa,
        address vaultAddress,
        address delegate,
        string calldata externalDecisionId,
        string calldata policyVersion,
        string calldata strategyKey,
        bytes32 snapshotHash,
        string calldata snapshotCID,
        int256 predictedApyBps,
        uint256 settlementHorizonHours
    ) external onlyReceiptWriter returns (uint256 receiptId) {
        require(ownerEoa != address(0), "Invalid owner");
        require(vaultAddress != address(0), "Invalid vault");
        require(delegate != address(0), "Invalid delegate");
        require(snapshotHash != bytes32(0), "Invalid snapshot hash");

        receiptId = nextReceiptId++;
        receipts[receiptId] = DecisionReceipt({
            receiptId: receiptId,
            ownerEoa: ownerEoa,
            vaultAddress: vaultAddress,
            delegate: delegate,
            externalDecisionId: externalDecisionId,
            policyVersion: policyVersion,
            strategyKey: strategyKey,
            snapshotHash: snapshotHash,
            snapshotCID: snapshotCID,
            predictedApyBps: predictedApyBps,
            realizedApyBps: 0,
            benchmarkApyBps: 0,
            settlementHorizonHours: settlementHorizonHours,
            createdAt: block.timestamp,
            settledAt: 0,
            settled: false
        });

        emit DecisionReceiptCreated(
            receiptId,
            externalDecisionId,
            vaultAddress,
            delegate,
            policyVersion,
            strategyKey,
            snapshotHash,
            snapshotCID,
            predictedApyBps,
            settlementHorizonHours
        );
    }

    function settleDecisionReceipt(
        uint256 receiptId,
        int256 realizedApyBps,
        int256 benchmarkApyBps
    ) external onlyReceiptWriter {
        DecisionReceipt storage receipt = receipts[receiptId];
        require(receipt.receiptId == receiptId, "Receipt does not exist");
        require(!receipt.settled, "Receipt already settled");

        receipt.realizedApyBps = realizedApyBps;
        receipt.benchmarkApyBps = benchmarkApyBps;
        receipt.settledAt = block.timestamp;
        receipt.settled = true;

        int256 predictionErrorBps = realizedApyBps - receipt.predictedApyBps;
        int256 outperformanceBps = realizedApyBps - benchmarkApyBps;

        emit DecisionReceiptSettled(
            receiptId,
            realizedApyBps,
            benchmarkApyBps,
            predictionErrorBps,
            outperformanceBps
        );
    }
}
