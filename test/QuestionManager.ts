import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { Account, Hex, parseEther, zeroAddress } from "viem";
import { getAnswerMetadataValue, getAskMetadataValue } from "./utils/metadata";

describe("QuestionManager", function () {
  async function initFixture() {
    // Get public client
    const publicClient = await hre.viem.getPublicClient();

    // Get wallet clients
    const [deployer, userOne, userTwo] = await hre.viem.getWalletClients();

    // Deploy question contract
    const questionContract = await hre.viem.deployContract("Question", []);

    // Deploy and initialize question manager contract
    const questionManagerContract = await hre.viem.deployContract(
      "QuestionManager",
      []
    );
    questionManagerContract.write.initialize([
      questionContract.address,
      deployer.account.address,
    ]);

    // Transfer ownership of question contract to question manager
    questionContract.write.transferOwnership([questionManagerContract.address]);

    return {
      publicClient,
      deployer,
      userOne,
      userTwo,
      questionContract,
      questionManagerContract,
    };
  }

  async function askQuestion(
    answererAccount: Account,
    askerAccount: Account,
    reward: bigint,
    metadataValue: Hex,
    questionManagerContractAddress: `0x${string}`
  ) {
    const questionManagerContract = await hre.viem.getContractAt(
      "QuestionManager",
      questionManagerContractAddress
    );
    if (reward === 0n) {
      return questionManagerContract.write.ask(
        [answererAccount.address, metadataValue],
        {
          account: askerAccount,
        }
      );
    } else {
      return questionManagerContract.write.ask(
        [answererAccount.address, metadataValue],
        {
          account: askerAccount,
          value: reward,
        }
      );
    }
  }

  async function cancelQuestion(
    askerAccount: Account,
    token: `0x${string}`,
    questionManagerContractAddress: `0x${string}`
  ) {
    const questionManagerContract = await hre.viem.getContractAt(
      "QuestionManager",
      questionManagerContractAddress
    );
    return questionManagerContract.write.cancel([token], {
      account: askerAccount,
    });
  }

  async function answerQuestion(
    answererAccount: Account,
    token: `0x${string}`,
    metadataValue: Hex,
    questionManagerContractAddress: `0x${string}`
  ) {
    const questionManagerContract = await hre.viem.getContractAt(
      "QuestionManager",
      questionManagerContractAddress
    );
    return questionManagerContract.write.answer([token, metadataValue], {
      account: answererAccount,
    });
  }

  async function processValidAnswer(
    deployerAccount: Account,
    token: `0x${string}`,
    questionManagerContractAddress: `0x${string}`
  ) {
    const questionManagerContract = await hre.viem.getContractAt(
      "QuestionManager",
      questionManagerContractAddress
    );
    await questionManagerContract.write.processValidAnswer([token], {
      account: deployerAccount,
    });
  }

  async function processInvalidAnswer(
    deployerAccount: Account,
    token: `0x${string}`,
    questionManagerContractAddress: `0x${string}`
  ) {
    const questionManagerContract = await hre.viem.getContractAt(
      "QuestionManager",
      questionManagerContractAddress
    );
    await questionManagerContract.write.processInvalidAnswer([token], {
      account: deployerAccount,
    });
  }

  async function getFirstToken(
    answererAccount: Account,
    questionContractAddress: `0x${string}`
  ) {
    const questionContract = await hre.viem.getContractAt(
      "Question",
      questionContractAddress
    );
    const tokens = await questionContract.read.tokenIdsOf([
      answererAccount.address,
    ]);
    return tokens[0];
  }

  describe("Asking", function () {
    // TODO: Check balance
    // TODO: Check data
    it("Should ask a question", async function () {
      const { userOne, userTwo, questionManagerContract } = await loadFixture(
        initFixture
      );

      await expect(
        askQuestion(
          userOne.account,
          userTwo.account,
          parseEther("1"),
          getAskMetadataValue(),
          questionManagerContract.address
        )
      ).to.not.rejected;
    });

    it("Should ask a question without a reward", async function () {
      const { userOne, userTwo, questionManagerContract } = await loadFixture(
        initFixture
      );

      await expect(
        askQuestion(
          userOne.account,
          userTwo.account,
          parseEther("0"),
          getAskMetadataValue(),
          questionManagerContract.address
        )
      ).to.not.rejected;
    });

    it("Should fail if a question asked to yourself", async function () {
      const { userOne, questionManagerContract } = await loadFixture(
        initFixture
      );

      await expect(
        askQuestion(
          userOne.account,
          userOne.account,
          parseEther("1"),
          getAskMetadataValue(),
          questionManagerContract.address
        )
      ).to.rejectedWith("Answerer cannot ask yourself");
    });
  });

  describe("Answering", function () {
    it("Should answer a question by answerer", async function () {
      const { userOne, userTwo, questionContract, questionManagerContract } =
        await loadFixture(initFixture);

      await askQuestion(
        userOne.account,
        userTwo.account,
        parseEther("1"),
        getAskMetadataValue(),
        questionManagerContract.address
      );

      const token = await getFirstToken(
        userOne.account,
        questionContract.address
      );

      await expect(
        answerQuestion(
          userOne.account,
          token,
          getAnswerMetadataValue(),
          questionManagerContract.address
        )
      ).to.not.rejected;
    });

    it("Should fail if a question answered by not answerer", async function () {
      const { userOne, userTwo, questionContract, questionManagerContract } =
        await loadFixture(initFixture);

      await askQuestion(
        userOne.account,
        userTwo.account,
        parseEther("1"),
        getAskMetadataValue(),
        questionManagerContract.address
      );

      const token = await getFirstToken(
        userOne.account,
        questionContract.address
      );

      await expect(
        answerQuestion(
          userTwo.account,
          token,
          getAnswerMetadataValue(),
          questionManagerContract.address
        )
      ).to.rejectedWith("Caller is not the answerer");
    });
  });

  describe("Processing", function () {
    it("Should process a valid answer", async function () {
      const {
        publicClient,
        deployer,
        userOne,
        userTwo,
        questionContract,
        questionManagerContract,
      } = await loadFixture(initFixture);

      await askQuestion(
        userOne.account,
        userTwo.account,
        parseEther("1"),
        getAskMetadataValue(),
        questionManagerContract.address
      );

      const token = await getFirstToken(
        userOne.account,
        questionContract.address
      );

      await answerQuestion(
        userOne.account,
        token,
        getAnswerMetadataValue(),
        questionManagerContract.address
      );

      // Get user one balance before processing
      const userOneBalanceBefore = await publicClient.getBalance({
        address: userOne.account.address,
      });

      // Process a valid answer
      await expect(
        processValidAnswer(
          deployer.account,
          token,
          questionManagerContract.address
        )
      ).to.not.rejected;

      // Check processing status after processing
      const processingStatusAfter =
        await questionManagerContract.read.getProcessingStatus([token]);
      expect(processingStatusAfter).to.equal(2);

      // Check user one balance after processing
      const userOneBalanceAfter = await publicClient.getBalance({
        address: userOne.account.address,
      });
      expect(userOneBalanceAfter - userOneBalanceBefore).to.be.equal(
        parseEther("1")
      );
    });

    it("Should process an invalid answer", async function () {
      const {
        deployer,
        userOne,
        userTwo,
        questionContract,
        questionManagerContract,
      } = await loadFixture(initFixture);

      await askQuestion(
        userOne.account,
        userTwo.account,
        parseEther("1"),
        getAskMetadataValue(),
        questionManagerContract.address
      );

      const token = await getFirstToken(
        userOne.account,
        questionContract.address
      );

      await answerQuestion(
        userOne.account,
        token,
        getAnswerMetadataValue(),
        questionManagerContract.address
      );

      // Process an invalid answer
      await expect(
        processInvalidAnswer(
          deployer.account,
          token,
          questionManagerContract.address
        )
      ).to.not.rejected;

      // Check processing status after processing
      const processingStatusAfter =
        await questionManagerContract.read.getProcessingStatus([token]);
      expect(processingStatusAfter).to.equal(1);
    });
  });

  describe("Cancellation", function () {
    it("Should cancel a question", async function () {
      const { userOne, userTwo, questionContract, questionManagerContract } =
        await loadFixture(initFixture);

      await askQuestion(
        userOne.account,
        userTwo.account,
        parseEther("1"),
        getAskMetadataValue(),
        questionManagerContract.address
      );

      const token = await getFirstToken(
        userOne.account,
        questionContract.address
      );

      // Cancel question
      await expect(
        cancelQuestion(userTwo.account, token, questionManagerContract.address)
      ).to.not.rejected;

      // Check question data
      const asker = await questionManagerContract.read.getAsker([token]);
      const reward = await questionManagerContract.read.getReward([token]);
      const processingStatus =
        await questionManagerContract.read.getProcessingStatus([token]);
      expect(asker).to.equal(zeroAddress);
      expect(reward).to.equal(0n);
      expect(processingStatus).to.equal(0);

      // Try to get token
      try {
        await questionContract.read.tokenOwnerOf([token]);
        expect.fail("Expected an error when checking burned token");
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe("Ownership", function () {
    it("Should transfer question ownership", async function () {
      const { deployer, userOne, questionContract, questionManagerContract } =
        await loadFixture(initFixture);

      // Check that the Question contract is owned by the QuestionManager
      const initialOwner = await questionContract.read.owner();
      expect(initialOwner.toLowerCase()).to.equal(
        questionManagerContract.address.toLowerCase()
      );

      // Call the function on the question manager to transfer question ownership
      await questionManagerContract.write.transferQuestionOwnership(
        [userOne.account.address],
        {
          account: deployer.account,
        }
      );

      // Verify that userOne is now the owner of the Question contract
      const newOwner = await questionContract.read.owner();
      expect(newOwner.toLowerCase()).to.equal(
        userOne.account.address.toLowerCase()
      );

      // Attempt to transfer ownership with a non-owner account (should fail)
      try {
        await questionManagerContract.write.transferQuestionOwnership(
          [deployer.account.address],
          {
            account: userOne.account,
          }
        );
        expect.fail(
          "Expected an error when non-owner tries to transfer ownership"
        );
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });
});
