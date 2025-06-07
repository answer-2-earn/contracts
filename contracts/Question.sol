// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {LSP8Mintable} from "@lukso/lsp-smart-contracts/contracts/LSP8IdentifiableDigitalAsset/presets/LSP8Mintable.sol";
import {_LSP8_TOKENID_FORMAT_NUMBER} from "@lukso/lsp-smart-contracts/contracts/LSP8IdentifiableDigitalAsset/LSP8Constants.sol";
import {_LSP4_TOKEN_TYPE_COLLECTION, _LSP4_METADATA_KEY} from "@lukso/lsp-smart-contracts/contracts/LSP4DigitalAssetMetadata/LSP4Constants.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Question is LSP8Mintable, ReentrancyGuard {
    struct Reward {
        uint256 value;
        bool sent;
    }

    event QuestionAsked(
        address indexed asker,
        address indexed answerer,
        bytes32 indexed tokenId,
        uint256 value,
        bytes metadataValue
    );

    event QuestionAnswered(
        address indexed answerer,
        bytes32 indexed tokenId,
        bytes metadataValue
    );

    event QuestionCancelled(
        address indexed asker,
        bytes32 indexed tokenId,
        uint256 value
    );

    mapping(bytes32 tokenId => Reward) public rewards;
    mapping(bytes32 tokenId => address) public askers;

    constructor()
        LSP8Mintable(
            "Question Token",
            "QT",
            msg.sender,
            _LSP4_TOKEN_TYPE_COLLECTION,
            _LSP8_TOKENID_FORMAT_NUMBER
        )
    {}

    /**
     * @dev Ask a question to a specific answerer with a reward.
     * @param answerer The address of the person who should answer the question.
     * @param metadataValue The metadata of the question being asked.
     */
    function ask(address answerer, bytes memory metadataValue) public payable {
        require(msg.value > 0, "Value must be greater than 0");
        require(answerer != address(0), "Answerer cannot be zero address");
        require(answerer != msg.sender, "Cannot ask yourself");

        // Mint a new token for the question
        bytes32 tokenId = keccak256(
            abi.encodePacked(
                block.timestamp,
                block.prevrandao,
                msg.sender,
                answerer
            )
        );
        _mint(answerer, tokenId, true, "");
        _setDataForTokenId(tokenId, _LSP4_METADATA_KEY, metadataValue);

        // Store the reward and asker information
        rewards[tokenId] = Reward({value: msg.value, sent: false});
        askers[tokenId] = msg.sender;

        emit QuestionAsked(
            msg.sender,
            answerer,
            tokenId,
            msg.value,
            metadataValue
        );
    }
    /**
     * @dev Answer a question and send the reward to the answerer.
     * @notice This function can only be called by the contract owner.
     * @param tokenId The ID of the question token.
     * @param metadataValue The metadata of the answer.
     */
    function answer(
        bytes32 tokenId,
        bytes memory metadataValue
    ) public nonReentrant onlyOwner {
        require(!rewards[tokenId].sent, "Reward already sent");

        // Update the state before external call
        rewards[tokenId].sent = true;

        // Update the metadata for the token
        _setDataForTokenId(tokenId, _LSP4_METADATA_KEY, metadataValue);

        // Transfer the reward to the answerer
        (bool success, ) = tokenOwnerOf(tokenId).call{
            value: rewards[tokenId].value
        }("");
        require(success, "Transfer failed");

        emit QuestionAnswered(tokenOwnerOf(tokenId), tokenId, metadataValue);
    }

    /**
     * @dev Cancel a question and reclaim the reward before it's answered.
     * @param tokenId The ID of the question token.
     */
    function cancelQuestion(bytes32 tokenId) public nonReentrant {
        require(askers[tokenId] == msg.sender, "Only the asker can cancel");
        require(!rewards[tokenId].sent, "Reward already sent");

        uint256 rewardValue = rewards[tokenId].value;

        // Mark the reward as sent to prevent double-claiming
        rewards[tokenId].sent = true;

        // Transfer the reward back to the asker
        (bool success, ) = msg.sender.call{value: rewardValue}("");
        require(success, "Transfer failed");

        // Burn the token
        _burn(tokenId, "");

        emit QuestionCancelled(msg.sender, tokenId, rewardValue);
    }

    /**
     * @dev Get the reward information for a specific question.
     * @param tokenId The ID of the question token.
     * @return The reward struct containing value, sent status, and expiration time.
     */
    function getReward(bytes32 tokenId) public view returns (Reward memory) {
        return rewards[tokenId];
    }

    /**
     * @dev Get the asker of a specific question.
     * @param tokenId The ID of the question token.
     * @return The address of the person who asked the question.
     */
    function getAsker(bytes32 tokenId) public view returns (address) {
        return askers[tokenId];
    }
}
