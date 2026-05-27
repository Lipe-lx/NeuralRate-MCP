// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISafeModuleAvatar {
    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation
    ) external returns (bool success);
}

contract MockModuleCaller {
    function executeViaSafe(
        address safe,
        address to,
        uint256 value,
        bytes calldata data
    ) external returns (bool) {
        return ISafeModuleAvatar(safe).execTransactionFromModule(to, value, data, 0);
    }
}
