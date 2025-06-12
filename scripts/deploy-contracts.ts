import hre from "hardhat";
import { CONTRACTS } from "./data/deployed-contracts";

async function main() {
  console.log("Deploying contracts...");

  const network = hre.network.name;
  const [deployer] = await hre.ethers.getSigners();

  if (!CONTRACTS[network].question) {
    console.log(`Deploying 'Question' contract...`);
    const question = await hre.ethers.deployContract("Question", []);
    await question.waitForDeployment();
    console.log(`Contract 'Question' deployed: ${await question.getAddress()}`);
  }

  if (
    !CONTRACTS[network].questionManager &&
    !CONTRACTS[network].questionManagerImpl &&
    CONTRACTS[network].question
  ) {
    // Deploy question manager contract
    console.log(`Deploying 'QuestionManager' contract...`);
    const questionManagerFactory = await hre.ethers.getContractFactory(
      "QuestionManager"
    );
    const questionManager = await hre.upgrades.deployProxy(
      questionManagerFactory,
      [CONTRACTS[network].question, deployer.address]
    );
    await questionManager.waitForDeployment();
    console.log(
      `Contract 'QuestionManager' deployed: ${await questionManager.getAddress()}`
    );
    // Transfer ownership of question contract to question manager contract
    console.log(
      `Transferring ownership of 'Question' contract to 'QuestionManager'...`
    );
    const question = await hre.ethers.getContractAt(
      "Question",
      CONTRACTS[network].question
    );
    await question.transferOwnership(await questionManager.getAddress());
    console.log(`Ownership of 'Question' contract transferred`);
  }

  if (
    CONTRACTS[network].questionManager &&
    !CONTRACTS[network].questionManagerImpl
  ) {
    console.log("Upgrading 'QuestionManager' contract...");
    const questionManagerFactory = await hre.ethers.getContractFactory(
      "QuestionManager"
    );
    const questionManager = await hre.upgrades.upgradeProxy(
      CONTRACTS[network].questionManager,
      questionManagerFactory
    );
    await questionManager.waitForDeployment();
    console.log("Contract 'QuestionManager' upgraded");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
