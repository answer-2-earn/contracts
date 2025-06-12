import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";
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

  it("Should ask, answer and verify a question", async function () {
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

    // Check verification status after asking (should be initial state)
    const verificationBeforeAnswer =
      await questionManagerContract.read.getVerification([token]);
    expect(verificationBeforeAnswer.verified).to.equal(false);
    expect(verificationBeforeAnswer.status).to.equal(false);

    // Answer question by user one
    await questionManagerContract.write.answer(
      [token, getAnswerMetadataValue()],
      {
        account: userOne.account,
      }
    );

    // Check verification status after answering (should be reset)
    const verificationAfterAnswer =
      await questionManagerContract.read.getVerification([token]);
    expect(verificationAfterAnswer.verified).to.equal(false);
    expect(verificationAfterAnswer.status).to.equal(false);

    // Check user one balance before verifying
    const userOneBalanceBefore = await publicClient.getBalance({
      address: userOne.account.address,
    });

    // Check reward before verifying
    const rewardBefore = await questionManagerContract.read.getReward([token]);
    expect(rewardBefore.value).to.equal(parseEther("1"));
    expect(rewardBefore.sent).to.equal(false);

    // Verify question by deployer
    await questionManagerContract.write.verify([token, true], {
      account: deployer.account,
    });

    // Check verification status after verifying (should be set to verified and true)
    const verificationAfterVerify =
      await questionManagerContract.read.getVerification([token]);
    expect(verificationAfterVerify.verified).to.equal(true);
    expect(verificationAfterVerify.status).to.equal(true);

    // Check user one balance after verifying
    const userOneBalanceAfter = await publicClient.getBalance({
      address: userOne.account.address,
    });
    expect(userOneBalanceAfter - userOneBalanceBefore).to.be.equal(
      parseEther("1")
    );

    // Check reward after verifying
    const rewardAfter = await questionManagerContract.read.getReward([token]);
    expect(rewardAfter.value).to.equal(parseEther("1"));
    expect(rewardAfter.sent).to.equal(true);
  });

  it("Should ask, answer and verify a question without value", async function () {
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

    // Check verification status after asking (should be initial state)
    const verificationBeforeAnswer =
      await questionManagerContract.read.getVerification([token]);
    expect(verificationBeforeAnswer.verified).to.equal(false);
    expect(verificationBeforeAnswer.status).to.equal(false);

    // Check reward after asking
    const rewardAfterAsking = await questionManagerContract.read.getReward([
      token,
    ]);
    expect(rewardAfterAsking.value).to.equal(0n);
    expect(rewardAfterAsking.sent).to.equal(false);

    // Check asker is correct
    const asker = await questionManagerContract.read.getAsker([token]);
    expect(asker.toLowerCase()).to.equal(userTwo.account.address.toLowerCase());

    // Answer question by user one
    await questionManagerContract.write.answer(
      [token, getAnswerMetadataValue()],
      {
        account: userOne.account,
      }
    );

    // Check verification status after answering (should be reset)
    const verificationAfterAnswer =
      await questionManagerContract.read.getVerification([token]);
    expect(verificationAfterAnswer.verified).to.equal(false);
    expect(verificationAfterAnswer.status).to.equal(false);

    // Check user one balance before verifying (should stay the same after verification since no value)
    const userOneBalanceBefore = await publicClient.getBalance({
      address: userOne.account.address,
    });

    // Verify question by deployer
    await questionManagerContract.write.verify([token, true], {
      account: deployer.account,
    });

    // Check verification status after verifying (should be set to verified and true)
    const verificationAfterVerify =
      await questionManagerContract.read.getVerification([token]);
    expect(verificationAfterVerify.verified).to.equal(true);
    expect(verificationAfterVerify.status).to.equal(true);

    // Check user one balance after verifying
    const userOneBalanceAfter = await publicClient.getBalance({
      address: userOne.account.address,
    });

    // Balance should stay approximately the same (might be slightly different due to gas costs)
    const balanceDifference = userOneBalanceAfter - userOneBalanceBefore;
    expect(balanceDifference).to.equal(0n);

    // Check reward after verifying
    const rewardAfter = await questionManagerContract.read.getReward([token]);
    expect(rewardAfter.value).to.equal(0n);
    expect(rewardAfter.sent).to.equal(true);
  });

  it("Should ask and cancel a question", async function () {
    const {
      publicClient,
      userOne,
      userTwo,
      questionContract,
      questionManagerContract,
    } = await loadFixture(initFixture);

    // Get user balance before asking
    const userTwoBalanceBefore = await publicClient.getBalance({
      address: userTwo.account.address,
    });

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

    // Check verification status after asking (should be initial state)
    const verificationAfterAsking =
      await questionManagerContract.read.getVerification([token]);
    expect(verificationAfterAsking.verified).to.equal(false);
    expect(verificationAfterAsking.status).to.equal(false);

    // Check reward after asking
    const rewardAfterAsking = await questionManagerContract.read.getReward([
      token,
    ]);
    expect(rewardAfterAsking.value).to.equal(questionValue);
    expect(rewardAfterAsking.sent).to.equal(false);

    // Check asker is correct
    const asker = await questionManagerContract.read.getAsker([token]);
    expect(asker.toLowerCase()).to.equal(userTwo.account.address.toLowerCase());

    // Get user balance after asking
    const userTwoBalanceAfterAsking = await publicClient.getBalance({
      address: userTwo.account.address,
    });

    // Verify that the user's balance decreased by at least the question value
    expect(
      Number(userTwoBalanceBefore - userTwoBalanceAfterAsking)
    ).to.be.at.least(Number(questionValue));

    // Cancel the question
    await questionManagerContract.write.cancel([token], {
      account: userTwo.account,
    });

    // Check reward after cancellation
    const rewardAfterCancellation =
      await questionManagerContract.read.getReward([token]);
    expect(rewardAfterCancellation.value).to.equal(questionValue);
    expect(rewardAfterCancellation.sent).to.equal(true);

    // Get user balance after cancellation
    const userTwoBalanceAfterCancellation = await publicClient.getBalance({
      address: userTwo.account.address,
    });

    // Verify that the user's balance increased after cancellation
    // Note: It won't be exactly the question value due to gas costs
    const balanceIncrease =
      userTwoBalanceAfterCancellation - userTwoBalanceAfterAsking;
    const allowableDifference = parseEther("0.01");
    expect(
      balanceIncrease >= questionValue - allowableDifference &&
        balanceIncrease <= questionValue + allowableDifference
    ).to.be.true;

    // Try to get token - should fail because it was burned
    try {
      await questionContract.read.tokenOwnerOf([token]);
      expect.fail("Expected an error when checking burned token");
    } catch (error) {
      // Error is expected as the token should be burned
      expect(error).to.exist;
    }
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
      // Error is expected as only the owner should be able to transfer ownership
      expect(error).to.exist;
    }
  });

  it("Should ask, answer and verify a question with negative verification", async function () {
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

    // Check reward before verifying
    const rewardBefore = await questionManagerContract.read.getReward([token]);
    expect(rewardBefore.value).to.equal(parseEther("1"));
    expect(rewardBefore.sent).to.equal(false);

    // Verify question by deployer with FALSE status
    await questionManagerContract.write.verify([token, false], {
      account: deployer.account,
    });

    // Check verification status after negative verification
    const verificationAfterVerify =
      await questionManagerContract.read.getVerification([token]);
    expect(verificationAfterVerify.verified).to.equal(true);
    expect(verificationAfterVerify.status).to.equal(false);

    // Check reward after negative verification (should NOT be sent)
    const rewardAfter = await questionManagerContract.read.getReward([token]);
    expect(rewardAfter.value).to.equal(parseEther("1"));
    expect(rewardAfter.sent).to.equal(false);
  });
});
