import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("poker:address", "Prints the PokerGame address").setAction(async (_args: TaskArguments, hre) => {
  const { deployments } = hre;
  const d = await deployments.get("PokerGame");
  console.log(d.address);
});

task("poker:join", "Join the current game with stake").setAction(async (_args: TaskArguments, hre) => {
  const { ethers, deployments } = hre;
  const d = await deployments.get("PokerGame");
  const c = await ethers.getContractAt("PokerGame", d.address);
  const STAKE = await c.STAKE();
  const tx = await c.joinGame({ value: STAKE });
  console.log(`join tx: ${tx.hash}`);
  await tx.wait();
});

task("poker:continue", "Commit to continue this round").setAction(async (_args: TaskArguments, hre) => {
  const { ethers, deployments } = hre;
  const d = await deployments.get("PokerGame");
  const c = await ethers.getContractAt("PokerGame", d.address);
  const STAKE = await c.STAKE();
  const tx = await c.continueGame({ value: STAKE });
  console.log(`continue tx: ${tx.hash}`);
  await tx.wait();
});

task("poker:fold", "Fold and give the pot to opponent").setAction(async (_args: TaskArguments, hre) => {
  const { ethers, deployments } = hre;
  const d = await deployments.get("PokerGame");
  const c = await ethers.getContractAt("PokerGame", d.address);
  const tx = await c.fold();
  console.log(`fold tx: ${tx.hash}`);
  await tx.wait();
});

task("poker:settle", "Request reveal and settlement").setAction(async (_args: TaskArguments, hre) => {
  const { ethers, deployments } = hre;
  const d = await deployments.get("PokerGame");
  const c = await ethers.getContractAt("PokerGame", d.address);
  const tx = await c.settleRequest();
  console.log(`settle request tx: ${tx.hash}`);
  await tx.wait();
});

