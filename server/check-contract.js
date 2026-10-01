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

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "";

// --------------------------------------------------
// Validation
// --------------------------------------------------

if (!CONTRACT_ADDRESS) {
  console.error("");
  console.error("CONTRACT_ADDRESS is missing from .env.local");
  console.error("");

  process.exit(1);
}

// --------------------------------------------------
// Artifact
// --------------------------------------------------

const artifactPath = path.resolve(__dirname, "../artifacts/OnChainVault.json");

if (!fs.existsSync(artifactPath)) {
  console.error("Artifact missing.");

  process.exit(1);
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

// --------------------------------------------------
// Main
// --------------------------------------------------

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  console.log("");
  console.log("Checking contract...");

  console.log(`Address: ${CONTRACT_ADDRESS}`);

  const code = await provider.getCode(CONTRACT_ADDRESS);

  if (code === "0x") {
    console.error("");
    console.error("No smart contract found at this address.");
    console.error("");

    process.exit(1);
  }

  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    artifact.abi,
    provider
  );

  const maxPayloadSize = await contract.MAX_PAYLOAD_SIZE();

  console.log("");
  console.log("Contract detected.");

  console.log(`Maximum payload: ${maxPayloadSize} bytes`);

  console.log("");
}

main().catch((error) => {
  console.error(error);

  process.exit(1);
});
