const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";

const IV_LENGTH = 12;

const AUTH_TAG_LENGTH = 16;

// --------------------------------------------------
// Encryption key
// --------------------------------------------------

function getEncryptionKey() {
  const encodedKey = process.env.ENCRYPTION_KEY || "";

  if (!encodedKey) {
    throw new Error("ENCRYPTION_KEY is missing from .env.local");
  }

  const key = Buffer.from(encodedKey, "base64");

  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes");
  }

  return key;
}

// --------------------------------------------------
// Encrypt
// --------------------------------------------------

function encryptPayload(data) {
  const key = getEncryptionKey();

  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const plaintext = JSON.stringify(data);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    version: 1,

    algorithm: "AES-256-GCM",

    iv: iv.toString("base64"),

    authTag: authTag.toString("base64"),

    ciphertext: encrypted.toString("base64"),
  };
}

// --------------------------------------------------
// Decrypt
// --------------------------------------------------

function decryptPayload(encryptedPayload) {
  if (!encryptedPayload || typeof encryptedPayload !== "object") {
    throw new Error("Invalid encrypted payload");
  }

  if (encryptedPayload.version !== 1) {
    throw new Error(
      `Unsupported encryption version: ${encryptedPayload.version}`
    );
  }

  if (encryptedPayload.algorithm !== "AES-256-GCM") {
    throw new Error(
      `Unsupported encryption algorithm: ${encryptedPayload.algorithm}`
    );
  }

  const key = getEncryptionKey();

  const iv = Buffer.from(encryptedPayload.iv, "base64");

  const authTag = Buffer.from(encryptedPayload.authTag, "base64");

  const ciphertext = Buffer.from(encryptedPayload.ciphertext, "base64");

  if (iv.length !== IV_LENGTH) {
    throw new Error("Invalid IV length");
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid authentication tag length");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  const plaintext = decrypted.toString("utf8");

  return JSON.parse(plaintext);
}

module.exports = {
  encryptPayload,
  decryptPayload,
};
