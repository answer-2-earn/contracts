import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";

async function main() {
  console.log("Generating an account...");
  const privateKey = generatePrivateKey();
  const address = privateKeyToAddress(privateKey);
  console.log("Generated account private key:", privateKey);
  console.log("Generated account address:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
