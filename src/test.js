import { SigningKey } from "ethers";

const privateKey = "";
const pub = new SigningKey(privateKey).compressedPublicKey;
console.log(pub);
