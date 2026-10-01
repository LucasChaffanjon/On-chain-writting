const crypto = require("crypto");

const key = crypto.randomBytes(32);

const base64Key = key.toString("base64");

console.log("");
console.log("==========================================");
console.log(" On-chain Vault - Encryption key");
console.log("==========================================");
console.log("");
console.log("AES-256 key generated successfully.");
console.log("");
console.log("Add this value to .env.local:");
console.log("");
console.log(`ENCRYPTION_KEY=${base64Key}`);
console.log("");
console.log("IMPORTANT:");
console.log("- Never commit this key");
console.log("- Never publish this key");
console.log("- Back it up securely");
console.log("- Losing this key means losing access to encrypted data");
console.log("");
