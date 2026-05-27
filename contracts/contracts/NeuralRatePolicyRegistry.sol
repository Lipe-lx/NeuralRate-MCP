// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract NeuralRatePolicyRegistry {
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

    mapping(bytes32 => PolicyMetadata) private policies;
    mapping(address => bytes32) public activePolicyIdByVault;
    mapping(bytes32 => address[]) private allowedTargetsByPolicy;
    mapping(bytes32 => bytes4[]) private allowedSelectorsByPolicy;
    mapping(bytes32 => string[]) private allowedAssetsByPolicy;
    mapping(bytes32 => string[]) private allowedProtocolsByPolicy;
    mapping(bytes32 => mapping(address => bool)) private allowedTargetLookup;
    mapping(bytes32 => mapping(bytes4 => bool)) private allowedSelectorLookup;
    mapping(address => uint256) public ownerNonces;
    mapping(bytes32 => SnapshotAnchor) private snapshots;

    event PolicyPublished(
        bytes32 indexed policyId,
        address indexed ownerEoa,
        address indexed vaultAddress,
        address delegate,
        string policyVersion,
        uint256 nonce
    );
    event PolicyRevoked(bytes32 indexed policyId, address indexed ownerEoa, address indexed vaultAddress);
    event SnapshotAnchored(
        bytes32 indexed snapshotHash,
        address indexed vaultAddress,
        bytes32 indexed policyId,
        address anchoredBy,
        string snapshotCid,
        string descriptor
    );

    modifier onlyPolicyOwner(address ownerEoa) {
        require(msg.sender == ownerEoa, "Only policy owner can call");
        _;
    }

    function publishPolicy(
        address ownerEoa,
        address vaultAddress,
        address delegate,
        uint256 maxPerUse,
        uint256 maxDaily,
        uint256 maxTotal,
        uint256 validAfter,
        uint256 validUntil,
        uint256 maxSlippageBps,
        bool requireSnapshot,
        string calldata policyVersion,
        string[] calldata allowedAssets,
        string[] calldata allowedProtocols,
        address[] calldata allowedTargets,
        bytes4[] calldata allowedSelectors
    ) external onlyPolicyOwner(ownerEoa) returns (bytes32 policyId) {
        require(vaultAddress != address(0), "Invalid vault");
        require(validUntil > validAfter, "Invalid validity window");
        require(delegate != address(0), "Invalid delegate");

        uint256 nonce = ownerNonces[ownerEoa];
        policyId = keccak256(
            abi.encode(
                ownerEoa,
                vaultAddress,
                delegate,
                maxPerUse,
                maxDaily,
                maxTotal,
                validAfter,
                validUntil,
                maxSlippageBps,
                requireSnapshot,
                policyVersion,
                nonce
            )
        );

        PolicyMetadata storage metadata = policies[policyId];
        metadata.policyId = policyId;
        metadata.ownerEoa = ownerEoa;
        metadata.vaultAddress = vaultAddress;
        metadata.delegate = delegate;
        metadata.maxPerUse = maxPerUse;
        metadata.maxDaily = maxDaily;
        metadata.maxTotal = maxTotal;
        metadata.validAfter = validAfter;
        metadata.validUntil = validUntil;
        metadata.maxSlippageBps = maxSlippageBps;
        metadata.nonce = nonce;
        metadata.active = true;
        metadata.requireSnapshot = requireSnapshot;
        metadata.hasTargetAllowlist = allowedTargets.length > 0;
        metadata.hasSelectorAllowlist = allowedSelectors.length > 0;
        metadata.policyVersion = policyVersion;

        delete allowedTargetsByPolicy[policyId];
        delete allowedSelectorsByPolicy[policyId];
        delete allowedAssetsByPolicy[policyId];
        delete allowedProtocolsByPolicy[policyId];

        for (uint256 i = 0; i < allowedTargets.length; i++) {
            allowedTargetsByPolicy[policyId].push(allowedTargets[i]);
            allowedTargetLookup[policyId][allowedTargets[i]] = true;
        }

        for (uint256 i = 0; i < allowedSelectors.length; i++) {
            allowedSelectorsByPolicy[policyId].push(allowedSelectors[i]);
            allowedSelectorLookup[policyId][allowedSelectors[i]] = true;
        }

        for (uint256 i = 0; i < allowedAssets.length; i++) {
            allowedAssetsByPolicy[policyId].push(allowedAssets[i]);
        }

        for (uint256 i = 0; i < allowedProtocols.length; i++) {
            allowedProtocolsByPolicy[policyId].push(allowedProtocols[i]);
        }

        bytes32 previousPolicyId = activePolicyIdByVault[vaultAddress];
        if (previousPolicyId != bytes32(0)) {
            policies[previousPolicyId].active = false;
        }

        activePolicyIdByVault[vaultAddress] = policyId;
        ownerNonces[ownerEoa] = nonce + 1;

        emit PolicyPublished(policyId, ownerEoa, vaultAddress, delegate, policyVersion, nonce);
    }

    function revokeActivePolicy(address ownerEoa, address vaultAddress) external onlyPolicyOwner(ownerEoa) {
        bytes32 activePolicyId = activePolicyIdByVault[vaultAddress];
        require(activePolicyId != bytes32(0), "No active policy");

        PolicyMetadata storage metadata = policies[activePolicyId];
        require(metadata.ownerEoa == ownerEoa, "Owner mismatch");

        metadata.active = false;
        activePolicyIdByVault[vaultAddress] = bytes32(0);

        emit PolicyRevoked(activePolicyId, ownerEoa, vaultAddress);
    }

    function anchorSnapshot(
        address vaultAddress,
        bytes32 snapshotHash,
        string calldata snapshotCid,
        string calldata descriptor
    ) external {
        require(snapshotHash != bytes32(0), "Invalid snapshot hash");
        bytes32 activePolicyId = activePolicyIdByVault[vaultAddress];
        require(activePolicyId != bytes32(0), "No active policy");

        PolicyMetadata storage metadata = policies[activePolicyId];
        require(
            msg.sender == metadata.ownerEoa || msg.sender == metadata.delegate,
            "Only owner or delegate can anchor snapshot"
        );

        snapshots[snapshotHash] = SnapshotAnchor({
            vaultAddress: vaultAddress,
            policyId: activePolicyId,
            anchoredBy: msg.sender,
            snapshotHash: snapshotHash,
            snapshotCid: snapshotCid,
            descriptor: descriptor,
            anchoredAt: block.timestamp,
            exists: true
        });

        emit SnapshotAnchored(snapshotHash, vaultAddress, activePolicyId, msg.sender, snapshotCid, descriptor);
    }

    function getActivePolicy(address vaultAddress) external view returns (PolicyMetadata memory) {
        return policies[activePolicyIdByVault[vaultAddress]];
    }

    function getPolicy(bytes32 policyId) external view returns (PolicyMetadata memory) {
        return policies[policyId];
    }

    function getAllowedAssets(bytes32 policyId) external view returns (string[] memory) {
        return allowedAssetsByPolicy[policyId];
    }

    function getAllowedProtocols(bytes32 policyId) external view returns (string[] memory) {
        return allowedProtocolsByPolicy[policyId];
    }

    function getAllowedTargets(bytes32 policyId) external view returns (address[] memory) {
        return allowedTargetsByPolicy[policyId];
    }

    function getAllowedSelectors(bytes32 policyId) external view returns (bytes4[] memory) {
        return allowedSelectorsByPolicy[policyId];
    }

    function isAllowedTarget(bytes32 policyId, address target) external view returns (bool) {
        return allowedTargetLookup[policyId][target];
    }

    function isAllowedSelector(bytes32 policyId, bytes4 selector) external view returns (bool) {
        return allowedSelectorLookup[policyId][selector];
    }

    function getSnapshotAnchor(bytes32 snapshotHash) external view returns (SnapshotAnchor memory) {
        return snapshots[snapshotHash];
    }
}
