const fs = require("fs");
const path = require("path");
const solc = require("solc");

// --------------------------------------------------
// Paths
// --------------------------------------------------

const contractPath = path.resolve(__dirname, "../contracts/OnChainVault.sol");

const artifactsDirectory = path.resolve(__dirname, "../artifacts");

const artifactPath = path.resolve(artifactsDirectory, "OnChainVault.json");

// --------------------------------------------------
// Read Solidity source
// --------------------------------------------------

if (!fs.existsSync(contractPath)) {
  console.error(`Contract not found: ${contractPath}`);

  process.exit(1);
}

const source = fs.readFileSync(contractPath, "utf8");

// --------------------------------------------------
// Compiler input
// --------------------------------------------------

const input = {
  language: "Solidity",

  sources: {
    "OnChainVault.sol": {
      content: source,
    },
  },

  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },

    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"],
      },
    },
  },
};

// --------------------------------------------------
// Compile
// --------------------------------------------------

console.log("");
console.log("Compiling OnChainVault.sol...");
console.log(`solc version: ${solc.version()}`);
console.log("");

const output = JSON.parse(solc.compile(JSON.stringify(input)));

// --------------------------------------------------
// Compiler messages
// --------------------------------------------------

if (output.errors) {
  const errors = output.errors.filter((error) => error.severity === "error");

  output.errors.forEach((error) => {
    console.log(error.formattedMessage);
  });

  if (errors.length > 0) {
    console.error("Compilation failed.");

    process.exit(1);
  }
}

// --------------------------------------------------
// Extract contract
// --------------------------------------------------

const compiledContract = output.contracts["OnChainVault.sol"]["OnChainVault"];

if (!compiledContract) {
  console.error("Compiled contract not found.");

  process.exit(1);
}

const artifact = {
  contractName: "OnChainVault",

  compilerVersion: solc.version(),

  abi: compiledContract.abi,

  bytecode: "0x" + compiledContract.evm.bytecode.object,

  deployedBytecode: "0x" + compiledContract.evm.deployedBytecode.object,
};

// --------------------------------------------------
// Write artifact
// --------------------------------------------------

fs.mkdirSync(artifactsDirectory, {
  recursive: true,
});

fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));

console.log("Compilation successful.");

console.log(`Artifact: ${artifactPath}`);

console.log("");
