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

contract NeuralRateVaultModule {
    uint8 private constant OPERATION_CALL = 0;

    address public owner;
    address public authorizedExecutor;

    event AuthorizedExecutorUpdated(address indexed previousExecutor, address indexed newExecutor);
    event VaultCallExecuted(
        address indexed ownerEoa,
        address indexed vaultAddress,
        address indexed targetContract,
        uint256 value,
        bytes4 selector,
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

    function executeVaultCall(
        address ownerEoa,
        address vaultAddress,
        address targetContract,
        uint256 value,
        bytes calldata callData,
        bytes32 intentHash
    ) external onlyAuthorizedExecutor returns (bool) {
        require(ownerEoa != address(0), "Invalid owner");
        require(vaultAddress != address(0), "Invalid vault");
        require(targetContract != address(0), "Invalid target");
        require(intentHash != bytes32(0), "Invalid intent hash");

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
            intentHash
        );

        return true;
    }
}
