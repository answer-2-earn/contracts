import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import {
  fixtureWithAnsweredQuestion,
  fixtureWithAskedQuestion,
} from "../fixtures/question-manager";
import { getAnswerMetadataValue } from "../utils/metadata";

describe("QuestionManager: Answering", function () {
  it("Should answer by answerer", async function () {
    const { answerer, questionManagerContract, token } = await loadFixture(
      fixtureWithAskedQuestion
    );

    // Check processing status before answering
    const processingStatusBefore =
      await questionManagerContract.read.getProcessingStatus([token]);
    expect(processingStatusBefore).to.equal(0); // Should be None initially

    // No answer data before answering
    const answerBefore = await questionManagerContract.read.getAnswer([token]);
    expect(answerBefore).to.equal("0x"); // Empty bytes

    const metadata = getAnswerMetadataValue();

    // Answer the question
    await expect(
      questionManagerContract.write.answer([token, metadata], {
        account: answerer.account,
      })
    ).to.not.rejected;

    // Verify the answer metadata is correctly stored
    const storedAnswer = await questionManagerContract.read.getAnswer([token]);
    expect(storedAnswer).to.equal(metadata);

    // Processing status should still be None after answering (until processed)
    const processingStatusAfter =
      await questionManagerContract.read.getProcessingStatus([token]);
    expect(processingStatusAfter).to.equal(0); // Still None until processed
  });

  it("Should fail when answering by not answerer", async function () {
    const { asker, questionManagerContract, token } = await loadFixture(
      fixtureWithAskedQuestion
    );

    await expect(
      questionManagerContract.write.answer([token, getAnswerMetadataValue()], {
        account: asker.account,
      })
    ).to.rejectedWith("Caller is not the answerer");
  });

  it("Should fail when answering a cancelled question", async function () {
    const { answerer, asker, questionManagerContract, token } =
      await loadFixture(fixtureWithAskedQuestion);

    // Cancel the question first
    await questionManagerContract.write.cancel([token], {
      account: asker.account,
    });

    // Try to answer the cancelled question
    await expect(
      questionManagerContract.write.answer([token, getAnswerMetadataValue()], {
        account: answerer.account,
      })
    ).to.rejectedWith(`LSP8NonExistentTokenId("${token}")`);
  });

  it("Should fail when answering a processed question", async function () {
    const { answerer, deployer, questionManagerContract, token } =
      await loadFixture(fixtureWithAnsweredQuestion);

    // Process the answer as valid
    await questionManagerContract.write.processValidAnswer([token], {
      account: deployer.account,
    });

    // Try to answer again after processing
    await expect(
      questionManagerContract.write.answer([token, getAnswerMetadataValue()], {
        account: answerer.account,
      })
    ).to.rejectedWith("Processing status is AnswerValidRewardSent");
  });
});
