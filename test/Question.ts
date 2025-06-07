import { ERC725 } from "@erc725/erc725.js";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { Hex, parseEther } from "viem";

describe("Question", function () {
  async function initFixture() {
    // Get public client
    const publicClient = await hre.viem.getPublicClient();

    // Get signers
    const [deployer, userOne, userTwo] = await hre.viem.getWalletClients();

    // Deploy contracts
    const questionContract = await hre.viem.deployContract("Question", []);

    return {
      publicClient,
      deployer,
      userOne,
      userTwo,
      questionContract,
    };
  }

  it("Should ask and answer a question", async function () {
    const { publicClient, deployer, userOne, userTwo, questionContract } =
      await loadFixture(initFixture);

    // Create a metadata object
    const metadata = {
      asker: "0x4018737e0D777b3d4C72B411a3BeEC286Ec5F5eF",
      question: "What’s your dream?",
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

    // Ask question by user two
    await questionContract.write.ask(
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

    // Get question token metadata
    const tokenMetadataValue = await questionContract.read.getDataForTokenId([
      token,
      "0x9afb95cacc9f95858ec44aa8c3b685511002e30ae54415823f406128b85b238e",
    ]);
    const decodedTokenMetadata = erc725.decodeData([
      {
        keyName: "LSP4Metadata",
        value: tokenMetadataValue,
      },
    ]);

    // Check user balance before answering
    const userOneBalanceBefore = await publicClient.getBalance({
      address: userOne.account.address,
    });

    // Check reward before answering
    const rewardBefore = await questionContract.read.getReward([token]);
    expect(rewardBefore.value).to.equal(parseEther("1"));
    expect(rewardBefore.sent).to.equal(false);

    // Answer question by deployer
    await questionContract.write.answer([token, "0x0"], {
      account: deployer.account,
    });

    // Check reward after answering
    const rewardAfter = await questionContract.read.getReward([token]);
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
    const { publicClient, userOne, userTwo, questionContract } =
      await loadFixture(initFixture);

    // Create a metadata object
    const metadata = {
      asker: "0x4018737e0D777b3d4C72B411a3BeEC286Ec5F5eF",
      question: "What's your favorite book?",
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

    // Get user balance before asking
    const userTwoBalanceBefore = await publicClient.getBalance({
      address: userTwo.account.address,
    });

    // Ask question by user two
    const questionValue = parseEther("1");
    await questionContract.write.ask(
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
    const rewardAfterAsking = await questionContract.read.getReward([token]);
    expect(rewardAfterAsking.value).to.equal(questionValue);
    expect(rewardAfterAsking.sent).to.equal(false);

    // Check asker is correct
    const asker = await questionContract.read.getAsker([token]);
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
    await questionContract.write.cancelQuestion([token], {
      account: userTwo.account,
    });

    // Check reward after cancellation
    const rewardAfterCancellation = await questionContract.read.getReward([
      token,
    ]);
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
