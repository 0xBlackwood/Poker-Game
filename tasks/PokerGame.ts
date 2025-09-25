import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { fhevm } from "hardhat";

task("task:createGame")
  .setDescription("Create a new poker game")
  .setAction(async function (taskArguments: TaskArguments, { ethers, network }) {
    const signers = await ethers.getSigners();
    const pokerGameFactory = await ethers.getContractFactory("PokerGame");
    const pokerGame = pokerGameFactory.attach("0x0000000000000000000000000000000000000000"); // Replace with deployed address

    const transaction = await pokerGame.connect(signers[0]).createGame();
    await transaction.wait();

    console.log(`Game created! Transaction: ${transaction.hash}`);
  });

task("task:joinGame")
  .addParam("gameId", "The game ID to join")
  .setDescription("Join a poker game")
  .setAction(async function (taskArguments: TaskArguments, { ethers, network }) {
    const signers = await ethers.getSigners();
    const pokerGameFactory = await ethers.getContractFactory("PokerGame");
    const pokerGame = pokerGameFactory.attach("0x0000000000000000000000000000000000000000"); // Replace with deployed address

    const joinFee = await pokerGame.JOIN_FEE();
    
    const transaction = await pokerGame.connect(signers[0]).joinGame(
      taskArguments.gameId,
      { value: joinFee }
    );
    await transaction.wait();

    console.log(`Joined game ${taskArguments.gameId}! Transaction: ${transaction.hash}`);
  });

task("task:makeDecision")
  .addParam("gameId", "The game ID")
  .addParam("continue", "Whether to continue (true/false)")
  .setDescription("Make a decision in a poker game")
  .setAction(async function (taskArguments: TaskArguments, { ethers, network }) {
    const signers = await ethers.getSigners();
    const pokerGameFactory = await ethers.getContractFactory("PokerGame");
    const pokerGame = pokerGameFactory.attach("0x0000000000000000000000000000000000000000"); // Replace with deployed address

    const continueGame = taskArguments.continue === "true";
    const continueFee = await pokerGame.CONTINUE_FEE();
    
    const transaction = await pokerGame.connect(signers[0]).makeDecision(
      taskArguments.gameId,
      continueGame,
      { value: continueGame ? continueFee : 0 }
    );
    await transaction.wait();

    console.log(`Made decision for game ${taskArguments.gameId}! Transaction: ${transaction.hash}`);
  });

task("task:getGameInfo")
  .addParam("gameId", "The game ID")
  .setDescription("Get game information")
  .setAction(async function (taskArguments: TaskArguments, { ethers, network }) {
    const signers = await ethers.getSigners();
    const pokerGameFactory = await ethers.getContractFactory("PokerGame");
    const pokerGame = pokerGameFactory.attach("0x0000000000000000000000000000000000000000"); // Replace with deployed address

    const gameInfo = await pokerGame.getGameInfo(taskArguments.gameId);
    const players = await pokerGame.getPlayers(taskArguments.gameId);

    console.log("Game Info:");
    console.log("- State:", gameInfo.state);
    console.log("- Player Count:", gameInfo.playerCount.toString());
    console.log("- Prize Pool:", ethers.formatEther(gameInfo.prizePool.toString()), "ETH");
    console.log("- Winner:", gameInfo.winner);
    console.log("- Players:", players.filter(addr => addr !== "0x0000000000000000000000000000000000000000"));
  });

task("task:getPlayerCards")
  .addParam("gameId", "The game ID")
  .addParam("playerAddress", "The player's address")
  .setDescription("Get player's cards (encrypted)")
  .setAction(async function (taskArguments: TaskArguments, { ethers, network }) {
    const signers = await ethers.getSigners();
    const pokerGameFactory = await ethers.getContractFactory("PokerGame");
    const pokerGame = pokerGameFactory.attach("0x0000000000000000000000000000000000000000"); // Replace with deployed address

    try {
      const cards = await pokerGame.getPlayerCards(taskArguments.gameId, taskArguments.playerAddress);
      console.log("Player's encrypted cards:", cards);
      
      // If we want to decrypt them (only the owner can do this)
      if (network.name === "sepolia") {
        console.log("To decrypt these cards, you need to use the relayer SDK on the frontend");
      }
    } catch (error) {
      console.log("Error getting player cards:", error);
    }
  });