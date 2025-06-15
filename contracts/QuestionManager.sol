// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {_LSP4_METADATA_KEY} from "@lukso/lsp-smart-contracts/contracts/LSP4DigitalAssetMetadata/LSP4Constants.sol";
import {Question} from "./Question.sol";

contract QuestionManager is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    enum QuestionProcessingStatus {
        None,
        AnswerInvalid,
        AnswerValidRewardSent
    }

    event QuestionAsked(
        address indexed asker,
        address indexed answerer,
        bytes32 indexed tokenId,
        uint256 reward,
        bytes metadataValue
    );

    event QuestionAnswered(
        address indexed answerer,
        bytes32 indexed tokenId,
        bytes metadataValue
    );

    event QuestionCancelled(address indexed asker, bytes32 indexed tokenId);

    event QuestionProcessed(
        bytes32 indexed tokenId,
        QuestionProcessingStatus status
    );

    Question public question;
    address public validator;
    mapping(bytes32 tokenId => uint256) public rewards;
    mapping(bytes32 tokenId => address) public askers;
    mapping(bytes32 tokenId => bytes) public answers;
    mapping(bytes32 tokenId => QuestionProcessingStatus)
        public processingStatuses;

    modifier onlyValidator() {
        require(validator == msg.sender, "Caller is not the validator");
        _;
    }

    modifier onlyAnswerer(bytes32 tokenId) {
        require(
            question.tokenOwnerOf(tokenId) == msg.sender,
            "Caller is not the answerer"
        );
        _;
    }

    modifier onlyAsker(bytes32 tokenId) {
        require(askers[tokenId] == msg.sender, "Caller is not the asker");
        _;
    }

    modifier onlyNotProcessed(bytes32 tokenId) {
        require(
            processingStatuses[tokenId] == QuestionProcessingStatus.None,
            "Processing status is not None"
        );
        _;
    }

    modifier onlyNotProcessedAsAnswerValidRewardSent(bytes32 tokenId) {
        require(
            processingStatuses[tokenId] !=
                QuestionProcessingStatus.AnswerValidRewardSent,
            "Processing status is AnswerValidRewardSent"
        );
        _;
    }

    function initialize(
        address questionAddress,
        address validatorAddress
    ) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        question = Question(payable(questionAddress));
        validator = validatorAddress;
    }

    function ask(address answerer, bytes memory metadataValue) public payable {
        require(answerer != address(0), "Answerer cannot be zero address");
        require(answerer != msg.sender, "Answerer cannot ask yourself");

        // Mint a new token for the question
        bytes32 tokenId = keccak256(
            abi.encodePacked(
                block.timestamp,
                block.prevrandao,
                msg.sender,
                answerer
            )
        );
        question.mint(answerer, tokenId, true, "");
        question.setDataForTokenId(tokenId, _LSP4_METADATA_KEY, metadataValue);

        // Store the reward and asker information
        rewards[tokenId] = msg.value;
        askers[tokenId] = msg.sender;

        emit QuestionAsked(
            msg.sender,
            answerer,
            tokenId,
            msg.value,
            metadataValue
        );
    }

    function answer(
        bytes32 tokenId,
        bytes memory metadataValue
    )
        public
        nonReentrant
        onlyAnswerer(tokenId)
        onlyNotProcessedAsAnswerValidRewardSent(tokenId)
    {
        // Store the answer
        answers[tokenId] = metadataValue;

        // Reset the answer status
        processingStatuses[tokenId] = QuestionProcessingStatus.None;

        emit QuestionAnswered(
            question.tokenOwnerOf(tokenId),
            tokenId,
            metadataValue
        );
    }

    function cancel(
        bytes32 tokenId
    )
        public
        nonReentrant
        onlyAsker(tokenId)
        onlyNotProcessedAsAnswerValidRewardSent(tokenId)
    {
        uint256 reward = rewards[tokenId];

        // Reset the data
        rewards[tokenId] = 0;
        askers[tokenId] = address(0);
        processingStatuses[tokenId] = QuestionProcessingStatus.None;

        // Transfer the reward to the asker
        (bool success, ) = msg.sender.call{value: reward}("");
        require(success, "Transfer failed");

        // Burn the token
        question.burn(tokenId, "");

        emit QuestionCancelled(msg.sender, tokenId);
    }

    function processValidAnswer(
        bytes32 tokenId
    ) public nonReentrant onlyValidator onlyNotProcessed(tokenId) {
        // Update the processing status
        processingStatuses[tokenId] = QuestionProcessingStatus
            .AnswerValidRewardSent;

        // Send the reward to the answerer
        if (rewards[tokenId] > 0) {
            (bool success, ) = question.tokenOwnerOf(tokenId).call{
                value: rewards[tokenId]
            }("");
            require(success, "Transfer failed");
        }

        emit QuestionProcessed(
            tokenId,
            QuestionProcessingStatus.AnswerValidRewardSent
        );
    }

    function processInvalidAnswer(
        bytes32 tokenId
    ) public nonReentrant onlyValidator onlyNotProcessed(tokenId) {
        processingStatuses[tokenId] = QuestionProcessingStatus.AnswerInvalid;

        emit QuestionProcessed(tokenId, QuestionProcessingStatus.AnswerInvalid);
    }

    function transferQuestionOwnership(address newOwner) public onlyOwner {
        question.transferOwnership(newOwner);
    }

    function setQuestionData(
        bytes32 dataKey,
        bytes memory dataValue
    ) public onlyOwner {
        question.setData(dataKey, dataValue);
    }

    function getReward(bytes32 tokenId) public view returns (uint256) {
        return rewards[tokenId];
    }

    function getAsker(bytes32 tokenId) public view returns (address) {
        return askers[tokenId];
    }

    function getAnswer(bytes32 tokenId) public view returns (bytes memory) {
        return answers[tokenId];
    }

    function getProcessingStatus(
        bytes32 tokenId
    ) public view returns (QuestionProcessingStatus) {
        return processingStatuses[tokenId];
    }
}
