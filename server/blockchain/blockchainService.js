const { ethers } = require("ethers");
require("dotenv").config();

console.log("🔗 Blockchain Service Loading...");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

console.log("Using wallet:", wallet.address);
console.log("RPC URL:", process.env.RPC_URL);
console.log("Contract address:", process.env.CONTRACT_ADDRESS);

const contractAddress = process.env.CONTRACT_ADDRESS;
const abi = require("./TrustAnchorABI.json");

const contract = new ethers.Contract(contractAddress, abi, wallet);

async function storeOnChain(articleHash, imageHash, finalScore) {
  const scoreScaled = Math.floor(finalScore * 100);

  const tx = await contract.storeProof(
    articleHash,
    imageHash,
    scoreScaled
  );

  await tx.wait();

  return tx.hash;
}
module.exports = { storeOnChain };