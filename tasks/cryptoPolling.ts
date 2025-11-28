import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("poll:address", "Print deployed CryptoPolling address").setAction(async (_: TaskArguments, hre) => {
  const deployment = await hre.deployments.get("CryptoPolling");
  console.log(`CryptoPolling address: ${deployment.address}`);
});

task("poll:create", "Create a new poll")
  .addParam("name", "Poll name")
  .addParam("options", "Comma separated option titles (2-4)")
  .addParam("end", "End time (unix seconds)")
  .addOptionalParam("start", "Start time (unix seconds, defaults to now)")
  .setAction(async (taskArguments: TaskArguments, hre) => {
    const { ethers } = hre;
    const deployment = await hre.deployments.get("CryptoPolling");
    const polling = await ethers.getContractAt("CryptoPolling", deployment.address);

    const options = (taskArguments.options as string)
      .split(",")
      .map((opt) => opt.trim())
      .filter(Boolean);

    const startTime = taskArguments.start ? parseInt(taskArguments.start as string, 10) : Math.floor(Date.now() / 1000);
    const endTime = parseInt(taskArguments.end as string, 10);

    const tx = await polling.createPoll(taskArguments.name as string, options, startTime, endTime);
    const receipt = await tx.wait();

    console.log(`Created poll in tx ${receipt?.hash}`);
  });

task("poll:vote", "Cast a vote using an encrypted option index")
  .addParam("poll", "Poll id")
  .addParam("choice", "Option index (0-based) to encrypt")
  .setAction(async (taskArguments: TaskArguments, hre) => {
    const { deployments, ethers, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const deployment = await deployments.get("CryptoPolling");
    const polling = await ethers.getContractAt("CryptoPolling", deployment.address);
    const signer = (await ethers.getSigners())[0];

    const encryptedChoice = await fhevm
      .createEncryptedInput(deployment.address, signer.address)
      .add32(parseInt(taskArguments.choice as string, 10))
      .encrypt();

    const tx = await polling
      .connect(signer)
      .castVote(parseInt(taskArguments.poll as string, 10), encryptedChoice.handles[0], encryptedChoice.inputProof);
    const receipt = await tx.wait();

    console.log(`Vote submitted in tx ${receipt?.hash}`);
  });

task("poll:decrypt", "Decrypt a finalized poll's counts")
  .addParam("poll", "Poll id")
  .setAction(async (taskArguments: TaskArguments, hre) => {
    const { deployments, ethers, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const deployment = await deployments.get("CryptoPolling");
    const polling = await ethers.getContractAt("CryptoPolling", deployment.address);
    const signer = (await ethers.getSigners())[0];

    const counts = await polling.getEncryptedCounts(parseInt(taskArguments.poll as string, 10));
    const readableCounts: number[] = [];

    for (const count of counts) {
      const clear = await fhevm.userDecryptEuint(FhevmType.euint32, count, deployment.address, signer);
      readableCounts.push(clear);
    }

    console.log(`Poll ${taskArguments.poll} decrypted counts: ${readableCounts.join(", ")}`);
  });
