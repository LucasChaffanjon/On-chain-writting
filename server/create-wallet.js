const { ethers } = require("ethers");

const wallet = ethers.Wallet.createRandom();

console.log("");
console.log("==========================================");
console.log(" On-chain Vault - New local wallet");
console.log("==========================================");
console.log("");
console.log("Address:");
console.log(wallet.address);
console.log("");
console.log("Private key:");
console.log(wallet.privateKey);
console.log("");
console.log("IMPORTANT:");
console.log("- Save the private key in .env.local");
console.log("- Never commit it to GitHub");
console.log("- Do not use this wallet for important funds");
console.log("");
