// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {_LSP4_METADATA_KEY} from "@lukso/lsp-smart-contracts/contracts/LSP4DigitalAssetMetadata/LSP4Constants.sol";
import {Question} from "./Question.sol";

/**
 * @title QuestionManager
 * @dev Manages a system where users can ask questions, provide rewards, and receive answers.
 * This contract handles the full lifecycle of questions including asking, answering,
 * validating answers, and distributing rewards.
 *
 * The contract uses the LUKSO LSP4 standard for metadata handling and OpenZeppelin's
 * upgradeable contracts for security and functionality.
 */
contract QuestionManager is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    /**
     * @dev Enum representing the possible states of a question's answer validation.
     * @param None Default state, indicates no validation has occurred yet.
     * @param AnswerInvalid The answer has been validated and deemed invalid.
     * @param AnswerValidRewardSent The answer has been validated, deemed valid, and the reward has been sent.
     */
    enum QuestionProcessingStatus {
        None,
        AnswerInvalid,
        AnswerValidRewardSent
    }

    /**
     * @dev Emitted when a new question is asked.
     * @param asker Address of the user asking the question.
     * @param answerer Address of the designated answerer.
     * @param tokenId Unique identifier for the question token.
     * @param reward Amount of ETH provided as reward for answering.
     * @param metadataValue Metadata associated with the question.
     */
    event QuestionAsked(
        address indexed asker,
        address indexed answerer,
        bytes32 indexed tokenId,
        uint256 reward,
        bytes metadataValue
    );
    /**
     * @dev Emitted when a question is answered.
     * @param answerer Address of the user providing the answer.
     * @param tokenId Unique identifier for the question token.
     * @param metadataValue Metadata containing the answer.
     */
    event QuestionAnswered(
        address indexed answerer,
        bytes32 indexed tokenId,
        bytes metadataValue
    );

    /**
     * @dev Emitted when a question is cancelled by the asker.
     * @param asker Address of the user who asked and cancelled the question.
     * @param tokenId Unique identifier for the question token.
     */
    event QuestionCancelled(address indexed asker, bytes32 indexed tokenId);

    /**
     * @dev Emitted when a question's answer is processed by the validator.
     * @param tokenId Unique identifier for the question token.
     * @param status The processing status after validation.
     */
    event QuestionProcessed(
        bytes32 indexed tokenId,
        QuestionProcessingStatus status
    );

    /// @notice The Question contract instance
    Question public question;

    /// @notice Address of the validator who can process answers
    address public validator;

    /// @notice Mapping from question tokenId to reward amount in wei
    mapping(bytes32 tokenId => uint256) public rewards;

    /// @notice Mapping from question tokenId to the address of the asker
    mapping(bytes32 tokenId => address) public askers;

    /// @notice Mapping from question tokenId to the answer data
    mapping(bytes32 tokenId => bytes) public answers;

    /// @notice Mapping from question tokenId to the processing status
    mapping(bytes32 tokenId => QuestionProcessingStatus)
        public processingStatuses;

    /**
     * @dev Restricts function access to only the validator.
     */
    modifier onlyValidator() {
        require(validator == msg.sender, "Caller is not the validator");
        _;
    }

    /**
     * @dev Restricts function access to only the owner of the question token.
     * @param tokenId The ID of the question token.
     */
    modifier onlyAnswerer(bytes32 tokenId) {
        require(
            question.tokenOwnerOf(tokenId) == msg.sender,
            "Caller is not the answerer"
        );
        _;
    }

    /**
     * @dev Restricts function access to only the asker of the question.
     * @param tokenId The ID of the question token.
     */
    modifier onlyAsker(bytes32 tokenId) {
        require(askers[tokenId] == msg.sender, "Caller is not the asker");
        _;
    }

    /**
     * @dev Ensures the question has not been processed yet.
     * @param tokenId The ID of the question token.
     */
    modifier onlyNotProcessed(bytes32 tokenId) {
        require(
            processingStatuses[tokenId] == QuestionProcessingStatus.None,
            "Processing status is not None"
        );
        _;
    }

    /**
     * @dev Ensures the question has not been processed as valid with reward sent.
     * @param tokenId The ID of the question token.
     */
    modifier onlyNotProcessedAsAnswerValidRewardSent(bytes32 tokenId) {
        require(
            processingStatuses[tokenId] !=
                QuestionProcessingStatus.AnswerValidRewardSent,
            "Processing status is AnswerValidRewardSent"
        );
        _;
    }

    /**
     * @notice Initializes the contract with the Question contract address and validator address.
     * @dev This function can only be called once due to the initializer modifier.
     * @param questionAddress Address of the deployed Question contract.
     * @param validatorAddress Address of the validator who will process answers.
     */
    function initialize(
        address questionAddress,
        address validatorAddress
    ) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        question = Question(payable(questionAddress));
        validator = validatorAddress;
    }

    /**
     * @notice Creates a new question with a specified answerer and metadata.
     * @dev The function mints a new token for the question and stores relevant information.
     * @param answerer Address that will be allowed to answer the question.
     * @param metadataValue Metadata associated with the question (typically contains the question content).
     */
    function ask(
        address answerer,
        bytes memory metadataValue
    ) public payable whenNotPaused {
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

    /**
     * @notice Allows the token owner to submit an answer to a question.
     * @dev Can only be called by the owner of the question token.
     * @param tokenId The ID of the question token.
     * @param metadataValue Metadata containing the answer.
     */
    function answer(
        bytes32 tokenId,
        bytes memory metadataValue
    )
        public
        nonReentrant
        whenNotPaused
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

    /**
     * @notice Allows the asker to cancel a question and reclaim the reward.
     * @dev Can only be called by the original asker of the question.
     * @param tokenId The ID of the question token to cancel.
     */
    function cancel(
        bytes32 tokenId
    )
        public
        nonReentrant
        whenNotPaused
        onlyAsker(tokenId)
        onlyNotProcessedAsAnswerValidRewardSent(tokenId)
    {
        uint256 reward = rewards[tokenId];

        // Reset the data
        rewards[tokenId] = 0;
        askers[tokenId] = address(0);
        answers[tokenId] = ""; // Clear the answers mapping
        processingStatuses[tokenId] = QuestionProcessingStatus.None;

        // Transfer the reward to the asker
        (bool success, ) = msg.sender.call{value: reward}("");
        require(success, "Transfer failed");

        // Burn the token
        question.burn(tokenId, "");

        emit QuestionCancelled(msg.sender, tokenId);
    }

    /**
     * @notice Processes a valid answer and sends the reward to the answerer.
     * @dev Can only be called by the validator.
     * @param tokenId The ID of the question token to process.
     */
    function processValidAnswer(
        bytes32 tokenId
    )
        public
        nonReentrant
        whenNotPaused
        onlyValidator
        onlyNotProcessed(tokenId)
    {
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

    /**
     * @notice Marks an answer as invalid.
     * @dev Can only be called by the validator.
     * @param tokenId The ID of the question token to process.
     */
    function processInvalidAnswer(
        bytes32 tokenId
    )
        public
        nonReentrant
        whenNotPaused
        onlyValidator
        onlyNotProcessed(tokenId)
    {
        processingStatuses[tokenId] = QuestionProcessingStatus.AnswerInvalid;

        emit QuestionProcessed(tokenId, QuestionProcessingStatus.AnswerInvalid);
    }

    /**
     * @notice Pauses all contract functions with the whenNotPaused modifier.
     * @dev Can only be called by the contract owner.
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses all contract functions with the whenNotPaused modifier.
     * @dev Can only be called by the contract owner.
     */
    function unpause() public onlyOwner {
        _unpause();
    }

    /**
     * @notice Transfers ownership of the Question contract to a new owner.
     * @dev Can only be called by the contract owner.
     * @param newOwner Address of the new owner.
     */
    function transferQuestionOwnership(address newOwner) public onlyOwner {
        question.transferOwnership(newOwner);
    }

    /**
     * @notice Sets data on the Question contract.
     * @dev Can only be called by the contract owner.
     * @param dataKey The key for the data to set.
     * @param dataValue The value for the data to set.
     */
    function setQuestionData(
        bytes32 dataKey,
        bytes memory dataValue
    ) public onlyOwner {
        question.setData(dataKey, dataValue);
    }

    /**
     * @notice Updates the validator address.
     * @dev Can only be called by the contract owner.
     * @param newValidator Address of the new validator.
     */
    function setValidator(address newValidator) public onlyOwner {
        validator = newValidator;
    }

    /**
     * @notice Gets the reward amount for a specific question.
     * @param tokenId The ID of the question token.
     * @return The reward amount in wei.
     */
    function getReward(bytes32 tokenId) public view returns (uint256) {
        return rewards[tokenId];
    }

    /**
     * @notice Gets the address of the asker for a specific question.
     * @param tokenId The ID of the question token.
     * @return The address of the asker.
     */
    function getAsker(bytes32 tokenId) public view returns (address) {
        return askers[tokenId];
    }

    /**
     * @notice Gets the answer data for a specific question.
     * @param tokenId The ID of the question token.
     * @return The answer data as bytes.
     */
    function getAnswer(bytes32 tokenId) public view returns (bytes memory) {
        return answers[tokenId];
    }

    /**
     * @notice Gets the processing status for a specific question.
     * @param tokenId The ID of the question token.
     * @return The processing status enum value.
     */
    function getProcessingStatus(
        bytes32 tokenId
    ) public view returns (QuestionProcessingStatus) {
        return processingStatuses[tokenId];
    }
}
