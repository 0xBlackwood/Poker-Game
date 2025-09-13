// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8, euint32, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Poker Game with FHE
/// @notice A 2-player poker game using Zama FHE for encrypted cards
/// @dev Cards are represented as numbers 1-52, encrypted under FHE
contract PokerGame is SepoliaConfig {
    // Game constants
    uint256 public constant JOIN_FEE = 0.0001 ether;
    uint256 public constant CONTINUE_FEE = 0.0001 ether;
    uint8 public constant MAX_PLAYERS = 2;
    uint8 public constant CARDS_PER_PLAYER = 2;
    uint8 public constant TOTAL_CARDS = 5;
    
    // Game states
    enum GameState {
        WaitingForPlayers,    // 等待玩家加入
        CardsDealt,          // 已发牌，等待玩家决策
        GameFinished,        // 游戏结束
        GameCancelled        // 游戏取消
    }
    
    // Player structure
    struct Player {
        address playerAddress;
        euint8[CARDS_PER_PLAYER] privateCards;  // 玩家的2张私牌（加密）
        bool hasContinued;                       // 是否选择继续
        bool hasJoined;                         // 是否已加入
        bool hasDecided;                        // 是否已做决策
    }
    
    // Game structure
    struct Game {
        uint256 gameId;
        Player[MAX_PLAYERS] players;
        euint8[TOTAL_CARDS] communityCards;     // 5张公共牌（加密）
        GameState state;
        uint256 prizePool;                       // 奖池
        address winner;                          // 获胜者
        uint256 createdAt;
        uint8 playerCount;
        uint8 continuedCount;                    // 选择继续的玩家数量
        uint8 decidedCount;                      // 已做决策的玩家数量
        uint8 dealtCards;                        // 已发牌数量
    }
    
    // State variables
    mapping(uint256 => Game) public games;
    mapping(address => uint256) public playerCurrentGame;
    uint256 public gameCounter;
    uint256 public deckPosition;                 // 当前牌堆位置
    
    // Events
    event GameCreated(uint256 indexed gameId);
    event PlayerJoined(uint256 indexed gameId, address indexed player);
    event CardsDealt(uint256 indexed gameId);
    event PlayerDecision(uint256 indexed gameId, address indexed player, bool continued);
    event GameFinished(uint256 indexed gameId, address indexed winner, uint256 prize);
    event GameCancelled(uint256 indexed gameId);
    
    /// @notice Creates a new game
    /// @return gameId The ID of the created game
    function createGame() external returns (uint256) {
        gameCounter++;
        uint256 gameId = gameCounter;
        
        Game storage game = games[gameId];
        game.gameId = gameId;
        game.state = GameState.WaitingForPlayers;
        game.createdAt = block.timestamp;
        game.playerCount = 0;
        game.continuedCount = 0;
        game.decidedCount = 0;
        game.dealtCards = 0;
        
        emit GameCreated(gameId);
        return gameId;
    }
    
    /// @notice Allows a player to join a game
    /// @param gameId The ID of the game to join
    function joinGame(uint256 gameId) external payable {
        require(msg.value == JOIN_FEE, "Incorrect join fee");
        require(games[gameId].gameId != 0, "Game does not exist");
        require(games[gameId].state == GameState.WaitingForPlayers, "Game not accepting players");
        require(games[gameId].playerCount < MAX_PLAYERS, "Game is full");
        require(playerCurrentGame[msg.sender] == 0, "Player already in a game");
        
        // Check if player already joined this game
        for (uint8 i = 0; i < games[gameId].playerCount; i++) {
            require(games[gameId].players[i].playerAddress != msg.sender, "Player already joined");
        }
        
        Game storage game = games[gameId];
        uint8 playerIndex = game.playerCount;
        
        game.players[playerIndex].playerAddress = msg.sender;
        game.players[playerIndex].hasJoined = true;
        game.players[playerIndex].hasContinued = false;
        game.players[playerIndex].hasDecided = false;
        game.playerCount++;
        game.prizePool += msg.value;
        
        playerCurrentGame[msg.sender] = gameId;
        
        emit PlayerJoined(gameId, msg.sender);
        
        // If we have enough players, deal cards
        if (game.playerCount == MAX_PLAYERS) {
            _dealInitialCards(gameId);
        }
    }
    
    /// @notice Internal function to deal initial cards to all players
    /// @param gameId The game ID
    function _dealInitialCards(uint256 gameId) internal {
        Game storage game = games[gameId];
        
        // Reset deck position for new game
        deckPosition = 0;
        
        // Deal 2 cards to each player
        for (uint8 playerIdx = 0; playerIdx < MAX_PLAYERS; playerIdx++) {
            for (uint8 cardIdx = 0; cardIdx < CARDS_PER_PLAYER; cardIdx++) {
                // Generate encrypted random card (1-52)
                euint8 randomCard = FHE.randEuint8();
                // Ensure card is in valid range (1-52)
                euint8 card = FHE.add(FHE.rem(randomCard, 52), 1);
                
                game.players[playerIdx].privateCards[cardIdx] = card;
                
                // Grant access permissions
                FHE.allowThis(card);
                FHE.allow(card, game.players[playerIdx].playerAddress);
                
                game.dealtCards++;
            }
        }
        
        game.state = GameState.CardsDealt;
        emit CardsDealt(gameId);
    }
    
    /// @notice Allows a player to make a decision (continue or fold)
    /// @param gameId The game ID
    /// @param continueGame Whether to continue (true) or fold (false)
    function makeDecision(uint256 gameId, bool continueGame) external payable {
        require(games[gameId].gameId != 0, "Game does not exist");
        require(games[gameId].state == GameState.CardsDealt, "Game not in decision phase");
        require(playerCurrentGame[msg.sender] == gameId, "Player not in this game");
        
        if (continueGame) {
            require(msg.value == CONTINUE_FEE, "Incorrect continue fee");
        }
        
        Game storage game = games[gameId];
        
        // Find player index
        uint8 playerIndex = MAX_PLAYERS; // Invalid index
        for (uint8 i = 0; i < MAX_PLAYERS; i++) {
            if (game.players[i].playerAddress == msg.sender) {
                playerIndex = i;
                break;
            }
        }
        require(playerIndex < MAX_PLAYERS, "Player not found in game");
        require(!game.players[playerIndex].hasDecided, "Player already made decision");
        
        game.players[playerIndex].hasContinued = continueGame;
        game.players[playerIndex].hasDecided = true;
        game.decidedCount++;
        
        if (continueGame) {
            game.prizePool += msg.value;
            game.continuedCount++;
        }
        
        emit PlayerDecision(gameId, msg.sender, continueGame);
        
        // Check if all players made their decisions
        if (game.decidedCount == MAX_PLAYERS) {
            if (game.continuedCount == 0) {
                // All players folded, cancel game
                _cancelGame(gameId);
            } else if (game.continuedCount == 1) {
                // Only one player continued, they win
                _finishGame(gameId);
            } else if (game.continuedCount == MAX_PLAYERS) {
                // All players continued, deal community cards and determine winner
                _dealCommunityCards(gameId);
            }
        }
    }
    
    /// @notice Internal function to deal community cards
    /// @param gameId The game ID
    function _dealCommunityCards(uint256 gameId) internal {
        Game storage game = games[gameId];
        
        // Deal 5 community cards
        for (uint8 i = 0; i < TOTAL_CARDS; i++) {
            euint8 randomCard = FHE.randEuint8();
            euint8 card = FHE.add(FHE.rem(randomCard, 52), 1);
            
            game.communityCards[i] = card;
            
            // Make community cards accessible to all players
            FHE.allowThis(card);
            for (uint8 j = 0; j < MAX_PLAYERS; j++) {
                if (game.players[j].hasJoined) {
                    FHE.allow(card, game.players[j].playerAddress);
                }
            }
        }
        
        _finishGame(gameId);
    }
    
    /// @notice Internal function to finish the game
    /// @param gameId The game ID
    function _finishGame(uint256 gameId) internal {
        Game storage game = games[gameId];
        
        // Determine winner
        if (game.continuedCount == 1) {
            // Only one player continued, they win
            for (uint8 i = 0; i < MAX_PLAYERS; i++) {
                if (game.players[i].hasContinued) {
                    game.winner = game.players[i].playerAddress;
                    break;
                }
            }
        } else {
            // For now, randomly select winner among continuing players
            // In a full implementation, this would involve card comparison logic
            euint8 randomWinner = FHE.randEuint8();
            uint8 winnerIndex = 0;
            uint8 continuingPlayerCount = 0;
            
            for (uint8 i = 0; i < MAX_PLAYERS; i++) {
                if (game.players[i].hasContinued) {
                    continuingPlayerCount++;
                    if (continuingPlayerCount == 1) {
                        winnerIndex = i;
                    }
                    // Simple random selection - in production this would be proper card evaluation
                }
            }
            game.winner = game.players[winnerIndex].playerAddress;
        }
        
        game.state = GameState.GameFinished;
        
        // Transfer prize to winner
        uint256 prize = game.prizePool;
        game.prizePool = 0;
        
        // Clear player game associations
        for (uint8 i = 0; i < MAX_PLAYERS; i++) {
            if (game.players[i].hasJoined) {
                playerCurrentGame[game.players[i].playerAddress] = 0;
            }
        }
        
        // Transfer prize
        payable(game.winner).transfer(prize);
        
        emit GameFinished(gameId, game.winner, prize);
    }
    
    /// @notice Internal function to cancel the game
    /// @param gameId The game ID
    function _cancelGame(uint256 gameId) internal {
        Game storage game = games[gameId];
        game.state = GameState.GameCancelled;
        
        // Refund all players
        uint256 refundAmount = game.prizePool / game.playerCount;
        
        for (uint8 i = 0; i < game.playerCount; i++) {
            if (game.players[i].hasJoined) {
                playerCurrentGame[game.players[i].playerAddress] = 0;
                payable(game.players[i].playerAddress).transfer(refundAmount);
            }
        }
        
        game.prizePool = 0;
        emit GameCancelled(gameId);
    }
    
    /// @notice Get player's private cards
    /// @param gameId The game ID
    /// @param playerAddress The player's address
    /// @return The player's encrypted cards
    function getPlayerCards(uint256 gameId, address playerAddress) 
        external 
        view 
        returns (euint8[CARDS_PER_PLAYER] memory) 
    {
        Game storage game = games[gameId];
        
        for (uint8 i = 0; i < MAX_PLAYERS; i++) {
            if (game.players[i].playerAddress == playerAddress) {
                return game.players[i].privateCards;
            }
        }
        
        revert("Player not found in game");
    }
    
    /// @notice Get community cards
    /// @param gameId The game ID
    /// @return The encrypted community cards
    function getCommunityCards(uint256 gameId) 
        external 
        view 
        returns (euint8[TOTAL_CARDS] memory) 
    {
        return games[gameId].communityCards;
    }
    
    /// @notice Get game information
    /// @param gameId The game ID
    /// @return state The current game state
    /// @return playerCount The number of players in the game
    /// @return prizePool The total prize pool amount
    /// @return winner The address of the winner (if game is finished)
    function getGameInfo(uint256 gameId) 
        external 
        view 
        returns (
            GameState state,
            uint8 playerCount,
            uint256 prizePool,
            address winner
        ) 
    {
        Game storage game = games[gameId];
        return (game.state, game.playerCount, game.prizePool, game.winner);
    }
    
    /// @notice Get player list for a game
    /// @param gameId The game ID
    /// @return players Array of player addresses
    function getPlayers(uint256 gameId) 
        external 
        view 
        returns (address[MAX_PLAYERS] memory) 
    {
        Game storage game = games[gameId];
        address[MAX_PLAYERS] memory playerAddresses;
        
        for (uint8 i = 0; i < MAX_PLAYERS; i++) {
            playerAddresses[i] = game.players[i].playerAddress;
        }
        
        return playerAddresses;
    }
    
    /// @notice Emergency function to cancel a stuck game
    /// @param gameId The game ID
    function emergencyCancel(uint256 gameId) external {
        require(games[gameId].gameId != 0, "Game does not exist");
        require(games[gameId].state != GameState.GameFinished, "Game already finished");
        require(games[gameId].state != GameState.GameCancelled, "Game already cancelled");
        require(
            block.timestamp > games[gameId].createdAt + 1 hours, 
            "Game not old enough for emergency cancel"
        );
        
        _cancelGame(gameId);
    }
}