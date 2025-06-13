import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { parseEther, zeroAddress } from "viem";
import { getAnswerMetadataValue, getAskMetadataValue } from "./utils/metadata";

describe("QuestionManager", function () {
  async function initFixture() {
    // Get public client
    const publicClient = await hre.viem.getPublicClient();

    // Get signers
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

  it("Should ask, answer a question and process a valid answer", async function () {
    const {
      publicClient,
      deployer,
      userOne,
      userTwo,
      questionContract,
      questionManagerContract,
    } = await loadFixture(initFixture);

    // Ask question by user two
    await questionManagerContract.write.ask(
      [userOne.account.address, getAskMetadataValue()],
      {
        account: userTwo.account,
        value: parseEther("1"),
      }
    );

    // Get question token
    const tokens = await questionContract.read.tokenIdsOf([
      userOne.account.address,
    ]);
    const token = tokens[0];

    // Answer question by user one
    await questionManagerContract.write.answer(
      [token, getAnswerMetadataValue()],
      {
        account: userOne.account,
      }
    );

    // Check user one balance before processing
    const userOneBalanceBefore = await publicClient.getBalance({
      address: userOne.account.address,
    });

    // Process a valid answer by deployer
    await questionManagerContract.write.processValidAnswer([token], {
      account: deployer.account,
    });

    // Check processing status after processing (should be set to 2, AnswerValidRewardSent)
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

  it("Should ask, answer a question without a value and process a valid answer", async function () {
    const {
      publicClient,
      deployer,
      userOne,
      userTwo,
      questionContract,
      questionManagerContract,
    } = await loadFixture(initFixture);

    // Ask question by user two with zero value
    await questionManagerContract.write.ask(
      [userOne.account.address, getAskMetadataValue()],
      {
        account: userTwo.account,
      }
    );

    // Get question token
    const tokens = await questionContract.read.tokenIdsOf([
      userOne.account.address,
    ]);
    const token = tokens[0];

    // Answer question by user one
    await questionManagerContract.write.answer(
      [token, getAnswerMetadataValue()],
      {
        account: userOne.account,
      }
    );

    // Check user one balance before processing (should stay the same after processing since no value)
    const userOneBalanceBefore = await publicClient.getBalance({
      address: userOne.account.address,
    });

    // Process a valid answer by deployer
    await questionManagerContract.write.processValidAnswer([token], {
      account: deployer.account,
    });

    // Check processing status after processing (should be set to 2, AnswerValidRewardSent)
    const processingStatusAfterProcessing =
      await questionManagerContract.read.getProcessingStatus([token]);
    expect(processingStatusAfterProcessing).to.equal(2);

    // Check user one balance after processing
    const userOneBalanceAfter = await publicClient.getBalance({
      address: userOne.account.address,
    });

    // Balance should stay the same
    const balanceDifference = userOneBalanceAfter - userOneBalanceBefore;
    expect(balanceDifference).to.equal(0n);
  });

  it("Should ask and cancel a question", async function () {
    const { userOne, userTwo, questionContract, questionManagerContract } =
      await loadFixture(initFixture);

    // Ask question by user two
    const questionValue = parseEther("1");
    await questionManagerContract.write.ask(
      [userOne.account.address, getAskMetadataValue()],
      {
        account: userTwo.account,
        value: questionValue,
      }
    );

    // Get question token
    const tokens = await questionContract.read.tokenIdsOf([
      userOne.account.address,
    ]);
    const token = tokens[0];

    // Cancel question
    await questionManagerContract.write.cancel([token], {
      account: userTwo.account,
    });

    // Check question data
    expect(await questionManagerContract.read.getAsker([token])).to.equal(
      zeroAddress
    );
    expect(await questionManagerContract.read.getReward([token])).to.equal(0n);
    expect(
      await questionManagerContract.read.getProcessingStatus([token])
    ).to.equal(0);

    // Try to get token (should fail because it was burned)
    try {
      await questionContract.read.tokenOwnerOf([token]);
      expect.fail("Expected an error when checking burned token");
    } catch (error) {
      expect(error).to.exist;
    }
  });

  it("Should ask, answer a question and process an invalid answer", async function () {
    const {
      deployer,
      userOne,
      userTwo,
      questionContract,
      questionManagerContract,
    } = await loadFixture(initFixture);

    // Ask question by user two
    await questionManagerContract.write.ask(
      [userOne.account.address, getAskMetadataValue()],
      {
        account: userTwo.account,
        value: parseEther("1"),
      }
    );

    // Get question token
    const tokens = await questionContract.read.tokenIdsOf([
      userOne.account.address,
    ]);
    const token = tokens[0];

    // Answer question by user one
    await questionManagerContract.write.answer(
      [token, getAnswerMetadataValue()],
      {
        account: userOne.account,
      }
    );

    // Process an invalid answer by deployer
    await questionManagerContract.write.processInvalidAnswer([token], {
      account: deployer.account,
    });

    // Check processing status after negative processing
    const processingStatusAfterProcessing =
      await questionManagerContract.read.getProcessingStatus([token]);
    expect(processingStatusAfterProcessing).to.equal(1);
  });

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
