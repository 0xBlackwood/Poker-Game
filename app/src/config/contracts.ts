// PokerGame contract (update address after deploy)
export const CONTRACT_ADDRESS = '0x1761cd63F3015B0d9177Cc9C59F225FA96dc27E3';

// ABI for PokerGame.sol (synced from deployments/sepolia/PokerGame.json)
export const CONTRACT_ABI = [
  { "inputs": [], "name": "HandlesAlreadySavedForRequestID", "type": "error" },
  { "inputs": [], "name": "InvalidKMSSignatures", "type": "error" },
  { "inputs": [], "name": "NoHandleFoundForRequestID", "type": "error" },
  { "inputs": [], "name": "UnsupportedHandleType", "type": "error" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "player", "type": "address" }], "name": "Continued", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "player", "type": "address" }, { "indexed": false, "internalType": "uint8", "name": "newCount", "type": "uint8" }], "name": "Dealt", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "requestID", "type": "uint256" }], "name": "DecryptionFulfilled", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "player", "type": "address" }, { "indexed": true, "internalType": "address", "name": "opponent", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "Folded", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "player", "type": "address" }, { "indexed": false, "internalType": "uint8", "name": "index", "type": "uint8" }], "name": "Joined", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint256", "name": "requestId", "type": "uint256" }], "name": "RevealRequested", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "winner", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "Settled", "type": "event" },
  { "inputs": [], "name": "STAKE", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "continueGame", "outputs": [], "stateMutability": "payable", "type": "function" },
  { "inputs": [], "name": "fold", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint8", "name": "idx", "type": "uint8" }, { "internalType": "uint8", "name": "cardIdx", "type": "uint8" }], "name": "getCardAt", "outputs": [{ "internalType": "euint8", "name": "", "type": "bytes32" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint8", "name": "idx", "type": "uint8" }], "name": "getPlayer", "outputs": [{ "internalType": "address", "name": "addr", "type": "address" }, { "internalType": "uint8", "name": "cardCount", "type": "uint8" }, { "internalType": "bool", "name": "committed", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "joinGame", "outputs": [], "stateMutability": "payable", "type": "function" },
  { "inputs": [], "name": "makeMyCardsPublic", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "requestId", "type": "uint256" }, { "internalType": "uint16", "name": "clearSum0", "type": "uint16" }, { "internalType": "uint16", "name": "clearSum1", "type": "uint16" }, { "internalType": "bytes[]", "name": "signatures", "type": "bytes[]" }], "name": "onSettle", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "a", "type": "address" }], "name": "playerIndex", "outputs": [{ "internalType": "int8", "name": "", "type": "int8" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "pot", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "settleRequest", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "state", "outputs": [{ "internalType": "enum PokerGame.GameState", "name": "", "type": "uint8" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "winner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }
] as const;
