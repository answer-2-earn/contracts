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

    // Answer question by user one
    await questionManagerContract.write.answer(
      [token, getAnswerMetadataValue()],
      {
        account: userOne.account,
      }
    );

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

    // Check user one balance before verifying (should stay the same after verification since no value)
    const userOneBalanceBefore = await publicClient.getBalance({
      address: userOne.account.address,
    });

    // Verify question by deployer
    await questionManagerContract.write.verify([token, true], {
      account: deployer.account,
    });

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
});
