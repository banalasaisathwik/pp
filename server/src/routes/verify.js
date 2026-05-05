const express = require("express");
const router = express.Router();
const { ethers } = require("ethers");
require("dotenv").config();
const Article = require("../models/Article");
const { transactionUrl, addressUrl } = require("../../blockchain/explorer");

const abi = require("../../blockchain/TrustAnchorABI.json");

router.get("/:hash", async (req, res) => {
  try {
    if (!process.env.RPC_URL || !process.env.CONTRACT_ADDRESS) {
      return res.status(500).json({
        verified: false,
        error: "RPC_URL and CONTRACT_ADDRESS are required for blockchain verification"
      });
    }

    const hash = req.params.hash;
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

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
      explorerUrl: transactionUrl(article.blockchain.txHash, process.env.CHAIN_ID || "11155111"),
      contractExplorerUrl: addressUrl(process.env.CONTRACT_ADDRESS, process.env.CHAIN_ID || "11155111"),
      trustScoreOnChain: Number(proof.trustScore) / 100,
      anchoredAt: article.blockchain.anchoredAt
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
