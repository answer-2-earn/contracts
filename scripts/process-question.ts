import hre from "hardhat";
import { CONTRACTS } from "./data/deployed-contracts";

const CONFIG_QUESTION_ID =
  "0xfe2f9b80d26c85d451ebd87b7f757358969d5f574f931b1ee163603bf9cd77b2";
const CONFIG_QUESTION_ANSWER_VALID = true;

async function main() {
  console.log("Processing question...");

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

  // Call the process function on the contract
  if (CONFIG_QUESTION_ANSWER_VALID) {
    await contract.write.processValidAnswer([CONFIG_QUESTION_ID]);
  } else {
    await contract.write.processInvalidAnswer([CONFIG_QUESTION_ID]);
  }

  console.log("Question processed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
