import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("poker:address", "Prints the PokerGame address").setAction(async (_args: TaskArguments, hre) => {
  const { deployments } = hre;
  const d = await deployments.get("PokerGame");
  console.log(d.address);
});

task("poker:create", "Create a game (optional --stake WEI)")
  .addOptionalParam("stake", "stake in wei (defaults to DEFAULT_STAKE)")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;
    const d = await deployments.get("PokerGame");
    const c = await ethers.getContractAt("PokerGame", d.address);
    const tx = await c.createGame(args.stake ? BigInt(args.stake) : 0n);
    console.log(`create tx: ${tx.hash}`);
    const r = await tx.wait();
    const ev = r!.logs.find(() => true);
    // suggest reading events via interface if needed
    console.log(`Created. Check events for gameId.`);
  });

task("poker:join", "Join a gameId with stake")
  .addParam("id", "game id")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;
    const d = await deployments.get("PokerGame");
    const c = await ethers.getContractAt("PokerGame", d.address);
    const STAKE = await c.getStake(args.id);
    const tx = await c.joinGame(args.id, { value: STAKE });
    console.log(`join tx: ${tx.hash}`);
    await tx.wait();
  });

task("poker:continue", "Commit to continue this round")
  .addParam("id", "game id")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;
    const d = await deployments.get("PokerGame");
    const c = await ethers.getContractAt("PokerGame", d.address);
    const STAKE = await c.getStake(args.id);
    const tx = await c.continueGame(args.id, { value: STAKE });
    console.log(`continue tx: ${tx.hash}`);
    await tx.wait();
  });

task("poker:fold", "Fold and give the pot to opponent")
  .addParam("id", "game id")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;
    const d = await deployments.get("PokerGame");
    const c = await ethers.getContractAt("PokerGame", d.address);
    const tx = await c.fold(args.id);
    console.log(`fold tx: ${tx.hash}`);
    await tx.wait();
  });

task("poker:settle", "Request reveal and settlement")
  .addParam("id", "game id")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;
    const d = await deployments.get("PokerGame");
    const c = await ethers.getContractAt("PokerGame", d.address);
    const tx = await c.settleRequest(args.id);
    console.log(`settle request tx: ${tx.hash}`);
    await tx.wait();
  });
