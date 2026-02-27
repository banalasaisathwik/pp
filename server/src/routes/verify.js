const express = require("express");
const router = express.Router();
const { ethers } = require("ethers");
require("dotenv").config();
const Article = require("../models/Article");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const abi = require("../../blockchain/TrustAnchorABI.json");

router.get("/:hash", async (req, res) => {
  try {
    const hash = req.params.hash;

    const article = await Article.findOne({ textHash: hash });

    if (!article || !article.blockchain?.anchored) {
      return res.json({
        verified: false,
        message: "No blockchain record found"
      });
    }

    const contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      abi,
      provider
    );

    const proof = await contract.getProof("0x" + hash);

    if (!proof || proof.timestamp == 0n) {
      return res.json({
        verified: false,
        message: "Proof not found on chain"
      });
    }

    return res.json({
      verified: true,
      blockchainTx: article.blockchain.txHash,
      trustScoreOnChain: Number(proof.trustScore) / 100,
      anchoredAt: article.blockchain.anchoredAt
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;