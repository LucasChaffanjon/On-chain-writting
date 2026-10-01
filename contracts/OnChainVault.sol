// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

/**
 * @title OnChainVault
 * @notice Minimal append-only encrypted vault.
 *
 * The contract does NOT know the content of the messages.
 *
 * The client must encrypt the payload before calling writeEntry().
 *
 * Public metadata:
 * - sender address
 * - entry id
 * - block / transaction timestamp indirectly
 * - encrypted payload size
 *
 * Private data such as:
 * - title
 * - category
 * - content
 *
 * must be inside encryptedPayload.
 */
contract OnChainVault {
    /**
     * Maximum encrypted payload size.
     *
     * 8192 bytes is intentionally much larger than what is needed
     * for passwords, seed phrases and normal text notes.
     */
    uint256 public constant MAX_PAYLOAD_SIZE = 8192;

    /**
     * Number of entries written by each wallet.
     *
     * This is used to generate sequential entry IDs.
     */
    mapping(address => uint256) public nextEntryId;

    /**
     * Emitted every time an encrypted entry is written.
     *
     * owner and entryId are indexed so they can be efficiently
     * filtered through eth_getLogs.
     */
    event EntryWritten(
        address indexed owner,
        uint256 indexed entryId,
        bytes encryptedPayload
    );

    /**
     * Write an encrypted payload.
     *
     * The smart contract never attempts to decrypt it.
     */
    function writeEntry(
        bytes calldata encryptedPayload
    ) external returns (uint256 entryId) {
        require(encryptedPayload.length > 0, "Payload cannot be empty");

        require(
            encryptedPayload.length <= MAX_PAYLOAD_SIZE,
            "Payload too large"
        );

        entryId = nextEntryId[msg.sender];

        nextEntryId[msg.sender] = entryId + 1;

        emit EntryWritten(msg.sender, entryId, encryptedPayload);
    }

    /**
     * Returns the number of entries emitted by a wallet.
     */
    function getEntryCount(address owner) external view returns (uint256) {
        return nextEntryId[owner];
    }
}
