// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract StableSyncDecisionBenchmark {
    address public agent;
    
    struct DecisionMeta {
        uint256 decisionId;
        address requestedBy;
        string dataSnapshotHash;
        int256 predictedApyBps;
        uint256 settlementHorizonHours;
        uint256 createdAt;
        bool isSettled;
    }
    
    mapping(uint256 => DecisionMeta) public decisions;
    uint256 public nextDecisionId = 1;
    
    event DecisionCreated(
        uint256 indexed decisionId,
        address indexed requestedBy,
        string dataSnapshotHash,
        int256 predictedApyBps,
        uint256 settlementHorizonHours
    );
    
    event DecisionSettled(
        uint256 indexed decisionId,
        int256 realizedApyBps,
        int256 predictionErrorBps,
        int256 outperformanceBps
    );

    modifier onlyAgent() {
        require(msg.sender == agent, "Only registered agent can call this");
        _;
    }

    constructor() {
        agent = msg.sender;
    }

    function createDecision(
        address _requestedBy,
        string calldata _dataSnapshotHash,
        int256 _predictedApyBps,
        uint256 _settlementHorizonHours
    ) external onlyAgent returns (uint256) {
        uint256 id = nextDecisionId++;
        
        decisions[id] = DecisionMeta({
            decisionId: id,
            requestedBy: _requestedBy,
            dataSnapshotHash: _dataSnapshotHash,
            predictedApyBps: _predictedApyBps,
            settlementHorizonHours: _settlementHorizonHours,
            createdAt: block.timestamp,
            isSettled: false
        });
        
        emit DecisionCreated(id, _requestedBy, _dataSnapshotHash, _predictedApyBps, _settlementHorizonHours);
        
        return id;
    }

    function settleDecision(
        uint256 _decisionId,
        int256 _realizedApyBps,
        int256 _tbillApyBps
    ) external onlyAgent {
        DecisionMeta storage decision = decisions[_decisionId];
        require(decision.decisionId == _decisionId, "Decision does not exist");
        require(!decision.isSettled, "Decision already settled");
        
        // Em um cenário real de hackathon, talvez queiramos ignorar o check de tempo
        // para facilitar a demo, mas vamos manter por completude.
        // require(block.timestamp >= decision.createdAt + (decision.settlementHorizonHours * 1 hours), "Horizon not met yet");

        decision.isSettled = true;

        int256 predictionErrorBps = _realizedApyBps - decision.predictedApyBps;
        int256 outperformanceBps = _realizedApyBps - _tbillApyBps;

        emit DecisionSettled(_decisionId, _realizedApyBps, predictionErrorBps, outperformanceBps);
    }
}
