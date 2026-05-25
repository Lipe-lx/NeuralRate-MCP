// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract NeuralRateUsdYStrategyAdapter {
    address public owner;
    address public authorizedExecutor;

    struct UsdYExecutionRecord {
        uint256 executionId;
        address ownerEoa;
        address vaultAddress;
        uint256 amountUsd;
        uint16 slippageBps;
        bytes32 intentHash;
        uint256 executedAt;
    }

    uint256 public nextExecutionId = 1;
    mapping(uint256 => UsdYExecutionRecord) public executions;

    event AuthorizedExecutorUpdated(address indexed previousExecutor, address indexed newExecutor);
    event UsdYStableAllocationExecuted(
        uint256 indexed executionId,
        address indexed ownerEoa,
        address indexed vaultAddress,
        uint256 amountUsd,
        uint16 slippageBps,
        bytes32 intentHash
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    modifier onlyAuthorizedExecutor() {
        require(msg.sender == authorizedExecutor, "Only executor can call this");
        _;
    }

    constructor(address initialAuthorizedExecutor) {
        require(initialAuthorizedExecutor != address(0), "Invalid executor");
        owner = msg.sender;
        authorizedExecutor = initialAuthorizedExecutor;

        emit AuthorizedExecutorUpdated(address(0), initialAuthorizedExecutor);
    }

    function setAuthorizedExecutor(address newExecutor) external onlyOwner {
        require(newExecutor != address(0), "Invalid executor");
        address previous = authorizedExecutor;
        authorizedExecutor = newExecutor;

        emit AuthorizedExecutorUpdated(previous, newExecutor);
    }

    function executeUsdYStableAllocation(
        address ownerEoa,
        address vaultAddress,
        uint256 amountUsd,
        uint16 slippageBps,
        bytes32 intentHash
    ) external onlyAuthorizedExecutor returns (uint256) {
        require(ownerEoa != address(0), "Invalid owner");
        require(vaultAddress != address(0), "Invalid vault");
        require(amountUsd > 0, "Invalid amount");
        require(slippageBps <= 100, "Slippage too high");
        require(intentHash != bytes32(0), "Invalid intent hash");

        uint256 executionId = nextExecutionId++;
        executions[executionId] = UsdYExecutionRecord({
            executionId: executionId,
            ownerEoa: ownerEoa,
            vaultAddress: vaultAddress,
            amountUsd: amountUsd,
            slippageBps: slippageBps,
            intentHash: intentHash,
            executedAt: block.timestamp
        });

        emit UsdYStableAllocationExecuted(
            executionId,
            ownerEoa,
            vaultAddress,
            amountUsd,
            slippageBps,
            intentHash
        );

        return executionId;
    }
}
