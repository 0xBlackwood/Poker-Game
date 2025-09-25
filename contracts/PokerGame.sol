// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8, euint16} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Two-Player FHE Poker Demo
/// @notice Minimal two-player draw-style game using encrypted cards (FHEVM)
contract PokerGame is SepoliaConfig {
    enum GameState {
        Waiting,
        Active,
        Reveal,
        Ended
    }

    struct Player {
        address addr;
        uint8 cardCount;
        bool committed;
        euint8[5] cards;
    }

    uint256 public constant STAKE = 0.0001 ether;

    Player[2] private _players;
    uint256 public pot;
    GameState public state;
    address public winner;

    // Cached sums to decrypt and settle
    euint16 private _sum0;
    euint16 private _sum1;

    event Joined(address indexed player, uint8 index);
    event Dealt(address indexed player, uint8 newCount);
    event Continued(address indexed player);
    event Folded(address indexed player, address indexed opponent, uint256 amount);
    event RevealRequested(uint256 requestId);
    event Settled(address indexed winner, uint256 amount);

    modifier onlyPlayers() {
        require(msg.sender == _players[0].addr || msg.sender == _players[1].addr, "not a player");
        _;
    }

    function playerIndex(address a) public view returns (int8) {
        if (_players[0].addr == a) return 0;
        if (_players[1].addr == a) return 1;
        return -1;
    }

    function getPlayer(uint8 idx) public view returns (address addr, uint8 cardCount, bool committed) {
        require(idx < 2, "idx");
        Player storage p = _players[idx];
        return (p.addr, p.cardCount, p.committed);
    }

    function getCardAt(uint8 idx, uint8 cardIdx) public view returns (euint8) {
        require(idx < 2, "idx");
        require(cardIdx < _players[idx].cardCount, "cardIdx");
        return _players[idx].cards[cardIdx];
    }

    function joinGame() external payable {
        require(state == GameState.Waiting || state == GameState.Active, "bad state");
        require(msg.value == STAKE, "stake");

        // Fill player slots
        if (_players[0].addr == address(0)) {
            _players[0].addr = msg.sender;
            emit Joined(msg.sender, 0);
        } else if (_players[1].addr == address(0)) {
            require(msg.sender != _players[0].addr, "already joined");
            _players[1].addr = msg.sender;
            emit Joined(msg.sender, 1);
        } else {
            revert("full");
        }

        pot += msg.value;

        // Start the game when both players are present
        if (_players[0].addr != address(0) && _players[1].addr != address(0)) {
            if (state == GameState.Waiting) {
                state = GameState.Active;
                // Deal 2 cards to each player
                _dealCard(0);
                _dealCard(0);
                _dealCard(1);
                _dealCard(1);
            }
        }
    }

    function continueGame() external payable onlyPlayers {
        require(state == GameState.Active, "bad state");
        require(msg.value == STAKE, "stake");

        uint8 idx = uint8(uint256(int256(playerIndex(msg.sender))));
        _players[idx].committed = true;
        pot += msg.value;
        emit Continued(msg.sender);

        // When both committed, deal one to each
        if (_players[0].committed && _players[1].committed) {
            _players[0].committed = false;
            _players[1].committed = false;

            _dealCard(0);
            _dealCard(1);

            // If both at 5, go to reveal
            if (_players[0].cardCount == 5 && _players[1].cardCount == 5) {
                state = GameState.Reveal;
            }
        }
    }

    function fold() external onlyPlayers {
        require(state == GameState.Active, "bad state");
        // Pay opponent
        uint8 idx = uint8(uint256(int256(playerIndex(msg.sender))));
        uint8 opp = idx == 0 ? 1 : 0;
        address opponent = _players[opp].addr;
        require(opponent != address(0), "no opponent");

        uint256 amount = pot;
        pot = 0;
        state = GameState.Ended;
        winner = opponent;
        (bool ok, ) = opponent.call{value: amount}("");
        require(ok, "transfer");
        emit Folded(msg.sender, opponent, amount);
        emit Settled(opponent, amount);
    }

    // Request public decryption of both sums and settle in the callback
    function settleRequest() external onlyPlayers {
        require(state == GameState.Reveal, "bad state");

        // Compute sums as encrypted values
        _sum0 = _sumHand(_players[0]);
        _sum1 = _sumHand(_players[1]);

        // Allow this contract to use the sums
        FHE.allowThis(_sum0);
        FHE.allowThis(_sum1);

        // Ask oracle to decrypt the two sums and callback
        bytes32[] memory handles = new bytes32[](2);
        handles[0] = FHE.toBytes32(_sum0);
        handles[1] = FHE.toBytes32(_sum1);
        uint256 requestId = FHE.requestDecryption(handles, this.onSettle.selector);
        emit RevealRequested(requestId);
    }

    // Relayer callback with clear sums and KMS signatures
    function onSettle(uint256 requestId, uint16 clearSum0, uint16 clearSum1, bytes[] calldata signatures) external {
        // Verify signatures; also emits DecryptionFulfilled(requestId)
        FHE.checkSignatures(requestId, signatures);

        require(state == GameState.Reveal, "bad state");

        address p0 = _players[0].addr;
        address p1 = _players[1].addr;
        require(p0 != address(0) && p1 != address(0), "players");

        address win = clearSum0 >= clearSum1 ? p0 : p1;
        uint256 amount = pot;
        pot = 0;
        state = GameState.Ended;
        winner = win;
        (bool ok, ) = win.call{value: amount}("");
        require(ok, "transfer");
        emit Settled(win, amount);
    }

    // Convenience: make caller's cards publicly decryptable (optional)
    function makeMyCardsPublic() external onlyPlayers {
        uint8 idx = uint8(uint256(int256(playerIndex(msg.sender))));
        for (uint8 i = 0; i < _players[idx].cardCount; i++) {
            _players[idx].cards[i] = FHE.makePubliclyDecryptable(_players[idx].cards[i]);
        }
    }

    // --- Internals ---
    function _dealCard(uint8 idx) internal {
        require(idx < 2, "idx");
        Player storage p = _players[idx];
        require(p.addr != address(0), "player");
        require(p.cardCount < 5, "full");

        // Generate encrypted random card in [0,52)
        // Use power-of-two upper bound then reduce with remainder
        euint8 r = FHE.randEuint8(64);
        euint8 card = FHE.rem(r, 52);

        // Save and grant usage rights
        p.cards[p.cardCount] = card;
        p.cardCount += 1;

        // Allow player and this contract to use their card
        FHE.allow(card, p.addr);
        FHE.allowThis(card);

        emit Dealt(p.addr, p.cardCount);
    }

    function _sumHand(Player storage p) internal returns (euint16 total) {
        total = FHE.asEuint16(0);
        for (uint8 i = 0; i < p.cardCount; i++) {
            // Add euint8 card to euint16 accumulator (supported mixed-type add)
            total = FHE.add(total, p.cards[i]);
        }
        // Also allow both players to use the sum for optional decryptions
        FHE.allow(total, _players[0].addr);
        FHE.allow(total, _players[1].addr);
    }
}
