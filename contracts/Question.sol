// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {LSP8Mintable} from "@lukso/lsp-smart-contracts/contracts/LSP8IdentifiableDigitalAsset/presets/LSP8Mintable.sol";
import {_LSP8_TOKENID_FORMAT_NUMBER} from "@lukso/lsp-smart-contracts/contracts/LSP8IdentifiableDigitalAsset/LSP8Constants.sol";
import {_LSP4_TOKEN_TYPE_COLLECTION} from "@lukso/lsp-smart-contracts/contracts/LSP4DigitalAssetMetadata/LSP4Constants.sol";

/**
 * @title Question
 * @dev A token contract that represents questions in the question-answer system.
 * This contract extends the LUKSO LSP8 standard for non-fungible tokens,
 * allowing for unique identification of each question.
 *
 * Each token represents a specific question that can be asked, answered,
 * and processed through the QuestionManager contract.
 */
contract Question is LSP8Mintable {
    /**
     * @notice Initializes the Question token contract.
     * @dev Sets up the LSP8 token with name "Question Token", symbol "QT",
     * and configures it as a collection type with number format for token IDs.
     */
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
     * @notice Burns a token by its ID.
     * @dev Can only be called by the contract owner. This function destroys the token,
     * removing it from circulation.
     * @param tokenId The unique identifier of the token to burn.
     * @param data Additional data to include in the burn operation, if any.
     */
    function burn(bytes32 tokenId, bytes memory data) public onlyOwner {
        _burn(tokenId, data);
    }
}
