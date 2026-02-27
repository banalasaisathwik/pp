const hre = require("hardhat");

async function main() {
  const TrustAnchor = await hre.ethers.getContractFactory("TrustAnchor");
  const trustAnchor = await TrustAnchor.deploy();

  await trustAnchor.waitForDeployment();

  console.log("TrustAnchor deployed to:", await trustAnchor.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});