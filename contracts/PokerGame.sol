// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8, euint16} from "@fhevm/solidity/lib/FHE.sol";
import {CoprocessorConfig} from "@fhevm/solidity/lib/Impl.sol";

/// @title Two-Player FHE Poker Demo
/// @notice Minimal two-player draw-style game using encrypted cards (FHEVM)
contract PokerGame {
    enum GameState { Waiting, Active, Reveal, Ended }

    struct Player {
        address addr;
        uint8 cardCount;
        bool committed;
        euint8[5] cards;
    }

    struct Game {
        Player[2] players;
        uint256 pot;
        GameState state;
        address winner;
        euint16 sum0;
        euint16 sum1;
        uint256 stake;
        bool exists;
    }

    uint256 public constant DEFAULT_STAKE = 0.0001 ether;
    uint256 public nextGameId;
    mapping(uint256 => Game) private _games;
    mapping(uint256 => uint256) private _reqToGame; // requestId => gameId

    event GameCreated(uint256 indexed gameId, uint256 stake);
    event Joined(uint256 indexed gameId, address indexed player, uint8 index);
    event Dealt(uint256 indexed gameId, address indexed player, uint8 newCount);
    event Continued(uint256 indexed gameId, address indexed player);
    event Folded(uint256 indexed gameId, address indexed player, address indexed opponent, uint256 amount);
    event RevealRequested(uint256 indexed gameId, uint256 requestId);
    event Settled(uint256 indexed gameId, address indexed winner, uint256 amount);

    constructor() {
        // Only set Zama Sepolia config on Sepolia chain
        if (block.chainid == 11155111) {
            FHE.setCoprocessor(
                CoprocessorConfig({
                    ACLAddress: 0x687820221192C5B662b25367F70076A37bc79b6c,
                    CoprocessorAddress: 0x848B0066793BcC60346Da1F49049357399B8D595,
                    DecryptionOracleAddress: 0xD92486Ae8e0aD516d6DF1A0664b80d07B219b606,
                    KMSVerifierAddress: 0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC
                })
            );
        }
    }

    modifier onlyPlayers(uint256 gameId) {
        Game storage g = _games[gameId];
        require(g.exists, "game");
        require(msg.sender == g.players[0].addr || msg.sender == g.players[1].addr, "not player");
        _;
    }

    function createGame(uint256 stakeWei) external returns (uint256 gameId) {
        gameId = nextGameId++;
        Game storage g = _games[gameId];
        g.exists = true;
        g.state = GameState.Waiting;
        g.stake = stakeWei == 0 ? DEFAULT_STAKE : stakeWei;
        emit GameCreated(gameId, g.stake);
    }

    function getStake(uint256 gameId) external view returns (uint256) {
        return _games[gameId].stake;
    }

    function getGame(uint256 gameId) external view returns (GameState state, uint256 pot, address winner, uint256 stake) {
        Game storage g = _games[gameId];
        require(g.exists, "game");
        return (g.state, g.pot, g.winner, g.stake);
    }

    function playerIndex(uint256 gameId, address a) public view returns (int8) {
        Game storage g = _games[gameId];
        if (!g.exists) return -1;
        if (g.players[0].addr == a) return 0;
        if (g.players[1].addr == a) return 1;
        return -1;
    }

    function getPlayer(uint256 gameId, uint8 idx) public view returns (address addr, uint8 cardCount, bool committed) {
        require(idx < 2, "idx");
        Game storage g = _games[gameId];
        require(g.exists, "game");
        Player storage p = g.players[idx];
        return (p.addr, p.cardCount, p.committed);
    }

    function getCardAt(uint256 gameId, uint8 idx, uint8 cardIdx) public view returns (euint8) {
        require(idx < 2, "idx");
        Game storage g = _games[gameId];
        require(g.exists, "game");
        require(cardIdx < g.players[idx].cardCount, "cardIdx");
        return g.players[idx].cards[cardIdx];
    }

    function joinGame(uint256 gameId) external payable {
        Game storage g = _games[gameId];
        require(g.exists, "game");
        require(g.state == GameState.Waiting || g.state == GameState.Active, "state");
        require(msg.value == g.stake, "stake");

        if (g.players[0].addr == address(0)) {
            g.players[0].addr = msg.sender;
            emit Joined(gameId, msg.sender, 0);
        } else if (g.players[1].addr == address(0)) {
            require(msg.sender != g.players[0].addr, "joined");
            g.players[1].addr = msg.sender;
            emit Joined(gameId, msg.sender, 1);
        } else {
            revert("full");
        }

        g.pot += msg.value;

        if (g.players[0].addr != address(0) && g.players[1].addr != address(0)) {
            if (g.state == GameState.Waiting) {
                g.state = GameState.Active;
                _dealCard(gameId, g, 0);
                _dealCard(gameId, g, 0);
                _dealCard(gameId, g, 1);
                _dealCard(gameId, g, 1);
            }
        }
    }

    function continueGame(uint256 gameId) external payable onlyPlayers(gameId) {
        Game storage g = _games[gameId];
        require(g.state == GameState.Active, "state");
        require(msg.value == g.stake, "stake");

        uint8 idx = uint8(uint256(int256(playerIndex(gameId, msg.sender))));
        g.players[idx].committed = true;
        g.pot += msg.value;
        emit Continued(gameId, msg.sender);

        if (g.players[0].committed && g.players[1].committed) {
            g.players[0].committed = false;
            g.players[1].committed = false;
            _dealCard(gameId, g, 0);
            _dealCard(gameId, g, 1);
            if (g.players[0].cardCount == 5 && g.players[1].cardCount == 5) {
                g.state = GameState.Reveal;
            }
        }
    }

    function fold(uint256 gameId) external onlyPlayers(gameId) {
        Game storage g = _games[gameId];
        require(g.state == GameState.Active, "state");

        uint8 idx = uint8(uint256(int256(playerIndex(gameId, msg.sender))));
        uint8 opp = idx == 0 ? 1 : 0;
        address opponent = g.players[opp].addr;
        require(opponent != address(0), "opponent");

        uint256 amount = g.pot;
        g.pot = 0;
        g.state = GameState.Ended;
        g.winner = opponent;
        (bool ok, ) = opponent.call{value: amount}("");
        require(ok, "transfer");
        emit Folded(gameId, msg.sender, opponent, amount);
        emit Settled(gameId, opponent, amount);
    }

    function settleRequest(uint256 gameId) external onlyPlayers(gameId) {
        Game storage g = _games[gameId];
        require(g.state == GameState.Reveal, "state");

        g.sum0 = _sumHand(g, g.players[0]);
        g.sum1 = _sumHand(g, g.players[1]);
        FHE.allowThis(g.sum0);
        FHE.allowThis(g.sum1);

        bytes32[] memory handles = new bytes32[](2);
        handles[0] = FHE.toBytes32(g.sum0);
        handles[1] = FHE.toBytes32(g.sum1);
        uint256 requestId = FHE.requestDecryption(handles, this.onSettle.selector);
        _reqToGame[requestId] = gameId;
        emit RevealRequested(gameId, requestId);
    }

    function onSettle(uint256 requestId, bytes calldata cleartexts, bytes calldata decryptionProof) external {
        FHE.checkSignatures(requestId, cleartexts, decryptionProof);
        uint256 gameId = _reqToGame[requestId];
        Game storage g = _games[gameId];
        require(g.exists, "game");
        require(g.state == GameState.Reveal, "state");

        address p0 = g.players[0].addr;
        address p1 = g.players[1].addr;
        require(p0 != address(0) && p1 != address(0), "players");

        (uint256 s0, uint256 s1) = abi.decode(cleartexts, (uint256, uint256));
        address win = s0 >= s1 ? p0 : p1;
        uint256 amount = g.pot;
        g.pot = 0;
        g.state = GameState.Ended;
        g.winner = win;
        (bool ok, ) = win.call{value: amount}("");
        require(ok, "transfer");
        emit Settled(gameId, win, amount);
    }

    function makeMyCardsPublic(uint256 gameId) external onlyPlayers(gameId) {
        Game storage g = _games[gameId];
        uint8 idx = uint8(uint256(int256(playerIndex(gameId, msg.sender))));
        for (uint8 i = 0; i < g.players[idx].cardCount; i++) {
            g.players[idx].cards[i] = FHE.makePubliclyDecryptable(g.players[idx].cards[i]);
        }
    }

    function _dealCard(uint256 gameId, Game storage g, uint8 idx) internal {
        require(idx < 2, "idx");
        Player storage p = g.players[idx];
        require(p.addr != address(0), "player");
        require(p.cardCount < 5, "full");
        euint8 r = FHE.randEuint8(64);
        euint8 card = FHE.rem(r, 52);
        p.cards[p.cardCount] = card;
        p.cardCount += 1;
        FHE.allow(card, p.addr);
        FHE.allowThis(card);
        emit Dealt(gameId, p.addr, p.cardCount);
    }

    function _sumHand(Game storage g, Player storage p) internal returns (euint16 total) {
        total = FHE.asEuint16(0);
        for (uint8 i = 0; i < p.cardCount; i++) {
            total = FHE.add(total, p.cards[i]);
        }
        FHE.allow(total, g.players[0].addr);
        FHE.allow(total, g.players[1].addr);
    }

}
