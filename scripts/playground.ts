import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";

async function generateAccount() {
  const privateKey = generatePrivateKey();
  const address = privateKeyToAddress(privateKey);
  console.log("Generated account private key:", privateKey);
  console.log("Generated account address:", address);
}

async function main() {
  console.log("👟 Start script 'playground'");

  await generateAccount();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
