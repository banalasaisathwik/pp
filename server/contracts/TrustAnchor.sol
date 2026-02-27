// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TrustAnchor {

    struct ArticleProof {
        bytes32 articleHash;
        bytes32 imageHash;
        uint256 trustScore;   // scaled by 100
        uint256 timestamp;
    }

    mapping(bytes32 => ArticleProof) public proofs;

    event ProofStored(
        bytes32 indexed articleHash,
        bytes32 imageHash,
        uint256 trustScore,
        uint256 timestamp
    );

    function storeProof(
        bytes32 _articleHash,
        bytes32 _imageHash,
        uint256 _trustScore
    ) public {

        require(proofs[_articleHash].timestamp == 0, "Already stored");

        proofs[_articleHash] = ArticleProof({
            articleHash: _articleHash,
            imageHash: _imageHash,
            trustScore: _trustScore,
            timestamp: block.timestamp
        });

        emit ProofStored(_articleHash, _imageHash, _trustScore, block.timestamp);
    }

    function getProof(bytes32 _articleHash)
        public
        view
        returns (ArticleProof memory)
    {
        return proofs[_articleHash];
    }
}