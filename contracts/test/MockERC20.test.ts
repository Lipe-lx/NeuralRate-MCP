import { expect } from "chai";
import { ethers } from "hardhat";

describe("MockERC20", function () {
  it("exposes the Mock USDY token surface used by the Sepolia demo harness", async function () {
    const [owner, recipient, spender] = await ethers.getSigners();
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy("Mock USDY", "USDY", 18);

    expect(await token.name()).to.equal("Mock USDY");
    expect(await token.symbol()).to.equal("USDY");
    expect(await token.decimals()).to.equal(18);

    await expect(token.mint(owner.address, ethers.parseUnits("100", 18)))
      .to.emit(token, "Transfer")
      .withArgs(ethers.ZeroAddress, owner.address, ethers.parseUnits("100", 18));

    await expect(token.transfer(recipient.address, ethers.parseUnits("25", 18)))
      .to.emit(token, "Transfer")
      .withArgs(owner.address, recipient.address, ethers.parseUnits("25", 18));

    await expect(token.approve(spender.address, ethers.parseUnits("10", 18)))
      .to.emit(token, "Approval")
      .withArgs(owner.address, spender.address, ethers.parseUnits("10", 18));

    await expect(
      token.connect(spender).transferFrom(owner.address, recipient.address, ethers.parseUnits("5", 18))
    )
      .to.emit(token, "Transfer")
      .withArgs(owner.address, recipient.address, ethers.parseUnits("5", 18));

    expect(await token.balanceOf(recipient.address)).to.equal(ethers.parseUnits("30", 18));
    expect(await token.allowance(owner.address, spender.address)).to.equal(ethers.parseUnits("5", 18));
  });
});
