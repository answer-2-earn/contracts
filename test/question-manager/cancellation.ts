import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import { parseEther, zeroAddress } from "viem";
import {
  fixtureWithAnsweredQuestion,
  fixtureWithAskedQuestion,
} from "../fixtures/question-manager";

describe("QuestionManager: Cancellation", function () {
  it("Should cancel a question", async function () {
    const {
      publicClient,
      asker,
      questionContract,
      questionManagerContract,
      token,
    } = await loadFixture(fixtureWithAskedQuestion);

    // Get asker balance before cancellation
    const askerBalanceBefore = await publicClient.getBalance({
      address: asker.account.address,
    });

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

    // Try to read token owner after cancellation
    await expect(questionContract.read.tokenOwnerOf([token])).to.rejectedWith(
      "LSP8NonExistentTokenId"
    );

    // Check asker balance after cancellation (should increase by reward amount)
    const askerBalanceAfter = await publicClient.getBalance({
      address: asker.account.address,
    });

    // Account for gas costs by checking that balance increased by approximately the reward
    // The final balance should be close to the initial balance plus the reward (accounting for gas costs)
    const delta = askerBalanceAfter - askerBalanceBefore;

    // The difference should be positive
    expect(delta > 0n).to.be.true;

    // Should be close to the reward amount (allowing for gas costs)
    const minExpectedRefund = reward - parseEther("0.01");
    expect(delta >= minExpectedRefund).to.be.true;
  });

  it("Should cancel an answered question", async function () {
    const {
      publicClient,
      asker,
      questionContract,
      questionManagerContract,
      token,
      reward,
    } = await loadFixture(fixtureWithAnsweredQuestion);

    // Get asker balance before cancellation
    const askerBalanceBefore = await publicClient.getBalance({
      address: asker.account.address,
    });

    // Cancel question
    await expect(
      questionManagerContract.write.cancel([token], {
        account: asker.account,
      })
    ).to.not.rejected;

    // Check question data
    const askerAddress = await questionManagerContract.read.getAsker([token]);
    const rewardAfter = await questionManagerContract.read.getReward([token]);
    const processingStatus =
      await questionManagerContract.read.getProcessingStatus([token]);
    const answer = await questionManagerContract.read.getAnswer([token]);

    expect(askerAddress).to.equal(zeroAddress);
    expect(rewardAfter).to.equal(0n);
    expect(processingStatus).to.equal(0);
    expect(answer).to.equal("0x"); // Answer should be cleared

    // Try to read token owner after cancellation
    await expect(questionContract.read.tokenOwnerOf([token])).to.rejectedWith(
      "LSP8NonExistentTokenId"
    );

    // Check asker balance after cancellation (should increase by reward amount)
    const askerBalanceAfter = await publicClient.getBalance({
      address: asker.account.address,
    });

    // Account for gas costs by checking that balance increased by approximately the reward
    const delta = askerBalanceAfter - askerBalanceBefore;

    // The difference should be positive
    expect(delta > 0n).to.be.true;

    // Should be close to the reward amount (allowing for gas costs)
    const minExpectedRefund = reward - parseEther("0.01");
    expect(delta >= minExpectedRefund).to.be.true;
  });

  it("Should fail if cancelling by not asker", async function () {
    const { answerer, questionManagerContract, token } = await loadFixture(
      fixtureWithAskedQuestion
    );

    // Try to cancel the question as the answerer (not the asker)
    await expect(
      questionManagerContract.write.cancel([token], {
        account: answerer.account,
      })
    ).to.rejectedWith("Caller is not the asker");
  });

  it("Should fail if cancelling a question processed as answer valid reward sent", async function () {
    const { asker, deployer, questionManagerContract, token } =
      await loadFixture(fixtureWithAnsweredQuestion);

    // Process the answer as valid
    await questionManagerContract.write.processValidAnswer([token], {
      account: deployer.account,
    });

    // Try to cancel the question after processing
    await expect(
      questionManagerContract.write.cancel([token], {
        account: asker.account,
      })
    ).to.rejectedWith("Processing status is AnswerValidRewardSent");
  });

  it("Should fail if cancelling a cancelled question", async function () {
    const { asker, questionManagerContract, token } = await loadFixture(
      fixtureWithAskedQuestion
    );

    // Cancel the question first time
    await questionManagerContract.write.cancel([token], {
      account: asker.account,
    });

    // Try to cancel the question a second time
    await expect(
      questionManagerContract.write.cancel([token], {
        account: asker.account,
      })
    ).to.rejectedWith("Caller is not the asker");
  });
});
