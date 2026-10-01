const fs = require("fs");
const path = require("path");

const dotenv = require("dotenv");
const { ethers } = require("ethers");

const { decryptPayload } = require("../crypto");

// --------------------------------------------------
// Load .env.local
// --------------------------------------------------

const envPath = path.resolve(__dirname, "../../.env.local");

console.log("");
console.log(`Loading environment from: ${envPath}`);

if (!fs.existsSync(envPath)) {
  console.error("");
  console.error(".env.local not found.");
  console.error("");

  process.exit(1);
}

const envResult = dotenv.config({
  path: envPath,
  override: true,
});

if (envResult.error) {
  console.error("");
  console.error("Unable to load .env.local:");

  console.error(envResult.error);

  console.error("");

  process.exit(1);
}

// --------------------------------------------------
// Configuration
// --------------------------------------------------

const RPC_URL = process.env.RPC_URL || "https://sepolia.base.org";

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "";

const rawDeployBlock = process.env.CONTRACT_DEPLOY_BLOCK;

const CONTRACT_DEPLOY_BLOCK = Number(rawDeployBlock);

const BLOCK_BATCH_SIZE = 1000;

// --------------------------------------------------
// Debug configuration
// --------------------------------------------------

console.log("");
console.log("Environment configuration:");

console.log(`RPC_URL: ${RPC_URL}`);

console.log(`CONTRACT_ADDRESS: ${CONTRACT_ADDRESS}`);

console.log(`CONTRACT_DEPLOY_BLOCK raw: "${rawDeployBlock}"`);

console.log(`CONTRACT_DEPLOY_BLOCK parsed: ${CONTRACT_DEPLOY_BLOCK}`);

console.log("");

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

if (!rawDeployBlock) {
  console.error("");

  console.error("CONTRACT_DEPLOY_BLOCK is missing from .env.local");

  console.error("");

  process.exit(1);
}

if (!Number.isInteger(CONTRACT_DEPLOY_BLOCK) || CONTRACT_DEPLOY_BLOCK <= 0) {
  console.error("");

  console.error(`Invalid CONTRACT_DEPLOY_BLOCK: "${rawDeployBlock}"`);

  console.error("");

  process.exit(1);
}

// --------------------------------------------------
// Contract artifact
// --------------------------------------------------

const artifactPath = path.resolve(
  __dirname,
  "../../artifacts/OnChainVault.json"
);

if (!fs.existsSync(artifactPath)) {
  console.error("Contract artifact not found.");

  process.exit(1);
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

// --------------------------------------------------
// Read events in batches
// --------------------------------------------------

async function getEventsInBatches(contract, filter, fromBlock, toBlock) {
  const events = [];

  let startBlock = fromBlock;

  let batchNumber = 1;

  while (startBlock <= toBlock) {
    const endBlock = Math.min(startBlock + BLOCK_BATCH_SIZE - 1, toBlock);

    console.log(`Batch ${batchNumber}: blocks ${startBlock} -> ${endBlock}`);

    const batch = await contract.queryFilter(filter, startBlock, endBlock);

    if (batch.length > 0) {
      console.log(`  Found ${batch.length} event(s)`);
    }

    events.push(...batch);

    startBlock = endBlock + 1;

    batchNumber += 1;
  }

  return events;
}

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

  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    artifact.abi,
    provider
  );

  console.log("==========================================");

  console.log(" On-chain Vault - Read test");

  console.log("==========================================");

  console.log("");

  console.log(`Wallet: ${wallet.address}`);

  console.log(`Contract: ${CONTRACT_ADDRESS}`);

  console.log(`Deploy block: ${CONTRACT_DEPLOY_BLOCK}`);

  // ------------------------------------------------
  // Verify contract
  // ------------------------------------------------

  const code = await provider.getCode(CONTRACT_ADDRESS);

  if (code === "0x") {
    throw new Error("No contract found at CONTRACT_ADDRESS");
  }

  // ------------------------------------------------
  // Latest block
  // ------------------------------------------------

  const latestBlock = await provider.getBlockNumber();

  console.log(`Latest block: ${latestBlock}`);

  if (CONTRACT_DEPLOY_BLOCK > latestBlock) {
    throw new Error(
      `Deployment block ${CONTRACT_DEPLOY_BLOCK} is greater than latest block ${latestBlock}`
    );
  }

  // ------------------------------------------------
  // Filter by wallet
  // ------------------------------------------------

  const filter = contract.filters.EntryWritten(wallet.address);

  console.log("");
  console.log("Reading blockchain events...");
  console.log("");

  // ------------------------------------------------
  // Start at deployment block
  // ------------------------------------------------

  const events = await getEventsInBatches(
    contract,
    filter,
    CONTRACT_DEPLOY_BLOCK,
    latestBlock
  );

  // ------------------------------------------------
  // Sort
  // ------------------------------------------------

  events.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) {
      return a.blockNumber - b.blockNumber;
    }

    return a.index - b.index;
  });

  console.log("");

  console.log(
    `Found ${events.length} entr${events.length === 1 ? "y" : "ies"}.`
  );

  console.log("");

  if (events.length === 0) {
    console.log("No encrypted entries found for this wallet.");

    console.log("");

    return;
  }

  // ------------------------------------------------
  // Decrypt entries
  // ------------------------------------------------

  for (const event of events) {
    const entryId = event.args.entryId;

    const encryptedPayloadHex = event.args.encryptedPayload;

    try {
      const bytes = ethers.getBytes(encryptedPayloadHex);

      const serialized = Buffer.from(bytes).toString("utf8");

      const encrypted = JSON.parse(serialized);

      const message = decryptPayload(encrypted);

      console.log("------------------------------------------");

      console.log(`Entry ID: ${entryId}`);

      console.log(`Block: ${event.blockNumber}`);

      console.log(`Transaction: ${event.transactionHash}`);

      console.log("");

      console.log(JSON.stringify(message, null, 2));

      console.log("");
    } catch (error) {
      console.error(`Unable to decrypt entry ${entryId}:`);

      console.error(error.message);

      console.error("");
    }
  }
}

// --------------------------------------------------
// Run
// --------------------------------------------------

main().catch((error) => {
  console.error("");
  console.error("Read test failed:");

  console.error(error);

  console.error("");

  process.exit(1);
});
