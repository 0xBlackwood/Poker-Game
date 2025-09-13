import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import type { FhevmType } from "@fhevm/hardhat-plugin";

describe("PokerGame", function () {
  async function deployPokerGameFixture() {
    const signers = await ethers.getSigners();
    const contractFactory = await ethers.getContractFactory("PokerGame");
    const contract = await contractFactory.connect(signers[0]).deploy();
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();

    return { contract, contractAddress, signers };
  }

  describe("Game Creation", function () {
    it("Should create a new game", async function () {
      const { contract, signers } = await deployPokerGameFixture();

      const tx = await contract.connect(signers[0]).createGame();
      await tx.wait();

      const gameInfo = await contract.getGameInfo(1);
      expect(gameInfo.state).to.equal(0); // WaitingForPlayers
      expect(gameInfo.playerCount).to.equal(0);
      expect(gameInfo.prizePool).to.equal(0);
    });

    it("Should emit GameCreated event", async function () {
      const { contract, signers } = await deployPokerGameFixture();

      await expect(contract.connect(signers[0]).createGame())
        .to.emit(contract, "GameCreated")
        .withArgs(1);
    });
  });

  describe("Joining Games", function () {
    it("Should allow players to join a game", async function () {
      const { contract, signers } = await deployPokerGameFixture();

      // Create game
      await contract.connect(signers[0]).createGame();

      // Join game
      const joinFee = await contract.JOIN_FEE();
      const tx = await contract.connect(signers[1]).joinGame(1, { value: joinFee });
      await tx.wait();

      const gameInfo = await contract.getGameInfo(1);
      expect(gameInfo.playerCount).to.equal(1);
      expect(gameInfo.prizePool).to.equal(joinFee);

      const players = await contract.getPlayers(1);
      expect(players[0]).to.equal(signers[1].address);
    });

    it("Should reject joining with incorrect fee", async function () {
      const { contract, signers } = await deployPokerGameFixture();

      await contract.connect(signers[0]).createGame();

      const incorrectFee = ethers.parseEther("0.0002");
      await expect(
        contract.connect(signers[1]).joinGame(1, { value: incorrectFee })
      ).to.be.revertedWith("Incorrect join fee");
    });

    it("Should reject joining non-existent game", async function () {
      const { contract, signers } = await deployPokerGameFixture();

      const joinFee = await contract.JOIN_FEE();
      await expect(
        contract.connect(signers[1]).joinGame(999, { value: joinFee })
      ).to.be.revertedWith("Game does not exist");
    });

    it("Should reject more than 2 players", async function () {
      const { contract, signers } = await deployPokerGameFixture();

      await contract.connect(signers[0]).createGame();
      const joinFee = await contract.JOIN_FEE();

      // First two players join
      await contract.connect(signers[1]).joinGame(1, { value: joinFee });
      await contract.connect(signers[2]).joinGame(1, { value: joinFee });

      // Third player should be rejected
      await expect(
        contract.connect(signers[3]).joinGame(1, { value: joinFee })
      ).to.be.revertedWith("Game not accepting players");
    });

    it("Should prevent same player joining twice", async function () {
      const { contract, signers } = await deployPokerGameFixture();

      await contract.connect(signers[0]).createGame();
      const joinFee = await contract.JOIN_FEE();

      await contract.connect(signers[1]).joinGame(1, { value: joinFee });

      await expect(
        contract.connect(signers[1]).joinGame(1, { value: joinFee })
      ).to.be.revertedWith("Player already in a game");
    });
  });

  describe("Card Dealing", function () {
    it("Should deal cards when 2 players join", async function () {
      const { contract, contractAddress, signers } = await deployPokerGameFixture();

      // Create game
      await contract.connect(signers[0]).createGame();
      const joinFee = await contract.JOIN_FEE();

      // First player joins
      await contract.connect(signers[1]).joinGame(1, { value: joinFee });

      let gameInfo = await contract.getGameInfo(1);
      expect(gameInfo.state).to.equal(0); // WaitingForPlayers

      // Second player joins - should trigger card dealing
      const tx = await contract.connect(signers[2]).joinGame(1, { value: joinFee });
      await tx.wait();

      gameInfo = await contract.getGameInfo(1);
      expect(gameInfo.state).to.equal(1); // CardsDealt
      expect(gameInfo.playerCount).to.equal(2);

      // Check that cards were dealt
      const player1Cards = await contract.getPlayerCards(1, signers[1].address);
      const player2Cards = await contract.getPlayerCards(1, signers[2].address);

      expect(player1Cards.length).to.equal(2);
      expect(player2Cards.length).to.equal(2);
    });

    it("Should emit CardsDealt event", async function () {
      const { contract, signers } = await deployPokerGameFixture();

      await contract.connect(signers[0]).createGame();
      const joinFee = await contract.JOIN_FEE();

      await contract.connect(signers[1]).joinGame(1, { value: joinFee });

      await expect(contract.connect(signers[2]).joinGame(1, { value: joinFee }))
        .to.emit(contract, "CardsDealt")
        .withArgs(1);
    });
  });

  describe("Player Decisions", function () {
    async function setupGameWithCards(contract: any, signers: any[]) {
      await contract.connect(signers[0]).createGame();
      const joinFee = await contract.JOIN_FEE();
      
      await contract.connect(signers[1]).joinGame(1, { value: joinFee });
      await contract.connect(signers[2]).joinGame(1, { value: joinFee });
      
      return contract;
    }

    it("Should allow player to continue", async function () {
      const { contract, signers } = await deployPokerGameFixture();
      await setupGameWithCards(contract, signers);

      const continueFee = await contract.CONTINUE_FEE();
      const tx = await contract.connect(signers[1]).makeDecision(1, true, { value: continueFee });
      await tx.wait();

      // Check game state - should still be CardsDealt waiting for other player
      const gameInfo = await contract.getGameInfo(1);
      expect(gameInfo.state).to.equal(1); // CardsDealt
    });

    it("Should allow player to fold", async function () {
      const { contract, signers } = await deployPokerGameFixture();
      await setupGameWithCards(contract, signers);

      const tx = await contract.connect(signers[1]).makeDecision(1, false, { value: 0 });
      await tx.wait();

      // Check that decision was registered
      const gameInfo = await contract.getGameInfo(1);
      expect(gameInfo.state).to.equal(1); // Still CardsDealt, waiting for other player
    });

    it("Should reject continue without proper fee", async function () {
      const { contract, signers } = await deployPokerGameFixture();
      await setupGameWithCards(contract, signers);

      await expect(
        contract.connect(signers[1]).makeDecision(1, true, { value: 0 })
      ).to.be.revertedWith("Incorrect continue fee");
    });

    it("Should finish game when only one player continues", async function () {
      const { contract, signers } = await deployPokerGameFixture();
      await setupGameWithCards(contract, signers);

      const continueFee = await contract.CONTINUE_FEE();
      
      // Player 1 continues
      await contract.connect(signers[1]).makeDecision(1, true, { value: continueFee });
      
      // Player 2 folds - should finish the game
      const tx = await contract.connect(signers[2]).makeDecision(1, false, { value: 0 });
      await tx.wait();

      const gameInfo = await contract.getGameInfo(1);
      expect(gameInfo.state).to.equal(2); // GameFinished
      expect(gameInfo.winner).to.equal(signers[1].address);
    });

    it("Should deal community cards when both players continue", async function () {
      const { contract, signers } = await deployPokerGameFixture();
      await setupGameWithCards(contract, signers);

      const continueFee = await contract.CONTINUE_FEE();
      
      // Both players continue
      await contract.connect(signers[1]).makeDecision(1, true, { value: continueFee });
      const tx = await contract.connect(signers[2]).makeDecision(1, true, { value: continueFee });
      await tx.wait();

      const gameInfo = await contract.getGameInfo(1);
      expect(gameInfo.state).to.equal(2); // GameFinished

      // Check community cards were dealt
      const communityCards = await contract.getCommunityCards(1);
      expect(communityCards.length).to.equal(5);
    });

    it("Should emit PlayerDecision event", async function () {
      const { contract, signers } = await deployPokerGameFixture();
      await setupGameWithCards(contract, signers);

      const continueFee = await contract.CONTINUE_FEE();

      await expect(contract.connect(signers[1]).makeDecision(1, true, { value: continueFee }))
        .to.emit(contract, "PlayerDecision")
        .withArgs(1, signers[1].address, true);
    });

    it("Should emit GameFinished event", async function () {
      const { contract, signers } = await deployPokerGameFixture();
      await setupGameWithCards(contract, signers);

      const continueFee = await contract.CONTINUE_FEE();
      const joinFee = await contract.JOIN_FEE();
      const expectedPrize = joinFee * BigInt(2) + continueFee; // 2 join fees + 1 continue fee
      
      await contract.connect(signers[1]).makeDecision(1, true, { value: continueFee });

      await expect(contract.connect(signers[2]).makeDecision(1, false, { value: 0 }))
        .to.emit(contract, "GameFinished")
        .withArgs(1, signers[1].address, expectedPrize);
    });

    it("Should prevent double decisions", async function () {
      const { contract, signers } = await deployPokerGameFixture();
      await setupGameWithCards(contract, signers);

      const continueFee = await contract.CONTINUE_FEE();
      
      await contract.connect(signers[1]).makeDecision(1, true, { value: continueFee });

      await expect(
        contract.connect(signers[1]).makeDecision(1, false, { value: 0 })
      ).to.be.revertedWith("Player already made decision");
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow emergency cancel for old games", async function () {
      const { contract, signers } = await deployPokerGameFixture();

      await contract.connect(signers[0]).createGame();
      const joinFee = await contract.JOIN_FEE();
      await contract.connect(signers[1]).joinGame(1, { value: joinFee });

      // Fast forward time by more than 1 hour
      await ethers.provider.send("evm_increaseTime", [3601]); // 1 hour + 1 second
      await ethers.provider.send("evm_mine", []);

      const tx = await contract.connect(signers[0]).emergencyCancel(1);
      await tx.wait();

      const gameInfo = await contract.getGameInfo(1);
      expect(gameInfo.state).to.equal(3); // GameCancelled
    });

    it("Should reject emergency cancel for new games", async function () {
      const { contract, signers } = await deployPokerGameFixture();

      await contract.connect(signers[0]).createGame();

      await expect(
        contract.connect(signers[0]).emergencyCancel(1)
      ).to.be.revertedWith("Game not old enough for emergency cancel");
    });
  });

  describe("View Functions", function () {
    it("Should get game info correctly", async function () {
      const { contract, signers } = await deployPokerGameFixture();

      await contract.connect(signers[0]).createGame();
      const joinFee = await contract.JOIN_FEE();
      await contract.connect(signers[1]).joinGame(1, { value: joinFee });

      const gameInfo = await contract.getGameInfo(1);
      expect(gameInfo.state).to.equal(0); // WaitingForPlayers
      expect(gameInfo.playerCount).to.equal(1);
      expect(gameInfo.prizePool).to.equal(joinFee);
      expect(gameInfo.winner).to.equal("0x0000000000000000000000000000000000000000");
    });

    it("Should get players list correctly", async function () {
      const { contract, signers } = await deployPokerGameFixture();

      await contract.connect(signers[0]).createGame();
      const joinFee = await contract.JOIN_FEE();
      
      await contract.connect(signers[1]).joinGame(1, { value: joinFee });
      await contract.connect(signers[2]).joinGame(1, { value: joinFee });

      const players = await contract.getPlayers(1);
      expect(players[0]).to.equal(signers[1].address);
      expect(players[1]).to.equal(signers[2].address);
    });

    it("Should reject getting cards for non-player", async function () {
      const { contract, signers } = await deployPokerGameFixture();

      await contract.connect(signers[0]).createGame();

      await expect(
        contract.getPlayerCards(1, signers[1].address)
      ).to.be.revertedWith("Player not found in game");
    });
  });

  describe("Prize Distribution", function () {
    it("Should transfer prize to winner", async function () {
      const { contract, signers } = await deployPokerGameFixture();

      await contract.connect(signers[0]).createGame();
      const joinFee = await contract.JOIN_FEE();
      const continueFee = await contract.CONTINUE_FEE();
      
      // Both players join
      await contract.connect(signers[1]).joinGame(1, { value: joinFee });
      await contract.connect(signers[2]).joinGame(1, { value: joinFee });

      const initialBalance = await ethers.provider.getBalance(signers[1].address);
      
      // Player 1 continues, Player 2 folds
      const tx1 = await contract.connect(signers[1]).makeDecision(1, true, { value: continueFee });
      const receipt1 = await tx1.wait();
      const gasUsed1 = receipt1?.gasUsed || BigInt(0);
      const gasPrice1 = tx1.gasPrice || BigInt(0);
      
      await contract.connect(signers[2]).makeDecision(1, false, { value: 0 });

      const finalBalance = await ethers.provider.getBalance(signers[1].address);
      const expectedPrize = joinFee * BigInt(2) + continueFee; // Total prize pool
      const transactionCost = gasUsed1 * gasPrice1;

      expect(finalBalance).to.equal(
        initialBalance - continueFee - transactionCost + expectedPrize
      );
    });
  });
});