const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const dotenv = require("dotenv");
const { ethers } = require("ethers");

const { encryptPayload } = require("../crypto");

// --------------------------------------------------
// Load environment
// --------------------------------------------------

dotenv.config({
  path: path.resolve(__dirname, "../../.env.local"),
  override: true,
});

// --------------------------------------------------
// Configuration
// --------------------------------------------------

const RPC_URL = process.env.RPC_URL || "https://sepolia.base.org";

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "";

// --------------------------------------------------
// Validation
// --------------------------------------------------

if (!PRIVATE_KEY) {
  console.error("PRIVATE_KEY is missing.");

  process.exit(1);
}

if (!CONTRACT_ADDRESS) {
  console.error("CONTRACT_ADDRESS is missing.");

  process.exit(1);
}

// --------------------------------------------------
// Load contract artifact
// --------------------------------------------------

const artifactPath = path.resolve(
  __dirname,
  "../../artifacts/OnChainVault.json"
);

if (!fs.existsSync(artifactPath)) {
  console.error("Contract artifact not found.");

  console.error("Run npm run contract:compile");

  process.exit(1);
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

// --------------------------------------------------
// Main
// --------------------------------------------------

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const network = await provider.getNetwork();

  if (network.chainId !== 84532n) {
    throw new Error(`Expected Base Sepolia (84532), got ${network.chainId}`);
  }

  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, wallet);

  // ------------------------------------------------
  // TEST MESSAGE
  //
  // Do NOT put a real password or seed phrase here.
  // ------------------------------------------------

  const message = {
    version: 1,

    id: crypto.randomUUID(),

    title: "Premier test",

    category: "note",

    content: "Bonjour blockchain",

    createdAt: new Date().toISOString(),
  };

  console.log("");
  console.log("==========================================");
  console.log(" On-chain Vault - Write test");
  console.log("==========================================");

  console.log("");
  console.log("Original message:");

  console.log(JSON.stringify(message, null, 2));

  // ------------------------------------------------
  // Encrypt
  // ------------------------------------------------

  const encrypted = encryptPayload(message);

  const serialized = JSON.stringify(encrypted);

  const serializedBytes = Buffer.from(serialized, "utf8");

  console.log("");

  console.log(`Encrypted payload size: ${serializedBytes.length} bytes`);

  if (serializedBytes.length > 8192) {
    throw new Error("Encrypted payload exceeds contract limit");
  }

  // ------------------------------------------------
  // JSON -> Solidity bytes
  // ------------------------------------------------

  const blockchainPayload = ethers.hexlify(serializedBytes);

  // ------------------------------------------------
  // Write
  // ------------------------------------------------

  console.log("");
  console.log("Sending transaction...");

  const transaction = await contract.writeEntry(blockchainPayload);

  console.log(`Transaction hash: ${transaction.hash}`);

  console.log("");
  console.log("Waiting for confirmation...");

  const receipt = await transaction.wait();

  console.log("");
  console.log(`Block: ${receipt.blockNumber}`);

  // ------------------------------------------------
  // Find EntryWritten event
  // ------------------------------------------------

  let entryId = null;

  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);

      if (parsed && parsed.name === "EntryWritten") {
        entryId = parsed.args.entryId.toString();

        break;
      }
    } catch {
      // Ignore unrelated logs
    }
  }

  console.log(`Entry ID: ${entryId ?? "unknown"}`);

  console.log("");

  console.log("Encrypted message stored on Base Sepolia.");

  console.log("");
}

// --------------------------------------------------
// Run
// --------------------------------------------------

main().catch((error) => {
  console.error("");
  console.error("Write test failed:");

  console.error(error);

  console.error("");

  process.exit(1);
});
