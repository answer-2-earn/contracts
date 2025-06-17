import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import { initFixture } from "../fixtures/question-manager";

describe("QuestionManager: Ownership", function () {
  it("Should transfer question ownership", async function () {
    const { deployer, userOne, questionContract, questionManagerContract } =
      await loadFixture(initFixture);

    // Check that the Question contract is owned by the QuestionManager
    const initialOwner = await questionContract.read.owner();
    expect(initialOwner.toLowerCase()).to.equal(
      questionManagerContract.address.toLowerCase()
    );

    // Call the function on the question manager to transfer question ownership
    await questionManagerContract.write.transferQuestionOwnership(
      [userOne.account.address],
      {
        account: deployer.account,
      }
    );

    // Verify that userOne is now the owner of the Question contract
    const newOwner = await questionContract.read.owner();
    expect(newOwner.toLowerCase()).to.equal(
      userOne.account.address.toLowerCase()
    );

    // Attempt to transfer ownership with a non-owner account
    await expect(
      questionManagerContract.write.transferQuestionOwnership(
        [deployer.account.address],
        {
          account: userOne.account,
        }
      )
    ).to.rejectedWith("Ownable: caller is not the owner");
  });
});
