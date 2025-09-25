// PokerGame contract (update address after deploy)
export const CONTRACT_ADDRESS = '0x680B69360365138A7fE2D926d04b47a8CC8a5e08';

// ABI for PokerGame.sol (synced from deployments/sepolia/PokerGame.json)
export const CONTRACT_ABI = [
  { "inputs": [], "stateMutability": "nonpayable", "type": "constructor" },
  { "inputs": [], "name": "HandlesAlreadySavedForRequestID", "type": "error" },
  { "inputs": [], "name": "InvalidKMSSignatures", "type": "error" },
  { "inputs": [], "name": "NoHandleFoundForRequestID", "type": "error" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "gameId", "type": "uint256" }, { "indexed": true, "internalType": "address", "name": "player", "type": "address" }], "name": "Continued", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "gameId", "type": "uint256" }, { "indexed": true, "internalType": "address", "name": "player", "type": "address" }, { "indexed": false, "internalType": "uint8", "name": "newCount", "type": "uint8" }], "name": "Dealt", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "requestID", "type": "uint256" }], "name": "DecryptionFulfilled", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "gameId", "type": "uint256" }, { "indexed": true, "internalType": "address", "name": "player", "type": "address" }, { "indexed": true, "internalType": "address", "name": "opponent", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "Folded", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "gameId", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "stake", "type": "uint256" }], "name": "GameCreated", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "gameId", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "requestId", "type": "uint256" }], "name": "RevealRequested", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "gameId", "type": "uint256" }, { "indexed": true, "internalType": "address", "name": "winner", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "Settled", "type": "event" },
  { "inputs": [], "name": "DEFAULT_STAKE", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "gameId", "type": "uint256" }], "name": "continueGame", "outputs": [], "stateMutability": "payable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "stakeWei", "type": "uint256" }], "name": "createGame", "outputs": [{ "internalType": "uint256", "name": "gameId", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "gameId", "type": "uint256" }], "name": "fold", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "gameId", "type": "uint256" }, { "internalType": "uint8", "name": "idx", "type": "uint8" }, { "internalType": "uint8", "name": "cardIdx", "type": "uint8" }], "name": "getCardAt", "outputs": [{ "internalType": "euint8", "name": "", "type": "bytes32" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "gameId", "type": "uint256" }], "name": "getGame", "outputs": [{ "internalType": "uint8", "name": "state", "type": "uint8" }, { "internalType": "uint256", "name": "pot", "type": "uint256" }, { "internalType": "address", "name": "winner", "type": "address" }, { "internalType": "uint256", "name": "stake", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "gameId", "type": "uint256" }, { "internalType": "uint8", "name": "idx", "type": "uint8" }], "name": "getPlayer", "outputs": [{ "internalType": "address", "name": "addr", "type": "address" }, { "internalType": "uint8", "name": "cardCount", "type": "uint8" }, { "internalType": "bool", "name": "committed", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "gameId", "type": "uint256" }], "name": "getStake", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "gameId", "type": "uint256" }], "name": "joinGame", "outputs": [], "stateMutability": "payable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "gameId", "type": "uint256" }], "name": "makeMyCardsPublic", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "nextGameId", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "requestId", "type": "uint256" }, { "internalType": "bytes", "name": "cleartexts", "type": "bytes" }, { "internalType": "bytes", "name": "decryptionProof", "type": "bytes" }], "name": "onSettle", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "gameId", "type": "uint256" }, { "internalType": "address", "name": "a", "type": "address" }], "name": "playerIndex", "outputs": [{ "internalType": "int8", "name": "", "type": "int8" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "gameId", "type": "uint256" }], "name": "settleRequest", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
] as const;
