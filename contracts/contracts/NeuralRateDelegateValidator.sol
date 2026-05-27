// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;
    uint256 preVerificationGas;
    bytes32 gasFees;
    bytes paymasterAndData;
    bytes signature;
}

interface IModule {
    function onInstall(bytes calldata data) external;
    function onUninstall(bytes calldata data) external;
    function isModuleType(uint256 moduleTypeId) external view returns (bool);
    function isInitialized(address smartAccount) external view returns (bool);
}

interface IValidator is IModule {
    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash) external returns (uint256);
    function isValidSignatureWithSender(address sender, bytes32 hash, bytes calldata data) external view returns (bytes4);
}

contract NeuralRateDelegateValidator is IValidator {
    uint256 public constant MODULE_TYPE_VALIDATOR = 1;
    uint256 public constant VALIDATION_SUCCESS = 0;
    uint256 public constant VALIDATION_FAILED = 1;
    bytes4 private constant ERC1271_MAGICVALUE = 0x1626ba7e;
    bytes4 private constant ERC1271_INVALID = 0xffffffff;

    bytes4 private constant EXECUTE_SELECTOR = bytes4(keccak256("execute(bytes32,bytes)"));
    uint8 private constant CALLTYPE_SINGLE = 0x00;
    uint8 private constant CALLTYPE_BATCH = 0x01;

    struct ValidatorConfig {
        address delegate;
        address policyRegistry;
        address vaultModule;
    }

    struct Execution {
        address target;
        uint256 value;
        bytes callData;
    }

    mapping(address => ValidatorConfig) private configs;

    event DelegateInstalled(address indexed smartAccount, address indexed delegate, address policyRegistry, address vaultModule);
    event DelegateUpdated(address indexed smartAccount, address indexed previousDelegate, address indexed newDelegate);
    event DelegateUninstalled(address indexed smartAccount, address indexed previousDelegate);

    function onInstall(bytes calldata data) external override {
        (address delegate, address policyRegistry, address vaultModule) =
            abi.decode(data, (address, address, address));
        require(delegate != address(0), "Invalid delegate");
        require(vaultModule != address(0), "Invalid vault module");
        require(configs[msg.sender].delegate == address(0), "Already initialized");
        configs[msg.sender] = ValidatorConfig({
            delegate: delegate,
            policyRegistry: policyRegistry,
            vaultModule: vaultModule
        });

        emit DelegateInstalled(msg.sender, delegate, policyRegistry, vaultModule);
    }

    function onUninstall(bytes calldata) external override {
        address previousDelegate = configs[msg.sender].delegate;
        require(previousDelegate != address(0), "Not initialized");
        delete configs[msg.sender];

        emit DelegateUninstalled(msg.sender, previousDelegate);
    }

    function isModuleType(uint256 moduleTypeId) external pure override returns (bool) {
        return moduleTypeId == MODULE_TYPE_VALIDATOR;
    }

    function isInitialized(address smartAccount) external view override returns (bool) {
        return configs[smartAccount].delegate != address(0);
    }

    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) external view override returns (uint256) {
        ValidatorConfig memory config = configs[userOp.sender];
        if (config.delegate == address(0)) {
            return VALIDATION_FAILED;
        }

        if (_recoverSigner(userOpHash, userOp.signature) != config.delegate) {
            return VALIDATION_FAILED;
        }

        if (!_isAllowedUserOpCall(userOp.callData, config)) {
            return VALIDATION_FAILED;
        }

        return VALIDATION_SUCCESS;
    }

    function isValidSignatureWithSender(
        address sender,
        bytes32 hash,
        bytes calldata data
    ) external view override returns (bytes4) {
        address delegate = configs[sender].delegate;
        if (delegate == address(0)) {
            return ERC1271_INVALID;
        }

        return _recoverSigner(hash, data) == delegate ? ERC1271_MAGICVALUE : ERC1271_INVALID;
    }

    function setDelegate(address newDelegate) external {
        require(newDelegate != address(0), "Invalid delegate");
        address previousDelegate = configs[msg.sender].delegate;
        require(previousDelegate != address(0), "Not initialized");

        configs[msg.sender].delegate = newDelegate;
        emit DelegateUpdated(msg.sender, previousDelegate, newDelegate);
    }

    function getDelegate(address smartAccount) external view returns (address) {
        return configs[smartAccount].delegate;
    }

    function getConfig(address smartAccount) external view returns (ValidatorConfig memory) {
        return configs[smartAccount];
    }

    function _recoverSigner(bytes32 digest, bytes calldata signature) private pure returns (address) {
        if (signature.length != 65) {
            return address(0);
        }

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly ("memory-safe") {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 0x20))
            v := byte(0, calldataload(add(signature.offset, 0x40)))
        }

        if (v < 27) {
            v += 27;
        }
        if (v != 27 && v != 28) {
            return address(0);
        }

        return ecrecover(digest, v, r, s);
    }

    function _isAllowedUserOpCall(bytes calldata accountCallData, ValidatorConfig memory config) private pure returns (bool) {
        if (accountCallData.length < 4 || bytes4(accountCallData[:4]) != EXECUTE_SELECTOR) {
            return false;
        }

        (, bytes memory executionCalldata) = abi.decode(accountCallData[4:], (bytes32, bytes));
        uint8 callType = uint8(bytes1(accountCallData[4:36]));

        if (callType == CALLTYPE_SINGLE) {
            if (executionCalldata.length < 52) {
                return false;
            }
            (address target,,) = _decodeSingleExecution(executionCalldata);
            return _isAllowedTarget(target, config);
        }

        if (callType == CALLTYPE_BATCH) {
            Execution[] memory executions = abi.decode(executionCalldata, (Execution[]));
            if (executions.length == 0 || executions.length > 2) {
                return false;
            }
            for (uint256 i = 0; i < executions.length; i++) {
                if (!_isAllowedTarget(executions[i].target, config)) {
                    return false;
                }
            }
            return true;
        }

        return false;
    }

    function _isAllowedTarget(address target, ValidatorConfig memory config) private pure returns (bool) {
        return target == config.vaultModule || (config.policyRegistry != address(0) && target == config.policyRegistry);
    }

    function _decodeSingleExecution(bytes memory executionCalldata)
        private
        pure
        returns (address target, uint256 value, bytes memory callData)
    {
        assembly ("memory-safe") {
            target := shr(96, mload(add(executionCalldata, 0x20)))
            value := mload(add(executionCalldata, 0x34))
        }

        uint256 callDataLength = executionCalldata.length - 52;
        callData = new bytes(callDataLength);
        for (uint256 i = 0; i < callDataLength; i++) {
            callData[i] = executionCalldata[i + 52];
        }
    }
}
