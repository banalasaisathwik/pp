const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const TrustAnchor = await hre.ethers.getContractFactory("TrustAnchor");
  const trustAnchor = await TrustAnchor.deploy();

  await trustAnchor.waitForDeployment();

  const address = await trustAnchor.getAddress();
  const network = await hre.ethers.provider.getNetwork();
  const explorerBase =
    network.chainId === 11155111n
      ? "https://sepolia.etherscan.io/address/"
      : null;

  console.log("TrustAnchor deployed to:", address);
  console.log("Network:", hre.network.name, "chainId:", network.chainId.toString());

  if (explorerBase) {
    console.log("Explorer:", `${explorerBase}${address}`);
  }

  const deploymentPath = path.join(__dirname, "deployment.json");
  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(
      {
        contractAddress: address,
        network: hre.network.name,
        chainId: network.chainId.toString(),
        deployedAt: new Date().toISOString(),
        explorerUrl: explorerBase ? `${explorerBase}${address}` : null
      },
      null,
      2
    )
  );

  console.log("Saved deployment metadata to:", deploymentPath);
  console.log("Put this in server/.env:");
  console.log(`CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
