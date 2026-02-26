// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract NewsTrust {
    struct ArticleRecord {
        bytes32 hash;
        uint256 trustScore;
        uint256 timestamp;
    }

    mapping(bytes32 => ArticleRecord) public articles;

    event ArticleStored(bytes32 indexed hash, uint256 trustScore, uint256 timestamp);

    function storeArticle(bytes32 hash, uint256 trustScore) external {
        uint256 ts = block.timestamp;
        articles[hash] = ArticleRecord({
            hash: hash,
            trustScore: trustScore,
            timestamp: ts
        });
        emit ArticleStored(hash, trustScore, ts);
    }
}
