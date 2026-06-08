// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

interface IModuleGuard is IERC165 {
    function checkModuleTransaction(
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation,
        address module
    ) external returns (bytes32 moduleTxHash);

    function checkAfterModuleExecution(bytes32 moduleTxHash, bool success) external;
}

interface INeuralRatePolicyRegistry {
    struct PolicyMetadata {
        bytes32 policyId;
        address ownerEoa;
        address vaultAddress;
        address delegate;
        uint256 maxPerUse;
        uint256 maxDaily;
        uint256 maxTotal;
        uint256 validAfter;
        uint256 validUntil;
        uint256 maxSlippageBps;
        uint256 nonce;
        bool active;
        bool requireSnapshot;
        bool hasTargetAllowlist;
        bool hasSelectorAllowlist;
        string policyVersion;
    }

    struct SnapshotAnchor {
        address vaultAddress;
        bytes32 policyId;
        address anchoredBy;
        bytes32 snapshotHash;
        string snapshotCid;
        string descriptor;
        uint256 anchoredAt;
        bool exists;
    }

    function getActivePolicy(address vaultAddress) external view returns (PolicyMetadata memory);
    function isAllowedTarget(bytes32 policyId, address target) external view returns (bool);
    function isAllowedSelector(bytes32 policyId, bytes4 selector) external view returns (bool);
    function getSnapshotAnchor(bytes32 snapshotHash) external view returns (SnapshotAnchor memory);
}

contract NeuralRateExecutionGuard is IModuleGuard {
    bytes4 private constant IERC165_INTERFACE_ID = 0x01ffc9a7;
    bytes4 private constant IMODULE_GUARD_INTERFACE_ID = 0x58401ed8;

    address public owner;
    INeuralRatePolicyRegistry public policyRegistry;
    // Governed execution module allowed to consume policy budget.
    address public trustedModule;
    // Safe module allowed to enter the Safe module-guard hook. This is usually
    // the Safe7579 adapter for ERC-4337 execution; trustedModule is still the
    // NeuralRate VaultModule that performs policy validation.
    address public trustedSafeModule;

    mapping(bytes32 => mapping(uint256 => uint256)) public dailySpendByPolicy;
    mapping(bytes32 => uint256) public totalSpendByPolicy;
    mapping(bytes32 => bool) public consumedIntentHashes;

    event TrustedModuleUpdated(address indexed previousModule, address indexed newModule);
    event TrustedSafeModuleUpdated(address indexed previousModule, address indexed newModule);
    event PolicyRegistryUpdated(address indexed previousRegistry, address indexed newRegistry);
    event ExecutionValidated(
        bytes32 indexed policyId,
        bytes32 indexed intentHash,
        address indexed vaultAddress,
        address executor,
        address targetContract,
        uint256 spendAmount,
        bytes4 selector,
        bytes32 snapshotHash
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    constructor(address initialPolicyRegistry, address initialTrustedModule, address initialTrustedSafeModule) {
        require(initialPolicyRegistry != address(0), "Invalid policy registry");
        owner = msg.sender;
        policyRegistry = INeuralRatePolicyRegistry(initialPolicyRegistry);
        trustedModule = initialTrustedModule;
        trustedSafeModule = initialTrustedSafeModule == address(0)
            ? initialTrustedModule
            : initialTrustedSafeModule;
    }

    function setPolicyRegistry(address newRegistry) external onlyOwner {
        require(newRegistry != address(0), "Invalid policy registry");
        address previousRegistry = address(policyRegistry);
        policyRegistry = INeuralRatePolicyRegistry(newRegistry);
        emit PolicyRegistryUpdated(previousRegistry, newRegistry);
    }

    function setTrustedModule(address newTrustedModule) external onlyOwner {
        address previousModule = trustedModule;
        trustedModule = newTrustedModule;
        emit TrustedModuleUpdated(previousModule, newTrustedModule);
    }

    function setTrustedSafeModule(address newTrustedSafeModule) external onlyOwner {
        address previousModule = trustedSafeModule;
        trustedSafeModule = newTrustedSafeModule;
        emit TrustedSafeModuleUpdated(previousModule, newTrustedSafeModule);
    }

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
    ) external returns (bytes32 policyId) {
        require(msg.sender == trustedModule, "Only trusted module can validate");
        require(intentHash != bytes32(0), "Invalid intent hash");
        require(!consumedIntentHashes[intentHash], "Intent hash already consumed");
        require(deadline >= block.timestamp, "Execution deadline expired");

        INeuralRatePolicyRegistry.PolicyMetadata memory policy = policyRegistry.getActivePolicy(vaultAddress);
        require(policy.active, "No active policy");
        require(policy.ownerEoa == ownerEoa, "Owner mismatch");
        require(policy.vaultAddress == vaultAddress, "Vault mismatch");
        require(
            policy.delegate == executor || executor == vaultAddress,
            "Delegate mismatch"
        );
        require(block.timestamp >= policy.validAfter, "Policy not active yet");
        require(block.timestamp <= policy.validUntil, "Policy expired");
        require(slippageBps <= policy.maxSlippageBps, "Slippage exceeds policy");

        bytes4 selector = bytes4(0);
        if (callData.length >= 4) {
            selector = bytes4(callData[:4]);
        }

        if (policy.hasTargetAllowlist) {
            require(policyRegistry.isAllowedTarget(policy.policyId, targetContract), "Target not allowed");
        }

        if (policy.hasSelectorAllowlist) {
            require(policyRegistry.isAllowedSelector(policy.policyId, selector), "Selector not allowed");
        }

        if (policy.requireSnapshot) {
            INeuralRatePolicyRegistry.SnapshotAnchor memory snapshot = policyRegistry.getSnapshotAnchor(snapshotHash);
            require(snapshot.exists, "Snapshot not anchored");
            require(snapshot.vaultAddress == vaultAddress, "Snapshot vault mismatch");
            require(snapshot.policyId == policy.policyId, "Snapshot policy mismatch");
        }

        uint256 spendAmount = _resolveSpendAmount(value, selector, callData);
        require(spendAmount <= policy.maxPerUse, "Per-use limit exceeded");

        uint256 dayKey = block.timestamp / 1 days;
        uint256 updatedDaily = dailySpendByPolicy[policy.policyId][dayKey] + spendAmount;
        uint256 updatedTotal = totalSpendByPolicy[policy.policyId] + spendAmount;

        require(updatedDaily <= policy.maxDaily, "Daily limit exceeded");
        require(updatedTotal <= policy.maxTotal, "Total limit exceeded");

        dailySpendByPolicy[policy.policyId][dayKey] = updatedDaily;
        totalSpendByPolicy[policy.policyId] = updatedTotal;
        consumedIntentHashes[intentHash] = true;

        emit ExecutionValidated(
            policy.policyId,
            intentHash,
            vaultAddress,
            executor,
            targetContract,
            spendAmount,
            selector,
            snapshotHash
        );

        return policy.policyId;
    }

    function checkModuleTransaction(
        address,
        uint256,
        bytes memory,
        uint8 operation,
        address module
    ) external view returns (bytes32 moduleTxHash) {
        require(module == trustedModule || module == trustedSafeModule, "Untrusted module");
        require(operation == 0 || operation == 1, "Unsupported operation");
        return keccak256(abi.encode(module, operation, trustedModule, trustedSafeModule));
    }

    function checkAfterModuleExecution(bytes32, bool) external pure {}

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == IERC165_INTERFACE_ID || interfaceId == IMODULE_GUARD_INTERFACE_ID;
    }

    function _resolveSpendAmount(
        uint256 value,
        bytes4 selector,
        bytes calldata callData
    ) private pure returns (uint256) {
        if (value > 0) {
            return value;
        }

        if (selector == 0xa9059cbb && callData.length >= 68) {
            (, uint256 amount) = abi.decode(callData[4:], (address, uint256));
            return amount;
        }

        if (selector == 0x23b872dd && callData.length >= 100) {
            (, , uint256 amount) = abi.decode(callData[4:], (address, address, uint256));
            return amount;
        }

        return 0;
    }
}
