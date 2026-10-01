const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { ethers } = require("ethers");

const { encryptPayload, decryptPayload } = require("./crypto");

// ==================================================
// Environment
// ==================================================

dotenv.config({
  path: path.resolve(__dirname, "../.env.local"),
  override: true,
});

// ==================================================
// Configuration
// ==================================================

const PORT = Number(process.env.SERVER_PORT || 3001);

const NETWORK = process.env.NETWORK || "base-sepolia";

const RPC_URL = process.env.RPC_URL || "https://sepolia.base.org";

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "";

const CONTRACT_DEPLOY_BLOCK = Number(process.env.CONTRACT_DEPLOY_BLOCK || 0);

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "";

const BLOCK_BATCH_SIZE = 1000;
const MAX_PAYLOAD_SIZE = 8192;

// ==================================================
// Validation
// ==================================================

if (!PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY is missing from .env.local");
}

if (!CONTRACT_ADDRESS) {
  throw new Error("CONTRACT_ADDRESS is missing from .env.local");
}

if (!ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY is missing from .env.local");
}

if (!Number.isInteger(CONTRACT_DEPLOY_BLOCK) || CONTRACT_DEPLOY_BLOCK <= 0) {
  throw new Error("CONTRACT_DEPLOY_BLOCK is missing or invalid");
}

// ==================================================
// Artifact
// ==================================================

const artifactPath = path.resolve(__dirname, "../artifacts/OnChainVault.json");

if (!fs.existsSync(artifactPath)) {
  throw new Error("artifacts/OnChainVault.json not found");
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

// ==================================================
// Blockchain
// ==================================================

const provider = new ethers.JsonRpcProvider(RPC_URL);

const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, wallet);

// ==================================================
// Express
// ==================================================

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
  })
);

app.use(
  express.json({
    limit: "50kb",
  })
);

// ==================================================
// Helpers
// ==================================================

async function validateNetwork() {
  const network = await provider.getNetwork();

  if (network.chainId !== 84532n) {
    throw new Error(`Expected Base Sepolia (84532), got ${network.chainId}`);
  }

  return network;
}

async function writeEncryptedEntry(data) {
  const encrypted = encryptPayload(data);

  const serialized = JSON.stringify(encrypted);

  const bytes = Buffer.from(serialized, "utf8");

  if (bytes.length > MAX_PAYLOAD_SIZE) {
    throw new Error(`Encrypted payload exceeds ${MAX_PAYLOAD_SIZE} bytes`);
  }

  const blockchainPayload = ethers.hexlify(bytes);

  const transaction = await contract.writeEntry(blockchainPayload);

  const receipt = await transaction.wait();

  let entryId = null;

  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);

      if (parsed && parsed.name === "EntryWritten") {
        entryId = parsed.args.entryId.toString();

        break;
      }
    } catch {
      // Ignore unrelated logs.
    }
  }

  return {
    entryId,
    transactionHash: transaction.hash,
    blockNumber: receipt.blockNumber,
  };
}

async function getEventsInBatches(filter, fromBlock, toBlock) {
  const events = [];

  let startBlock = fromBlock;

  while (startBlock <= toBlock) {
    const endBlock = Math.min(startBlock + BLOCK_BATCH_SIZE - 1, toBlock);

    console.log(`Reading blocks ${startBlock} -> ${endBlock}`);

    const batch = await contract.queryFilter(filter, startBlock, endBlock);

    events.push(...batch);

    startBlock = endBlock + 1;
  }

  return events;
}

async function readVault() {
  const latestBlock = await provider.getBlockNumber();

  const filter = contract.filters.EntryWritten(wallet.address);

  const events = await getEventsInBatches(
    filter,
    CONTRACT_DEPLOY_BLOCK,
    latestBlock
  );

  events.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) {
      return a.blockNumber - b.blockNumber;
    }

    return a.index - b.index;
  });

  const messageMap = new Map();
  const categoryMap = new Map();
  const errors = [];

  for (const event of events) {
    try {
      const bytes = ethers.getBytes(event.args.encryptedPayload);

      const serialized = Buffer.from(bytes).toString("utf8");

      const encrypted = JSON.parse(serialized);

      const data = decryptPayload(encrypted);

      const metadata = {
        entryId: event.args.entryId.toString(),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
      };

      // --------------------------------------------
      // Category creation
      // --------------------------------------------

      if (data.type === "category") {
        categoryMap.set(data.id, {
          ...data,
          ...metadata,
        });

        continue;
      }

      // --------------------------------------------
      // Category update
      // --------------------------------------------

      if (data.type === "category-update") {
        const existing = categoryMap.get(data.targetId);

        if (existing) {
          categoryMap.set(data.targetId, {
            ...existing,
            name: data.name,
            updatedAt: data.updatedAt,
            lastEntryId: metadata.entryId,
            lastBlockNumber: metadata.blockNumber,
            lastTransactionHash: metadata.transactionHash,
          });
        }

        continue;
      }

      // --------------------------------------------
      // Category delete
      // --------------------------------------------

      if (data.type === "category-delete") {
        categoryMap.delete(data.targetId);

        continue;
      }

      // --------------------------------------------
      // Message creation
      // --------------------------------------------

      if (data.type === "message") {
        messageMap.set(data.id, {
          ...data,
          ...metadata,
        });

        continue;
      }

      // --------------------------------------------
      // Message update
      // --------------------------------------------

      if (data.type === "message-update") {
        const existing = messageMap.get(data.targetId);

        if (existing) {
          messageMap.set(data.targetId, {
            ...existing,
            title: data.title,
            categoryId: data.categoryId,
            content: data.content,
            updatedAt: data.updatedAt,
            lastEntryId: metadata.entryId,
            lastBlockNumber: metadata.blockNumber,
            lastTransactionHash: metadata.transactionHash,
          });
        }

        continue;
      }

      // --------------------------------------------
      // Message delete
      // --------------------------------------------

      if (data.type === "message-delete") {
        messageMap.delete(data.targetId);

        continue;
      }

      // --------------------------------------------
      // Legacy test messages
      // --------------------------------------------

      if (data.title && data.content) {
        messageMap.set(data.id || `legacy-${metadata.entryId}`, {
          ...data,
          id: data.id || `legacy-${metadata.entryId}`,
          type: "message",
          legacy: true,
          ...metadata,
        });
      }
    } catch (error) {
      errors.push({
        entryId: event.args.entryId.toString(),
        error: error.message,
      });
    }
  }

  return {
    latestBlock,
    messages: Array.from(messageMap.values()),
    categories: Array.from(categoryMap.values()),
    errors,
  };
}

// ==================================================
// Health
// ==================================================

app.get("/api/health", async (req, res) => {
  try {
    const network = await validateNetwork();

    const blockNumber = await provider.getBlockNumber();

    res.json({
      success: true,
      application: "On-chain Vault",
      configuredNetwork: NETWORK,
      chainId: network.chainId.toString(),
      blockNumber,
      walletAddress: wallet.address,
      contractAddress: CONTRACT_ADDRESS,
      contractDeployBlock: CONTRACT_DEPLOY_BLOCK,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================================================
// Wallet
// ==================================================

app.get("/api/wallet", async (req, res) => {
  try {
    const balance = await provider.getBalance(wallet.address);

    res.json({
      success: true,
      address: wallet.address,
      balanceEth: ethers.formatEther(balance),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================================================
// Vault
// ==================================================

app.get("/api/vault", async (req, res) => {
  try {
    await validateNetwork();

    const vault = await readVault();

    res.json({
      success: true,
      fromBlock: CONTRACT_DEPLOY_BLOCK,
      toBlock: vault.latestBlock,
      messageCount: vault.messages.length,
      categoryCount: vault.categories.length,
      categories: vault.categories,
      messages: vault.messages,
      errors: vault.errors,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================================================
// Messages
// ==================================================

app.post("/api/messages", async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();

    const categoryId = String(req.body.categoryId || "").trim();

    const content = String(req.body.content || "");

    if (!title || !categoryId || !content) {
      return res.status(400).json({
        success: false,
        error: "title, categoryId and content are required",
      });
    }

    const message = {
      version: 1,
      type: "message",
      id: crypto.randomUUID(),
      title,
      categoryId,
      content,
      createdAt: new Date().toISOString(),
    };

    const blockchain = await writeEncryptedEntry(message);

    res.json({
      success: true,
      message,
      ...blockchain,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.put("/api/messages/:id", async (req, res) => {
  try {
    const targetId = req.params.id;

    const title = String(req.body.title || "").trim();

    const categoryId = String(req.body.categoryId || "").trim();

    const content = String(req.body.content || "");

    if (!title || !categoryId || !content) {
      return res.status(400).json({
        success: false,
        error: "title, categoryId and content are required",
      });
    }

    const update = {
      version: 1,
      type: "message-update",
      targetId,
      title,
      categoryId,
      content,
      updatedAt: new Date().toISOString(),
    };

    const blockchain = await writeEncryptedEntry(update);

    res.json({
      success: true,
      update,
      ...blockchain,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.delete("/api/messages/:id", async (req, res) => {
  try {
    const deletion = {
      version: 1,
      type: "message-delete",
      targetId: req.params.id,
      deletedAt: new Date().toISOString(),
    };

    const blockchain = await writeEncryptedEntry(deletion);

    res.json({
      success: true,
      deletion,
      ...blockchain,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================================================
// Categories
// ==================================================

app.post("/api/categories", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();

    if (!name) {
      return res.status(400).json({
        success: false,
        error: "Category name is required",
      });
    }

    const category = {
      version: 1,
      type: "category",
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
    };

    const blockchain = await writeEncryptedEntry(category);

    res.json({
      success: true,
      category,
      ...blockchain,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.put("/api/categories/:id", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();

    if (!name) {
      return res.status(400).json({
        success: false,
        error: "Category name is required",
      });
    }

    const update = {
      version: 1,
      type: "category-update",
      targetId: req.params.id,
      name,
      updatedAt: new Date().toISOString(),
    };

    const blockchain = await writeEncryptedEntry(update);

    res.json({
      success: true,
      update,
      ...blockchain,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.delete("/api/categories/:id", async (req, res) => {
  try {
    const vault = await readVault();

    const used = vault.messages.some(
      (message) => message.categoryId === req.params.id
    );

    if (used) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete a category that still contains messages",
      });
    }

    const deletion = {
      version: 1,
      type: "category-delete",
      targetId: req.params.id,
      deletedAt: new Date().toISOString(),
    };

    const blockchain = await writeEncryptedEntry(deletion);

    res.json({
      success: true,
      deletion,
      ...blockchain,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================================================
// Start
// ==================================================

app.listen(PORT, "127.0.0.1", () => {
  console.log("");
  console.log("==========================================");
  console.log(" On-chain Vault local API");
  console.log("==========================================");
  console.log("");
  console.log(`URL: http://127.0.0.1:${PORT}`);
  console.log(`Wallet: ${wallet.address}`);
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`Deploy block: ${CONTRACT_DEPLOY_BLOCK}`);
  console.log("");
});
