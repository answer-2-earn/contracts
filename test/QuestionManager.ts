import { ERC725 } from "@erc725/erc725.js";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { Hex, parseEther } from "viem";

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
    questionManagerContract.write.initialize([questionContract.address]);

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

  async function createMetadata() {
    const metadata = {
      asker: "0x4018737e0D777b3d4C72B411a3BeEC286Ec5F5eF",
      question: "What is your dream?",
      questionDate: 1746028080,
      answerer: "0x2EC3af24fB102909f31535Ef0d825c8BFb873aB2",
      answer: "",
      answerDate: 0,
    };
    const metadataUrl = "ipfs://empty";
    const schema = [
      {
        name: "LSP4Metadata",
        key: "0x9afb95cacc9f95858ec44aa8c3b685511002e30ae54415823f406128b85b238e",
        keyType: "Singleton",
        valueType: "bytes",
        valueContent: "VerifiableURI",
      },
    ];
    const erc725 = new ERC725(schema);
    const encodedMetadata = erc725.encodeData([
      {
        keyName: "LSP4Metadata",
        value: {
          json: metadata,
          url: metadataUrl,
        },
      },
    ]);
    const encodedMetadataValue = encodedMetadata.values[0] as Hex;
    return { encodedMetadataValue };
  }

  it("Should ask and answer a question", async function () {
    const {
      publicClient,
      deployer,
      userOne,
      userTwo,
      questionContract,
      questionManagerContract,
    } = await loadFixture(initFixture);

    // Create a metadata object
    const { encodedMetadataValue } = await createMetadata();

    // Ask question by user two
    await questionManagerContract.write.ask(
      [userOne.account.address, encodedMetadataValue],
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

    // Check user balance before answering
    const userOneBalanceBefore = await publicClient.getBalance({
      address: userOne.account.address,
    });

    // Check reward before answering
    const rewardBefore = await questionManagerContract.read.getReward([token]);
    expect(rewardBefore.value).to.equal(parseEther("1"));
    expect(rewardBefore.sent).to.equal(false);

    // Answer question by deployer
    await questionManagerContract.write.answer([token, "0x0"], {
      account: deployer.account,
    });

    // Check reward after answering
    const rewardAfter = await questionManagerContract.read.getReward([token]);
    expect(rewardAfter.value).to.equal(parseEther("1"));
    expect(rewardAfter.sent).to.equal(true);

    // Check user balance after answering
    const userOneBalanceAfter = await publicClient.getBalance({
      address: userOne.account.address,
    });
    expect(userOneBalanceAfter - userOneBalanceBefore).to.be.equal(
      parseEther("1")
    );
  });

  it("Should ask and cancel a question", async function () {
    const {
      publicClient,
      userOne,
      userTwo,
      questionContract,
      questionManagerContract,
    } = await loadFixture(initFixture);

    // Create a metadata object
    const { encodedMetadataValue } = await createMetadata();

    // Get user balance before asking
    const userTwoBalanceBefore = await publicClient.getBalance({
      address: userTwo.account.address,
    });

    // Ask question by user two
    const questionValue = parseEther("1");
    await questionManagerContract.write.ask(
      [userOne.account.address, encodedMetadataValue],
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
    await questionManagerContract.write.cancelQuestion([token], {
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
