function explorerBaseForChain(chainId) {
  const normalized = String(chainId || "");

  if (normalized === "11155111") {
    return "https://sepolia.etherscan.io";
  }

  if (normalized === "1") {
    return "https://etherscan.io";
  }

  return process.env.EXPLORER_BASE_URL || "";
}

function transactionUrl(txHash, chainId = process.env.CHAIN_ID) {
  const base = explorerBaseForChain(chainId);
  return base && txHash ? `${base}/tx/${txHash}` : null;
}

function addressUrl(address, chainId = process.env.CHAIN_ID) {
  const base = explorerBaseForChain(chainId);
  return base && address ? `${base}/address/${address}` : null;
}

module.exports = { explorerBaseForChain, transactionUrl, addressUrl };
