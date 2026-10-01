const fs = require("fs");
const path = require("path");

const dotenv = require("dotenv");

const { ethers } = require("ethers");

// --------------------------------------------------
// Environment
// --------------------------------------------------

dotenv.config({
  path: path.resolve(__dirname, "../.env.local"),
});

const RPC_URL = process.env.RPC_URL || "https://sepolia.base.org";

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

// --------------------------------------------------
// Validation
// --------------------------------------------------

if (!PRIVATE_KEY) {
  console.error("");
  console.error("PRIVATE_KEY is missing from .env.local");
  console.error("");

  process.exit(1);
}

if (!RPC_URL) {
  console.error("");
  console.error("RPC_URL is missing from .env.local");
  console.error("");

  process.exit(1);
}

// --------------------------------------------------
// Artifact
// --------------------------------------------------

const artifactPath = path.resolve(__dirname, "../artifacts/OnChainVault.json");

if (!fs.existsSync(artifactPath)) {
  console.error("");
  console.error("Contract artifact not found.");

  console.error("Run:");

  console.error("npm run contract:compile");

  console.error("");

  process.exit(1);
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

// --------------------------------------------------
// Main
// --------------------------------------------------

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("");
  console.log("==========================================");
  console.log(" On-chain Vault deployment");
  console.log("==========================================");
  console.log("");

  // ------------------------------------------------
  // Network
  // ------------------------------------------------

  const network = await provider.getNetwork();

  console.log(`Wallet: ${wallet.address}`);

  console.log(`Chain ID: ${network.chainId}`);

  if (network.chainId !== 84532n) {
    console.error("");
    console.error("ERROR:");

    console.error("This deployment script currently expects Base Sepolia.");

    console.error(`Received chain ID: ${network.chainId}`);

    console.error("");

    process.exit(1);
  }

  // ------------------------------------------------
  // Balance
  // ------------------------------------------------

  const balance = await provider.getBalance(wallet.address);

  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.error("");
    console.error("Wallet balance is zero.");

    console.error("Fund the wallet with Base Sepolia ETH before deploying.");

    console.error("");

    process.exit(1);
  }

  // ------------------------------------------------
  // Deploy
  // ------------------------------------------------

  console.log("");
  console.log("Deploying contract...");

  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    wallet
  );

  const contract = await factory.deploy();

  const deploymentTransaction = contract.deploymentTransaction();

  if (!deploymentTransaction) {
    throw new Error("Unable to retrieve deployment transaction");
  }

  console.log("");
  console.log("Deployment transaction sent.");

  console.log(`Transaction: ${deploymentTransaction.hash}`);

  console.log("");
  console.log("Waiting for confirmation...");

  // ------------------------------------------------
  // Transaction receipt
  // ------------------------------------------------

  const receipt = await deploymentTransaction.wait();

  if (!receipt) {
    throw new Error("Deployment receipt not found");
  }

  await contract.waitForDeployment();

  // ------------------------------------------------
  // Result
  // ------------------------------------------------

  const address = await contract.getAddress();

  const deployBlock = receipt.blockNumber;

  console.log("");
  console.log("==========================================");
  console.log(" Deployment successful");
  console.log("==========================================");

  console.log("");

  console.log(`Contract address: ${address}`);

  console.log(`Deployment block: ${deployBlock}`);

  console.log(`Transaction hash: ${deploymentTransaction.hash}`);

  console.log("");

  console.log("Add these values to .env.local:");

  console.log("");

  console.log(`CONTRACT_ADDRESS=${address}`);

  console.log(`CONTRACT_DEPLOY_BLOCK=${deployBlock}`);

  console.log("");
}

// --------------------------------------------------
// Run
// --------------------------------------------------

main().catch((error) => {
  console.error("");
  console.error("Deployment failed:");

  console.error(error);

  console.error("");

  process.exit(1);
});
