import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { parseEther, zeroAddress } from "viem";
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

  async function fixtureWithAskedQuestion() {
    const {
      publicClient,
      deployer,
      userOne,
      userTwo,
      questionContract,
      questionManagerContract,
    } = await loadFixture(initFixture);

    const answerer = userOne;
    const asker = userTwo;
    const reward = parseEther("1");

    await questionManagerContract.write.ask(
      [answerer.account.address, getAskMetadataValue()],
      {
        account: asker.account,
        value: reward,
      }
    );

    const tokens = await questionContract.read.tokenIdsOf([
      userOne.account.address,
    ]);
    const token = tokens[0];

    return {
      publicClient,
      deployer,
      answerer,
      asker,
      questionContract,
      questionManagerContract,
      token,
      reward,
    };
  }

  async function fixtureWithAnsweredQuestion() {
    const {
      publicClient,
      deployer,
      answerer,
      asker,
      questionContract,
      questionManagerContract,
      token,
      reward,
    } = await loadFixture(fixtureWithAskedQuestion);

    await questionManagerContract.write.answer(
      [token, getAnswerMetadataValue()],
      {
        account: answerer.account,
      }
    );

    return {
      publicClient,
      deployer,
      answerer,
      asker,
      questionContract,
      questionManagerContract,
      token,
      reward,
    };
  }
  describe("Asking", function () {
    it("Should ask a question with a reward", async function () {
      const {
        publicClient,
        userOne,
        userTwo,
        questionContract,
        questionManagerContract,
      } = await loadFixture(initFixture);

      const metadata = getAskMetadataValue();
      const reward = parseEther("1");

      // Get contract balance before asking
      const contractBalanceBefore = await publicClient.getBalance({
        address: questionManagerContract.address,
      });

      // Ask question with reward
      await questionManagerContract.write.ask(
        [userOne.account.address, metadata],
        {
          account: userTwo.account,
          value: reward,
        }
      );

      // Get token ID
      const tokens = await questionContract.read.tokenIdsOf([
        userOne.account.address,
      ]);
      const token = tokens[0];

      // Verify token is minted to answerer
      const tokenOwner = await questionContract.read.tokenOwnerOf([token]);
      expect(tokenOwner.toLowerCase()).to.equal(
        userOne.account.address.toLowerCase()
      );

      // Verify question data is correctly stored
      const storedAsker = await questionManagerContract.read.getAsker([token]);
      const storedReward = await questionManagerContract.read.getReward([
        token,
      ]);
      expect(storedAsker.toLowerCase()).to.equal(
        userTwo.account.address.toLowerCase()
      );
      expect(storedReward).to.equal(reward);

      // Verify contract balance has increased by reward amount
      const contractBalanceAfter = await publicClient.getBalance({
        address: questionManagerContract.address,
      });
      expect(contractBalanceAfter - contractBalanceBefore).to.equal(reward);
    });

    it("Should ask a question without a reward", async function () {
      const {
        publicClient,
        userOne,
        userTwo,
        questionContract,
        questionManagerContract,
      } = await loadFixture(initFixture);

      const metadata = getAskMetadataValue();

      // Get contract balance before asking
      const contractBalanceBefore = await publicClient.getBalance({
        address: questionManagerContract.address,
      });

      // Ask question without reward
      await questionManagerContract.write.ask(
        [userOne.account.address, metadata],
        {
          account: userTwo.account,
        }
      );

      // Get token ID
      const tokens = await questionContract.read.tokenIdsOf([
        userOne.account.address,
      ]);
      const token = tokens[0];

      // Verify token is minted to answerer
      const tokenOwner = await questionContract.read.tokenOwnerOf([token]);
      expect(tokenOwner.toLowerCase()).to.equal(
        userOne.account.address.toLowerCase()
      );

      // Verify question data is correctly stored
      const storedAsker = await questionManagerContract.read.getAsker([token]);
      const storedReward = await questionManagerContract.read.getReward([
        token,
      ]);
      expect(storedAsker.toLowerCase()).to.equal(
        userTwo.account.address.toLowerCase()
      );
      expect(storedReward).to.equal(0n);

      // Verify contract balance hasn't changed
      const contractBalanceAfter = await publicClient.getBalance({
        address: questionManagerContract.address,
      });
      expect(contractBalanceAfter).to.equal(contractBalanceBefore);
    });

    it("Should fail if a question asked to yourself", async function () {
      const { userOne, questionManagerContract } = await loadFixture(
        initFixture
      );

      await expect(
        questionManagerContract.write.ask(
          [userOne.account.address, getAskMetadataValue()],
          {
            account: userOne.account,
          }
        )
      ).to.rejectedWith("Answerer cannot ask yourself");
    });
  });

  describe("Answering", function () {
    it("Should answer a question by answerer", async function () {
      const { answerer, questionManagerContract, token } = await loadFixture(
        fixtureWithAskedQuestion
      );

      await expect(
        questionManagerContract.write.answer(
          [token, getAnswerMetadataValue()],
          {
            account: answerer.account,
          }
        )
      ).to.not.rejected;
    });

    it("Should fail if a question answered by not answerer", async function () {
      const { asker, questionManagerContract, token } = await loadFixture(
        fixtureWithAskedQuestion
      );

      await expect(
        questionManagerContract.write.answer(
          [token, getAnswerMetadataValue()],
          {
            account: asker.account,
          }
        )
      ).to.rejectedWith("Caller is not the answerer");
    });
  });

  describe("Processing", function () {
    it("Should process a valid answer", async function () {
      const {
        publicClient,
        deployer,
        answerer,
        questionManagerContract,
        token,
      } = await loadFixture(fixtureWithAnsweredQuestion);

      // Get answerer balance before processing
      const answererBalanceBefore = await publicClient.getBalance({
        address: answerer.account.address,
      });

      // Process a valid answer
      await expect(
        questionManagerContract.write.processValidAnswer([token], {
          account: deployer.account,
        })
      ).to.not.rejected;

      // Check processing status after processing
      const processingStatusAfter =
        await questionManagerContract.read.getProcessingStatus([token]);
      expect(processingStatusAfter).to.equal(2);

      // Check answerer balance after processing
      const answererBalanceAfter = await publicClient.getBalance({
        address: answerer.account.address,
      });
      expect(answererBalanceAfter - answererBalanceBefore).to.be.equal(
        parseEther("1")
      );
    });

    it("Should process an invalid answer", async function () {
      const { deployer, questionManagerContract, token } = await loadFixture(
        fixtureWithAnsweredQuestion
      );

      // Process an invalid answer
      await expect(
        questionManagerContract.write.processInvalidAnswer([token], {
          account: deployer.account,
        })
      ).to.not.rejected;

      // Check processing status after processing
      const processingStatusAfter =
        await questionManagerContract.read.getProcessingStatus([token]);
      expect(processingStatusAfter).to.equal(1);
    });
  });

  describe("Cancellation", function () {
    it("Should cancel a question", async function () {
      const { asker, questionContract, questionManagerContract, token } =
        await loadFixture(fixtureWithAskedQuestion);

      // Cancel question
      await expect(
        questionManagerContract.write.cancel([token], {
          account: asker.account,
        })
      ).to.not.rejected;

      // Check question data
      const askerAddress = await questionManagerContract.read.getAsker([token]);
      const reward = await questionManagerContract.read.getReward([token]);
      const processingStatus =
        await questionManagerContract.read.getProcessingStatus([token]);
      expect(askerAddress).to.equal(zeroAddress);
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
