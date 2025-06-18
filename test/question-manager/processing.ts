import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import { parseEther } from "viem";
import {
  fixtureWithAnsweredQuestion,
  fixtureWithAnsweredZeroRewardQuestion,
  fixtureWithAskedQuestion,
} from "../fixtures/question-manager";

describe("QuestionManager: Processing", function () {
  it("Should process a valid answer", async function () {
    const { publicClient, deployer, answerer, questionManagerContract, token } =
      await loadFixture(fixtureWithAnsweredQuestion);

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

  it("Should process a valid answer for a question without a reward", async function () {
    const { publicClient, deployer, answerer, questionManagerContract, token } =
      await loadFixture(fixtureWithAnsweredZeroRewardQuestion);

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
      parseEther("0")
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

  it("Should fail if processing by not validator", async function () {
    const { answerer, questionManagerContract, token } = await loadFixture(
      fixtureWithAnsweredQuestion
    );

    // Try to process as a non-validator
    await expect(
      questionManagerContract.write.processValidAnswer([token], {
        account: answerer.account,
      })
    ).to.be.rejected;

    // Try to process invalid answer as a non-validator
    await expect(
      questionManagerContract.write.processInvalidAnswer([token], {
        account: answerer.account,
      })
    ).to.be.rejected;
  });

  it("Should fail if processing a non-answered question", async function () {
    const { deployer, questionManagerContract, token } = await loadFixture(
      fixtureWithAskedQuestion
    );

    // Attempt to process a question that hasn't been answered yet
    await expect(
      questionManagerContract.write.processValidAnswer([token], {
        account: deployer.account,
      })
    ).to.be.rejectedWith("Question not answered");

    // Also try to process as invalid
    await expect(
      questionManagerContract.write.processInvalidAnswer([token], {
        account: deployer.account,
      })
    ).to.be.rejectedWith("Question not answered");
  });

  it("Should fail if processing a question processed as answer valid and reward sent", async function () {
    const { deployer, questionManagerContract, token } = await loadFixture(
      fixtureWithAnsweredQuestion
    );

    // First process the answer as valid
    await questionManagerContract.write.processValidAnswer([token], {
      account: deployer.account,
    });

    // Now try to process it again
    await expect(
      questionManagerContract.write.processValidAnswer([token], {
        account: deployer.account,
      })
    ).to.be.rejected;

    // Also try to mark it as invalid after it was marked valid
    await expect(
      questionManagerContract.write.processInvalidAnswer([token], {
        account: deployer.account,
      })
    ).to.be.rejected;
  });
});
