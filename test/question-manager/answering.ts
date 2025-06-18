import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import {
  fixtureWithAnsweredQuestion,
  fixtureWithAskedQuestion,
} from "../fixtures/question-manager";
import {
  getAnswerMetadataValueOne,
  getAnswerMetadataValueTwo,
} from "../utils/metadata";

describe("QuestionManager: Answering", function () {
  it("Should answer", async function () {
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

    const metadata = getAnswerMetadataValueOne();

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

  it("Should answer if question answered and not processed", async function () {
    const { answerer, questionManagerContract, token } = await loadFixture(
      fixtureWithAnsweredQuestion
    );

    // Verify the current processing status is None
    const processingStatusBefore =
      await questionManagerContract.read.getProcessingStatus([token]);
    expect(processingStatusBefore).to.equal(0); // None

    // Get the original answer
    const originalAnswer = await questionManagerContract.read.getAnswer([
      token,
    ]);

    // Answer the question again with a different metadata
    const newMetadata = getAnswerMetadataValueTwo();

    await expect(
      questionManagerContract.write.answer([token, newMetadata], {
        account: answerer.account,
      })
    ).to.not.rejected;

    // Verify the answer metadata is updated
    const updatedAnswer = await questionManagerContract.read.getAnswer([token]);
    expect(updatedAnswer).to.equal(newMetadata);
    expect(updatedAnswer).to.not.equal(originalAnswer);

    // Processing status should still be None after answering again
    const processingStatusAfter =
      await questionManagerContract.read.getProcessingStatus([token]);
    expect(processingStatusAfter).to.equal(0); // Still None
  });

  it("Should answer if question processed as answer invalid", async function () {
    const { answerer, deployer, questionManagerContract, token } =
      await loadFixture(fixtureWithAnsweredQuestion);

    // First, process the answer as invalid
    await questionManagerContract.write.processInvalidAnswer([token], {
      account: deployer.account,
    });

    // Verify the processing status is AnswerInvalid (1)
    const processingStatusBefore =
      await questionManagerContract.read.getProcessingStatus([token]);
    expect(processingStatusBefore).to.equal(1); // AnswerInvalid

    // Get the original answer
    const originalAnswer = await questionManagerContract.read.getAnswer([
      token,
    ]);

    // Provide a new answer after the question has been processed as invalid
    const newMetadata = getAnswerMetadataValueTwo();

    // Should be able to answer again
    await expect(
      questionManagerContract.write.answer([token, newMetadata], {
        account: answerer.account,
      })
    ).to.not.rejected;

    // Verify the answer was updated
    const updatedAnswer = await questionManagerContract.read.getAnswer([token]);
    expect(updatedAnswer).to.equal(newMetadata);
    expect(updatedAnswer).to.not.equal(originalAnswer);

    // The processing status should be reset to None (0) after answering again
    const processingStatusAfter =
      await questionManagerContract.read.getProcessingStatus([token]);
    expect(processingStatusAfter).to.equal(0); // Reset to None
  });

  it("Should fail if answering question processed as answer valid and reward sent", async function () {
    const { answerer, deployer, questionManagerContract, token } =
      await loadFixture(fixtureWithAnsweredQuestion);

    // Process the answer as valid
    await questionManagerContract.write.processValidAnswer([token], {
      account: deployer.account,
    });

    // Try to answer again after processing
    await expect(
      questionManagerContract.write.answer(
        [token, getAnswerMetadataValueOne()],
        {
          account: answerer.account,
        }
      )
    ).to.rejectedWith("Question processing status is 'AnswerValidRewardSent'");
  });

  it("Should fail if answering by not answerer", async function () {
    const { asker, questionManagerContract, token } = await loadFixture(
      fixtureWithAskedQuestion
    );

    await expect(
      questionManagerContract.write.answer(
        [token, getAnswerMetadataValueOne()],
        {
          account: asker.account,
        }
      )
    ).to.rejectedWith("Caller is not the answerer");
  });

  it("Should fail if answering a cancelled question", async function () {
    const { answerer, asker, questionManagerContract, token } =
      await loadFixture(fixtureWithAskedQuestion);

    // Cancel the question first
    await questionManagerContract.write.cancel([token], {
      account: asker.account,
    });

    // Try to answer the cancelled question
    await expect(
      questionManagerContract.write.answer(
        [token, getAnswerMetadataValueOne()],
        {
          account: answerer.account,
        }
      )
    ).to.rejectedWith(`LSP8NonExistentTokenId("${token}")`);
  });
});
