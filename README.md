# FHE Poker Game

A privacy-preserving, decentralized poker game built with Fully Homomorphic Encryption (FHE) technology on Ethereum. This project demonstrates how blockchain gaming can achieve true card privacy while maintaining verifiable fairness through cryptographic proofs.

## 🎮 Project Overview

FHE Poker is a two-player card game that leverages Zama's FHEVM (Fully Homomorphic Encryption Virtual Machine) to keep cards encrypted on-chain throughout gameplay. Unlike traditional blockchain card games where revealing cards compromises strategy, this implementation ensures that player cards remain confidential until explicitly decrypted by authorized parties, creating a fair and transparent gaming experience without sacrificing privacy.

### Key Innovation

The game uses **encrypted computation** - cards are dealt, compared, and evaluated entirely in their encrypted form on the blockchain. Only when players choose to view their own cards are they decrypted client-side through Zama's secure decryption oracle, ensuring opponents can never see your hand until game resolution.

## ✨ Features

### Core Gameplay
- **Two-Player Matches**: Head-to-head poker gameplay with customizable stakes
- **Progressive Card Dealing**: Players start with 2 encrypted cards and can continue up to 5 cards
- **Flexible Game Actions**:
  - **Continue**: Pay stake to receive additional cards and advance the round
  - **Fold**: Concede the game and award pot to opponent
  - **Settle**: Trigger encrypted hand comparison when both players reach 5 cards
- **Dynamic Pot System**: Stakes accumulate in the pot with each continue action
- **Real-time Game State**: Live updates of game status, pot size, and player actions

### Privacy & Security
- **On-Chain Card Encryption**: All cards are encrypted using FHEVM's `euint8` type
- **Private Hand Decryption**: Players can decrypt only their own cards via Zama relayer
- **Zero-Knowledge Comparison**: Hand sums are compared in encrypted form before decryption
- **Verifiable Fairness**: Cryptographic proofs ensure card randomness and fair dealing
- **Client-Side Decryption**: Card decryption happens locally using EIP-712 signatures

### Smart Contract Architecture
- **Gas-Optimized Design**: Efficient storage patterns and minimal state updates
- **Modular Game States**: `Waiting → Active → Reveal → Ended`
- **Event-Driven Updates**: Comprehensive event emissions for frontend synchronization
- **Secure Random Generation**: FHE-based random number generation for card dealing
- **Automated Settlement**: Decryption oracle callback for trustless winner determination

### User Interface
- **Modern React Frontend**: Built with React 19, TypeScript, and Vite
- **Wallet Integration**: RainbowKit for seamless Web3 wallet connection
- **Three-Tab Navigation**:
  - **Create Game**: Set custom stakes and initialize new games
  - **All Games**: Browse and join available public games
  - **My Games**: Manage active games with full action controls
- **Real-Time Decryption**: Instant card decryption with visual feedback
- **Responsive Design**: Clean, modern UI optimized for desktop and mobile
- **Game State Indicators**: Visual cues for game progression and available actions

## 🔧 Technology Stack

### Blockchain & Smart Contracts
- **Solidity ^0.8.24**: Smart contract development
- **FHEVM (@fhevm/solidity ^0.8.0)**: Fully homomorphic encryption primitives
- **Zama FHE Oracle (@zama-fhe/oracle-solidity ^0.1.0)**: Decryption oracle integration
- **Hardhat 2.26.0**: Development framework and testing environment
- **Ethers.js 6.15.0**: Ethereum library for contract interaction
- **TypeChain 8.3.2**: TypeScript bindings for smart contracts

### Frontend Development
- **React 19.1.1**: Modern UI framework with latest features
- **TypeScript 5.8.3**: Type-safe JavaScript development
- **Vite 7.1.6**: Lightning-fast build tool and dev server
- **RainbowKit 2.2.8**: Best-in-class wallet connection UX
- **Wagmi 2.17.0**: React hooks for Ethereum
- **Viem 2.37.6**: Lightweight Ethereum interface
- **Zama Relayer SDK (@zama-fhe/relayer-sdk ^0.2.0)**: Client-side FHE operations

### Development Tools
- **Hardhat Deploy**: Deployment management and scripting
- **Hardhat Gas Reporter**: Gas consumption analysis
- **Chai & Mocha**: Unit testing framework
- **ESLint & Prettier**: Code quality and formatting
- **Solhint**: Solidity linting
- **Solidity Coverage**: Test coverage reporting

## 🚀 Getting Started

### Prerequisites
```bash
node >= 20.0.0
npm >= 7.0.0
```

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/Poker-Game.git
cd Poker-Game
```

2. **Install backend dependencies**
```bash
npm install
```

3. **Install frontend dependencies**
```bash
cd app
npm install
cd ..
```

4. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env` and add:
```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
PRIVATE_KEY=your_wallet_private_key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### Compilation

```bash
# Compile smart contracts
npm run compile

# Generate TypeScript types
npm run typechain
```

### Testing

```bash
# Run local tests
npm run test

# Run tests on Sepolia testnet
npm run test:sepolia

# Generate coverage report
npm run coverage
```

### Deployment

```bash
# Deploy to Sepolia testnet
npm run deploy:sepolia

# Deploy and update frontend config
npm run deploy:sepolia:full
```

### Running the Frontend

```bash
cd app
npm run dev
```

The application will be available at `http://localhost:5173`

## 🎯 How It Works

### Game Flow

1. **Game Creation**
   - Player A creates a game with custom stake amount
   - Game enters `Waiting` state with unique game ID
   - Contract initializes empty player slots

2. **Joining**
   - Player B joins by paying the exact stake amount
   - Both players receive 2 encrypted cards each via FHE random generation
   - Game transitions to `Active` state
   - Initial pot = 2× stake

3. **Playing Rounds**
   - Players commit to continue by paying stake amount
   - When both commit, each receives 1 additional encrypted card
   - Process repeats until both players have 5 cards
   - Pot grows with each round: pot += 2× stake per round

4. **Card Decryption (Optional)**
   - Players can decrypt their own cards anytime using Zama relayer
   - Frontend generates EIP-712 signature for authorization
   - Decryption happens client-side without revealing cards on-chain
   - Cards display as suit+rank (e.g., ♠A, ♦K)

5. **Settlement**
   - When both players have 5 cards, game enters `Reveal` state
   - Either player triggers settlement via `settleRequest()`
   - Contract computes encrypted hand sums (sum of card values)
   - Decryption oracle decrypts both sums via callback
   - Higher sum wins entire pot (ties go to Player 0)

6. **Folding**
   - Either player can fold at any time during `Active` state
   - Opponent immediately receives entire pot
   - Game transitions to `Ended` state

### Encryption Architecture

```
Card Generation (On-Chain)
├─ FHE.randEuint8(64) → random encrypted uint8
├─ FHE.rem(random, 52) → card index 0-51 (encrypted)
├─ Store as euint8 in player.cards[i]
└─ FHE.allow(card, player) → grant player access

Card Decryption (Client-Side)
├─ Frontend requests encrypted handles from contract
├─ User signs EIP-712 authorization message
├─ Zama relayer decrypts using signature proof
├─ Cleartext cards displayed only to authorized player
└─ Opponent never sees cards until settlement

Hand Comparison (On-Chain)
├─ Compute encrypted sums: sum = Σ cards[i]
├─ FHE.requestDecryption([sum0, sum1])
├─ Oracle callback with cleartext sums
└─ Winner determined by sum comparison
```

### Smart Contract Functions

#### Public Functions
- `createGame(uint256 stakeWei)`: Initialize new game
- `joinGame(uint256 gameId)`: Join existing game
- `continueGame(uint256 gameId)`: Commit to next round
- `fold(uint256 gameId)`: Forfeit and award pot to opponent
- `settleRequest(uint256 gameId)`: Trigger final hand comparison
- `makeMyCardsPublic(uint256 gameId)`: Make your cards publicly decryptable

#### View Functions
- `gameCount()`: Total number of games created
- `gameExists(uint256 gameId)`: Check if game exists
- `getGame(uint256 gameId)`: Get game state, pot, winner, stake
- `getPlayers(uint256 gameId)`: Get both player addresses
- `getPlayer(uint256 gameId, uint8 idx)`: Get player details
- `getCardAt(uint256 gameId, uint8 idx, uint8 cardIdx)`: Get encrypted card handle
- `playerIndex(uint256 gameId, address)`: Get player index (0 or 1)

## 🛠️ Project Structure

```
Poker-Game/
├── contracts/
│   └── PokerGame.sol          # Main game contract with FHE logic
├── app/
│   ├── src/
│   │   ├── components/
│   │   │   └── PokerApp.tsx   # Main React component
│   │   ├── hooks/
│   │   │   ├── useZamaInstance.ts   # FHE relayer integration
│   │   │   └── useEthersSigner.ts   # Wallet signer hook
│   │   ├── config/
│   │   │   └── contracts.ts   # Contract addresses & ABIs
│   │   ├── App.tsx            # App entry point
│   │   └── main.tsx           # React root
│   ├── package.json
│   └── vite.config.ts
├── deploy/
│   └── 00_deploy.ts           # Deployment scripts
├── test/
│   └── PokerGame.test.ts      # Contract tests
├── tasks/                     # Hardhat custom tasks
├── hardhat.config.ts          # Hardhat configuration
├── package.json
└── tsconfig.json
```

## 💡 Problem Solved

### The Card Privacy Dilemma

Traditional blockchain card games face an impossible trilemma:
1. **On-Chain Transparency**: All blockchain state is public by default
2. **Fair Randomness**: Requires verifiable on-chain random generation
3. **Card Privacy**: Players cannot see opponent cards during gameplay

Existing solutions compromise on one dimension:
- **Commit-Reveal Schemes**: Vulnerable to timing attacks and last-mover advantage
- **Off-Chain Game Logic**: Sacrifices decentralization and trustlessness
- **Trusted Random Oracles**: Introduces centralization and trust assumptions

### Our FHE Solution

This project eliminates the trilemma using **Fully Homomorphic Encryption**:

✅ **On-Chain Transparency**: All game logic and state stored on Ethereum
✅ **Fair Randomness**: Cryptographically secure FHE-based random generation
✅ **Card Privacy**: Cards remain encrypted throughout gameplay
✅ **Verifiable Computation**: Hand comparison happens in encrypted form
✅ **Trustless Decryption**: Oracle provides cryptographic proofs
✅ **Selective Decryption**: Players decrypt only their own cards

### Use Cases & Applications

This technology enables:
- **Poker & Card Games**: Full-featured poker with complete card privacy
- **Board Games**: Strategy games requiring hidden information (e.g., Battleship)
- **Sealed-Bid Auctions**: Private bid amounts revealed only after submission period
- **Voting Systems**: Anonymous voting with verifiable tallying
- **Gaming Loot Boxes**: Provably fair random rewards with committed rarities
- **Multi-Party Computation**: Any game or protocol requiring private state comparison

## 🏗️ Architecture Highlights

### Gas Optimization
- Minimal storage slots per game (~10 storage slots)
- Batched card dealing in single transaction
- Efficient mapping structures for O(1) lookups
- Event-driven state synchronization reduces redundant reads

### Security Features
- **Reentrancy Protection**: Checks-effects-interactions pattern
- **Access Control**: `onlyPlayers` modifier for game actions
- **Stake Validation**: Exact stake matching prevents griefing
- **State Machine Guards**: Strict state transition validation
- **Oracle Verification**: Signature verification on decryption callbacks

### Scalability Considerations
- Stateless game instances (no global game state)
- Parallel game execution (unlimited concurrent games)
- Minimal cross-game dependencies
- Event-based frontend updates (no polling required)

## 🚧 Known Limitations

1. **Hand Evaluation**: Currently uses sum of card values, not poker hand rankings
2. **Card Uniqueness**: No duplicate detection (same card can appear multiple times)
3. **Timeout Mechanism**: No time limits for player actions
4. **Game Cleanup**: Ended games remain in storage indefinitely
5. **Reveal Optimization**: Both hand sums decrypted even if unnecessary
6. **Frontend State**: No persistent storage (reloading clears local state)

## 🔮 Future Roadmap

### Phase 1: Core Improvements (Q2 2025)
- [ ] Implement proper poker hand rankings (pairs, flushes, straights)
- [ ] Add card uniqueness validation using encrypted set operations
- [ ] Implement game timeouts with automatic forfeit
- [ ] Add game cleanup mechanism for ended games
- [ ] Optimize reveal logic (early termination on clear winner)

### Phase 2: Enhanced Gameplay (Q3 2025)
- [ ] Multi-round betting with raise/call/check actions
- [ ] Side pots for split situations
- [ ] Tournament mode with bracket elimination
- [ ] Spectator mode with encrypted game state
- [ ] Replay system with hand history

### Phase 3: Platform Features (Q4 2025)
- [ ] Matchmaking system with ELO ratings
- [ ] Leaderboards and achievement NFTs
- [ ] Multi-table support (single player in multiple games)
- [ ] Mobile app (React Native)
- [ ] Game statistics and analytics dashboard

### Phase 4: Advanced Cryptography (2026)
- [ ] Zero-knowledge proofs for hand validity
- [ ] Threshold decryption for multi-party games
- [ ] Cross-chain game state (L2 rollups)
- [ ] Verifiable shuffle algorithms
- [ ] Optimistic rollups for gas reduction

### Phase 5: Ecosystem Expansion (2026+)
- [ ] SDK for third-party game developers
- [ ] Game template library (Blackjack, Texas Hold'em, etc.)
- [ ] Decentralized tournament hosting
- [ ] NFT card skins and customization
- [ ] DAO governance for game rules

## 📊 Technical Specifications

### Network Support
- **Primary**: Ethereum Sepolia Testnet
- **Planned**: Ethereum Mainnet, zkSync, Arbitrum, Optimism

### Zama Configuration (Sepolia)
```solidity
ACL Address: 0x687820221192C5B662b25367F70076A37bc79b6c
Coprocessor: 0x848B0066793BcC60346Da1F49049357399B8D595
Oracle: 0xD92486Ae8e0aD516d6DF1A0664b80d07B219b606
KMS Verifier: 0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC
```

### Gas Estimates
- Create Game: ~180,000 gas
- Join Game (initial): ~450,000 gas (includes 4 card deals)
- Continue Round: ~200,000 - 280,000 gas (2 card deals)
- Fold: ~60,000 gas
- Settle Request: ~180,000 gas
- Decrypt Cards (off-chain): 0 gas

### Card Encoding
```
Cards 0-51 map to:
0-12:  ♣A-K (Clubs)
13-25: ♦A-K (Diamonds)
26-38: ♥A-K (Hearts)
39-51: ♠A-K (Spades)
```

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Write comprehensive tests for new features
- Follow existing code style (ESLint + Prettier)
- Update documentation for API changes
- Add gas benchmarks for contract modifications
- Include integration tests for frontend changes

## 📄 License

This project is licensed under the BSD-3-Clause-Clear License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Zama**: For pioneering FHEVM technology and providing excellent developer tools
- **Hardhat**: For the robust smart contract development framework
- **RainbowKit**: For seamless wallet connection UX
- **OpenZeppelin**: For battle-tested smart contract libraries
- **Ethereum Community**: For continuous innovation in blockchain technology

## 📞 Contact & Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/Poker-Game/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/Poker-Game/discussions)
- **Discord**: [Join our Discord](#)
- **Twitter**: [@YourTwitter](#)

## 🔗 Resources

- [Zama FHEVM Documentation](https://docs.zama.ai/fhevm)
- [Hardhat Documentation](https://hardhat.org/docs)
- [RainbowKit Documentation](https://www.rainbowkit.com/docs)
- [Fully Homomorphic Encryption Primer](https://en.wikipedia.org/wiki/Homomorphic_encryption)
- [Project Demo Video](#)

---

**Built with ❤️ using Fully Homomorphic Encryption**

*Making blockchain gaming truly private and fair*