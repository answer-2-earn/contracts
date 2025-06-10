import hre from "hardhat";
import { CONTRACTS } from "./data/deployed-contracts";

const CONFIG_QUESTION_ID =
  "0xfe2f9b80d26c85d451ebd87b7f757358969d5f574f931b1ee163603bf9cd77b2";

async function main() {
  console.log("Verifying question...");

  // Get the contract address from the deployed contracts
  const network = hre.network.name;
  const contractAddress = CONTRACTS[network].questionManager;
  if (!contractAddress) {
    console.error(
      "QuestionManager contract address not found in deployed contracts"
    );
    return;
  }

  // Get the contract instance
  const contract = await hre.viem.getContractAt(
    "QuestionManager",
    contractAddress
  );

  // Call the verify function on the contract
  await contract.write.verify([CONFIG_QUESTION_ID, true]);
  console.log("Question verified");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
