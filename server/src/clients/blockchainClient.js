let ethersLib = null;

function getEthers() {
  if (ethersLib) return ethersLib;
  try {
    // Lazy-load so server can run even when blockchain dependency is unavailable in restricted envs.
    // eslint-disable-next-line global-require
    ethersLib = require('ethers');
    return ethersLib;
  } catch (err) {
    throw new Error('ethers dependency is not installed');
  }
}

const ABI = [
  'function storeArticle(bytes32 hash, uint256 trustScore)',
];

function getBlockchainConfig() {
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
  const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY || process.env.PRIVATE_KEY;
  const contractAddress = process.env.BLOCKCHAIN_CONTRACT_ADDRESS;

  if (!rpcUrl || !privateKey || !contractAddress) {
    throw new Error('Blockchain env not configured (BLOCKCHAIN_RPC_URL, BLOCKCHAIN_PRIVATE_KEY/PRIVATE_KEY, BLOCKCHAIN_CONTRACT_ADDRESS)');
  }

  return { rpcUrl, privateKey, contractAddress };
}

async function storeArticleOnChain({ articleHash, trustScoreScaled }) {
  const { ethers } = getEthers();
  const { rpcUrl, privateKey, contractAddress } = getBlockchainConfig();

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, ABI, wallet);

  const tx = await contract.storeArticle(articleHash, trustScoreScaled);
  const receipt = await tx.wait();
  const block = receipt?.blockNumber ? await provider.getBlock(receipt.blockNumber) : null;

  return {
    txHash: tx.hash,
    blockchainTimestamp: block?.timestamp ? new Date(block.timestamp * 1000) : new Date(),
  };
}

module.exports = { storeArticleOnChain };
