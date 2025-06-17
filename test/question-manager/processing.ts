import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import { parseEther } from "viem";
import { fixtureWithAnsweredQuestion } from "../fixtures/question-manager";

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
