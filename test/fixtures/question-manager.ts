import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import hre from "hardhat";
import { parseEther } from "viem";
import {
  getAnswerMetadataValueOne,
  getAskMetadataValue,
} from "../utils/metadata";

export async function initFixture() {
  // Get public client
  const publicClient = await hre.viem.getPublicClient();

  // Get wallet clients
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

export async function fixtureWithAskedQuestion() {
  const {
    publicClient,
    deployer,
    userOne,
    userTwo,
    questionContract,
    questionManagerContract,
  } = await loadFixture(initFixture);

  const answerer = userOne;
  const asker = userTwo;
  const reward = parseEther("1");

  await questionManagerContract.write.ask(
    [answerer.account.address, getAskMetadataValue()],
    {
      account: asker.account,
      value: reward,
    }
  );

  const tokens = await questionContract.read.tokenIdsOf([
    userOne.account.address,
  ]);
  const token = tokens[0];

  return {
    publicClient,
    deployer,
    answerer,
    asker,
    questionContract,
    questionManagerContract,
    token,
    reward,
  };
}

export async function fixtureWithAskedZeroRewardQuestion() {
  const {
    publicClient,
    deployer,
    userOne,
    userTwo,
    questionContract,
    questionManagerContract,
  } = await loadFixture(initFixture);

  const answerer = userOne;
  const asker = userTwo;

  await questionManagerContract.write.ask(
    [answerer.account.address, getAskMetadataValue()],
    {
      account: asker.account,
    }
  );

  const tokens = await questionContract.read.tokenIdsOf([
    userOne.account.address,
  ]);
  const token = tokens[0];

  return {
    publicClient,
    deployer,
    answerer,
    asker,
    questionContract,
    questionManagerContract,
    token,
  };
}

export async function fixtureWithAnsweredQuestion() {
  const {
    publicClient,
    deployer,
    answerer,
    asker,
    questionContract,
    questionManagerContract,
    token,
    reward,
  } = await loadFixture(fixtureWithAskedQuestion);

  await questionManagerContract.write.answer(
    [token, getAnswerMetadataValueOne()],
    {
      account: answerer.account,
    }
  );

  return {
    publicClient,
    deployer,
    answerer,
    asker,
    questionContract,
    questionManagerContract,
    token,
    reward,
  };
}

export async function fixtureWithAnsweredZeroRewardQuestion() {
  const {
    publicClient,
    deployer,
    answerer,
    asker,
    questionContract,
    questionManagerContract,
    token,
  } = await loadFixture(fixtureWithAskedZeroRewardQuestion);

  await questionManagerContract.write.answer(
    [token, getAnswerMetadataValueOne()],
    {
      account: answerer.account,
    }
  );

  return {
    publicClient,
    deployer,
    answerer,
    asker,
    questionContract,
    questionManagerContract,
    token,
  };
}
