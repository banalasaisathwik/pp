const { ethers } = require("ethers");
require("dotenv").config();
const { transactionUrl } = require("./explorer");

console.log("Blockchain Service Loading...");

function requiredEnv(name) {
  if (!process.env[name]) {
    throw new Error(`${name} is required for blockchain anchoring`);
  }

  return process.env[name];
}

const provider = new ethers.JsonRpcProvider(requiredEnv("RPC_URL"));
const wallet = new ethers.Wallet(requiredEnv("PRIVATE_KEY"), provider);
const contractAddress = requiredEnv("CONTRACT_ADDRESS");
const abi = require("./TrustAnchorABI.json");
const contract = new ethers.Contract(contractAddress, abi, wallet);

async function storeOnChain(articleHash, imageHash, finalScore) {
  const scoreScaled = Math.floor(finalScore * 100);

  const tx = await contract.storeProof(articleHash, imageHash, scoreScaled);
  await tx.wait();

  return tx.hash;
}

function getTransactionExplorerUrl(txHash) {
  return transactionUrl(txHash, process.env.CHAIN_ID || "11155111");
}

module.exports = { storeOnChain, getTransactionExplorerUrl };
