// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, ebool, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract CryptoPolling is ZamaEthereumConfig {
    struct Poll {
        string name;
        string[] options;
        uint64 startTime;
        uint64 endTime;
        address creator;
        bool isPublic;
        euint32[] encryptedCounts;
    }

    struct PollSummary {
        uint256 id;
        string name;
        string[] options;
        uint64 startTime;
        uint64 endTime;
        address creator;
        bool isPublic;
    }

    uint256 public pollCount;
    mapping(uint256 => Poll) private polls;
    mapping(uint256 => mapping(address => bool)) private hasVoted;

    event PollCreated(
        uint256 indexed pollId,
        address indexed creator,
        string name,
        string[] options,
        uint64 startTime,
        uint64 endTime
    );
    event VoteCast(uint256 indexed pollId, address indexed voter);
    event PollFinalized(uint256 indexed pollId, address indexed creator);

    error InvalidOptionCount();
    error InvalidSchedule();
    error PollNotFound();
    error PollClosed();
    error AlreadyVoted();
    error NotCreator();
    error PollNotEnded();
    error AlreadyFinalized();

    modifier onlyExistingPoll(uint256 pollId) {
        if (pollId >= pollCount) {
            revert PollNotFound();
        }
        _;
    }

    function createPoll(
        string calldata name,
        string[] calldata options,
        uint64 startTime,
        uint64 endTime
    ) external returns (uint256 pollId) {
        uint256 optionCount = options.length;

        if (optionCount < 2 || optionCount > 4) {
            revert InvalidOptionCount();
        }
        if (endTime <= startTime || endTime <= block.timestamp) {
            revert InvalidSchedule();
        }

        pollId = pollCount;
        pollCount += 1;

        Poll storage poll = polls[pollId];
        poll.name = name;
        poll.startTime = startTime;
        poll.endTime = endTime;
        poll.creator = msg.sender;

        for (uint256 i = 0; i < optionCount; i++) {
            poll.options.push(options[i]);

            euint32 emptyCount = FHE.asEuint32(0);
            poll.encryptedCounts.push(emptyCount);
            FHE.allowThis(emptyCount);
        }

        emit PollCreated(pollId, msg.sender, name, options, startTime, endTime);
    }

    function castVote(
        uint256 pollId,
        externalEuint32 encryptedChoice,
        bytes calldata inputProof
    ) external onlyExistingPoll(pollId) {
        Poll storage poll = polls[pollId];

        if (block.timestamp < poll.startTime || block.timestamp > poll.endTime || poll.isPublic) {
            revert PollClosed();
        }
        if (hasVoted[pollId][msg.sender]) {
            revert AlreadyVoted();
        }

        euint32 selectedOption = FHE.fromExternal(encryptedChoice, inputProof);
        euint32 zero = FHE.asEuint32(0);
        euint32 one = FHE.asEuint32(1);

        uint256 optionCount = poll.options.length;
        for (uint256 i = 0; i < optionCount; i++) {
            ebool matches = FHE.eq(selectedOption, FHE.asEuint32(uint32(i)));
            euint32 incrementValue = FHE.select(matches, one, zero);
            euint32 updatedCount = FHE.add(poll.encryptedCounts[i], incrementValue);

            poll.encryptedCounts[i] = updatedCount;
            FHE.allowThis(updatedCount);
        }

        hasVoted[pollId][msg.sender] = true;

        emit VoteCast(pollId, msg.sender);
    }

    function finalizePoll(uint256 pollId) external onlyExistingPoll(pollId) {
        Poll storage poll = polls[pollId];

        if (msg.sender != poll.creator) {
            revert NotCreator();
        }
        if (poll.isPublic) {
            revert AlreadyFinalized();
        }
        if (block.timestamp < poll.endTime) {
            revert PollNotEnded();
        }

        uint256 optionCount = poll.encryptedCounts.length;
        for (uint256 i = 0; i < optionCount; i++) {
            FHE.makePubliclyDecryptable(poll.encryptedCounts[i]);
        }

        poll.isPublic = true;

        emit PollFinalized(pollId, msg.sender);
    }

    function getPoll(uint256 pollId) external view onlyExistingPoll(pollId) returns (PollSummary memory) {
        Poll storage poll = polls[pollId];

        return
            PollSummary({
                id: pollId,
                name: poll.name,
                options: poll.options,
                startTime: poll.startTime,
                endTime: poll.endTime,
                creator: poll.creator,
                isPublic: poll.isPublic
            });
    }

    function getPollSummaries(
        uint256 offset,
        uint256 limit
    ) external view returns (PollSummary[] memory) {
        if (offset >= pollCount || limit == 0) {
            return new PollSummary[](0);
        }

        uint256 end = offset + limit;
        if (end > pollCount) {
            end = pollCount;
        }

        PollSummary[] memory summaries = new PollSummary[](end - offset);
        uint256 position = 0;
        for (uint256 i = offset; i < end; i++) {
            Poll storage poll = polls[i];
            summaries[position] = PollSummary({
                id: i,
                name: poll.name,
                options: poll.options,
                startTime: poll.startTime,
                endTime: poll.endTime,
                creator: poll.creator,
                isPublic: poll.isPublic
            });
            position++;
        }

        return summaries;
    }

    function getEncryptedCounts(uint256 pollId) external view onlyExistingPoll(pollId) returns (euint32[] memory) {
        return polls[pollId].encryptedCounts;
    }

    function hasAddressVoted(uint256 pollId, address user) external view onlyExistingPoll(pollId) returns (bool) {
        return hasVoted[pollId][user];
    }
}
