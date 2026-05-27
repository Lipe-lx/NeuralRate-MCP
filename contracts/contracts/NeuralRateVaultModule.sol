// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISafeModuleExecutor {
    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation
    ) external returns (bool success);
}

interface INeuralRateExecutionGuard {
    function validateAndConsumeExecution(
        address ownerEoa,
        address vaultAddress,
        address executor,
        address targetContract,
        uint256 value,
        bytes calldata callData,
        bytes32 intentHash,
        bytes32 snapshotHash,
        uint256 slippageBps,
        uint256 deadline
    ) external returns (bytes32 policyId);
}

contract NeuralRateVaultModule {
    uint8 private constant OPERATION_CALL = 0;

    address public owner;
    address public authorizedExecutor;
    address public executionGuard;

    event AuthorizedExecutorUpdated(address indexed previousExecutor, address indexed newExecutor);
    event ExecutionGuardUpdated(address indexed previousGuard, address indexed newGuard);
    event VaultCallExecuted(
        address indexed ownerEoa,
        address indexed vaultAddress,
        address indexed targetContract,
        uint256 value,
        bytes4 selector,
        bytes32 intentHash,
        bytes32 snapshotHash
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    modifier onlyAuthorizedExecutorOrVault(address vaultAddress) {
        require(
            msg.sender == authorizedExecutor || msg.sender == vaultAddress,
            "Only executor or vault can call this"
        );
        _;
    }

    constructor(address initialAuthorizedExecutor, address initialExecutionGuard) {
        require(initialAuthorizedExecutor != address(0), "Invalid executor");
        owner = msg.sender;
        authorizedExecutor = initialAuthorizedExecutor;
        executionGuard = initialExecutionGuard;

        emit AuthorizedExecutorUpdated(address(0), initialAuthorizedExecutor);
        emit ExecutionGuardUpdated(address(0), initialExecutionGuard);
    }

    function setAuthorizedExecutor(address newExecutor) external onlyOwner {
        require(newExecutor != address(0), "Invalid executor");
        address previous = authorizedExecutor;
        authorizedExecutor = newExecutor;

        emit AuthorizedExecutorUpdated(previous, newExecutor);
    }

    function setExecutionGuard(address newGuard) external onlyOwner {
        address previous = executionGuard;
        executionGuard = newGuard;

        emit ExecutionGuardUpdated(previous, newGuard);
    }

    function executeVaultCall(
        address ownerEoa,
        address vaultAddress,
        address targetContract,
        uint256 value,
        bytes calldata callData,
        bytes32 intentHash,
        bytes32 snapshotHash,
        uint256 slippageBps,
        uint256 deadline
    ) external onlyAuthorizedExecutorOrVault(vaultAddress) returns (bool) {
        require(ownerEoa != address(0), "Invalid owner");
        require(vaultAddress != address(0), "Invalid vault");
        require(targetContract != address(0), "Invalid target");
        require(intentHash != bytes32(0), "Invalid intent hash");

        if (executionGuard != address(0)) {
            INeuralRateExecutionGuard(executionGuard).validateAndConsumeExecution(
                ownerEoa,
                vaultAddress,
                msg.sender,
                targetContract,
                value,
                callData,
                intentHash,
                snapshotHash,
                slippageBps,
                deadline
            );
        }

        bool success = ISafeModuleExecutor(vaultAddress).execTransactionFromModule(
            targetContract,
            value,
            callData,
            OPERATION_CALL
        );
        require(success, "Safe module execution failed");

        bytes4 selector = bytes4(0);
        if (callData.length >= 4) {
            assembly {
                selector := calldataload(callData.offset)
            }
        }

        emit VaultCallExecuted(
            ownerEoa,
            vaultAddress,
            targetContract,
            value,
            selector,
            intentHash,
            snapshotHash
        );

        return true;
    }
}
