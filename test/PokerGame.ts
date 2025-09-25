import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { PokerGame, PokerGame__factory } from "../types";

type Signers = {
  a: HardhatEthersSigner;
  b: HardhatEthersSigner;
};

describe("PokerGame", function () {
  let signers: Signers;
  let game: PokerGame;
  let gameId: bigint;

  before(async function () {
    const s = await ethers.getSigners();
    signers = { a: s[0], b: s[1] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This test runs only on local FHEVM mock`);
      this.skip();
    }
    const f = (await ethers.getContractFactory("PokerGame")) as PokerGame__factory;
    game = (await f.deploy()) as PokerGame;
    const tx = await game.createGame(0n);
    await tx.wait();
    const next = await game.nextGameId();
    gameId = next - 1n;
  });

  it("players join and receive 2 cards each", async function () {
    const stake = await game.getStake(gameId);
    await expect(game.connect(signers.a).joinGame(gameId, { value: stake })).to.emit(game, "Joined");
    await expect(game.connect(signers.b).joinGame(gameId, { value: stake })).to.emit(game, "Joined");

    const p0 = await game.getPlayer(gameId, 0);
    const p1 = await game.getPlayer(gameId, 1);
    expect(p0.addr).to.eq(signers.a.address);
    expect(p1.addr).to.eq(signers.b.address);
    expect(p0.cardCount).to.eq(2);
    expect(p1.cardCount).to.eq(2);

    const card00 = await game.getCardAt(gameId, 0, 0);
    const card10 = await game.getCardAt(gameId, 1, 0);
    expect(card00).to.not.eq(ethers.ZeroHash);
    expect(card10).to.not.eq(ethers.ZeroHash);
  });

  it("both continue until reveal", async function () {
    const stake = await game.getStake(gameId);
    await game.connect(signers.a).joinGame(gameId, { value: stake });
    await game.connect(signers.b).joinGame(gameId, { value: stake });

    // Need 3 more rounds
    for (let i = 0; i < 3; i++) {
      await game.connect(signers.a).continueGame(gameId, { value: stake });
      await game.connect(signers.b).continueGame(gameId, { value: stake });
    }

    const p0 = await game.getPlayer(gameId, 0);
    const p1 = await game.getPlayer(gameId, 1);
    expect(p0.cardCount).to.eq(5);
    expect(p1.cardCount).to.eq(5);
    const g = await game.getGame(gameId);
    expect(g[0]).to.eq(2); // Reveal
  });
});
