import { time } from "@nomicfoundation/hardhat-network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { CryptoPolling, CryptoPolling__factory } from "../types";

type Signers = {
  creator: HardhatEthersSigner;
  voter: HardhatEthersSigner;
  other: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("CryptoPolling")) as CryptoPolling__factory;
  const contract = (await factory.deploy()) as CryptoPolling;
  const address = await contract.getAddress();

  return { contract, contractAddress: address };
}

describe("CryptoPolling", function () {
  let signers: Signers;
  let contract: CryptoPolling;
  let contractAddress: string;

  before(async function () {
    const availableSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { creator: availableSigners[0], voter: availableSigners[1], other: availableSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("Skipping locally because FHE mock is required for tests");
      this.skip();
    }

    ({ contract, contractAddress } = await deployFixture());
  });

  it("creates a poll with valid schedule and options", async function () {
    const now = await time.latest();
    const start = now + 10;
    const end = start + 3600;

    await contract
      .connect(signers.creator)
      .createPoll("Encryption Choice", ["Zama", "Homomorphic"], start, end);

    const poll = await contract.getPoll(0);
    expect(poll.name).to.eq("Encryption Choice");
    expect(poll.options.length).to.eq(2);
    expect(poll.startTime).to.eq(BigInt(start));
    expect(poll.endTime).to.eq(BigInt(end));
    expect(poll.creator).to.eq(signers.creator.address);
  });

  it("records an encrypted vote and decrypts the finalized tally", async function () {
    const now = await time.latest();
    const end = now + 3600;

    await contract
      .connect(signers.creator)
      .createPoll("Best snack", ["Pizza", "Sushi", "Tacos"], now, end);

    await fhevm.initializeCLIApi();
    const encryptedChoice = await fhevm
      .createEncryptedInput(contractAddress, signers.voter.address)
      .add32(1)
      .encrypt();

    await contract
      .connect(signers.voter)
      .castVote(0, encryptedChoice.handles[0], encryptedChoice.inputProof);

    const voted = await contract.hasAddressVoted(0, signers.voter.address);
    expect(voted).to.eq(true);

    await time.increaseTo(end + 1);
    await contract.connect(signers.creator).finalizePoll(0);

    const counts = await contract.getEncryptedCounts(0);
    const decoded = await Promise.all(
      counts.map((value) => fhevm.publicDecryptEuint(FhevmType.euint32, value)),
    );

    expect(decoded[0]).to.eq(0);
    expect(decoded[1]).to.eq(1);
    expect(decoded[2]).to.eq(0);
  });

  it("prevents double voting and voting after the deadline", async function () {
    const now = await time.latest();
    const end = now + 300;

    await contract.connect(signers.creator).createPoll("One vote", ["Yes", "No"], now, end);

    await fhevm.initializeCLIApi();
    const encryptedChoice = await fhevm
      .createEncryptedInput(contractAddress, signers.voter.address)
      .add32(0)
      .encrypt();

    await contract
      .connect(signers.voter)
      .castVote(0, encryptedChoice.handles[0], encryptedChoice.inputProof);

    await expect(
      contract.connect(signers.voter).castVote(0, encryptedChoice.handles[0], encryptedChoice.inputProof),
    ).to.be.revertedWithCustomError(contract, "AlreadyVoted");

    await time.increaseTo(end + 1);
    await expect(
      contract.connect(signers.other).castVote(0, encryptedChoice.handles[0], encryptedChoice.inputProof),
    ).to.be.revertedWithCustomError(contract, "PollClosed");
  });
});
