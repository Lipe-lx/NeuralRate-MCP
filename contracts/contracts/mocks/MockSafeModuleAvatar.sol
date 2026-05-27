// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IModuleGuard {
    function checkModuleTransaction(
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation,
        address module
    ) external returns (bytes32 moduleTxHash);

    function checkAfterModuleExecution(bytes32 moduleTxHash, bool success) external;
}

contract MockSafeModuleAvatar {
    mapping(address => bool) public enabledModules;
    address public moduleGuard;

    event ModuleSet(address indexed module, bool enabled);
    event ModuleGuardSet(address indexed moduleGuard);

    function setModule(address module, bool enabled) external {
        enabledModules[module] = enabled;
        emit ModuleSet(module, enabled);
    }

    function isModuleEnabled(address module) external view returns (bool) {
        return enabledModules[module];
    }

    function setModuleGuard(address guard) external {
        moduleGuard = guard;
        emit ModuleGuardSet(guard);
    }

    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation
    ) external returns (bool success) {
        require(enabledModules[msg.sender], "Module not enabled");
        require(operation == 0, "Unsupported operation");

        bytes32 moduleTxHash = bytes32(0);
        if (moduleGuard != address(0)) {
            moduleTxHash = IModuleGuard(moduleGuard).checkModuleTransaction(
                to,
                value,
                data,
                operation,
                msg.sender
            );
        }

        (success,) = to.call{value: value}(data);

        if (moduleGuard != address(0)) {
            IModuleGuard(moduleGuard).checkAfterModuleExecution(moduleTxHash, success);
        }
    }

    receive() external payable {}
}
