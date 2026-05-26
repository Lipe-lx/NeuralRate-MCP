// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockSafeModuleAvatar {
    mapping(address => bool) public enabledModules;

    event ModuleSet(address indexed module, bool enabled);

    function setModule(address module, bool enabled) external {
        enabledModules[module] = enabled;
        emit ModuleSet(module, enabled);
    }

    function isModuleEnabled(address module) external view returns (bool) {
        return enabledModules[module];
    }

    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation
    ) external returns (bool success) {
        require(enabledModules[msg.sender], "Module not enabled");
        require(operation == 0, "Unsupported operation");

        (success,) = to.call{value: value}(data);
    }

    receive() external payable {}
}
