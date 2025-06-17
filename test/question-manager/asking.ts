import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import { parseEther } from "viem";
import { initFixture } from "../fixtures/question-manager";
import { getAskMetadataValue } from "../utils/metadata";

describe("QuestionManager: Asking", function () {
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
    const storedReward = await questionManagerContract.read.getReward([token]);
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
    const storedReward = await questionManagerContract.read.getReward([token]);
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

  it("Should fail when asking a question to yourself", async function () {
    const { userOne, questionManagerContract } = await loadFixture(initFixture);

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
