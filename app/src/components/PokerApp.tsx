import { useEffect, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { Contract, formatEther } from 'ethers';
import '../App.css';

export function PokerApp() {
  const { address, isConnected } = useAccount();
  const signerPromise = useEthersSigner();

  const [txBusy, setTxBusy] = useState<string | null>(null);
  const [createStakeEth, setCreateStakeEth] = useState<string>('0.0001');
  const [createdId, setCreatedId] = useState<string>('');
  const [tab, setTab] = useState<'create'|'all'|'mine'>('create');

  // No read/join/continue/fold here. Create page only.

  const createGame = async () => {
    const signer = await signerPromise;
    if (!signer) throw new Error('No signer');
    const c = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    const wei = (await import('ethers')).parseEther(createStakeEth || '0');
    setTxBusy('create');
    try {
      const tx = await (c as any).createGame(wei);
      await tx.wait();
      // read nextGameId and set current = next - 1
      const client = (await import('viem')).createPublicClient({ chain: (await import('wagmi/chains')).sepolia, transport: (await import('viem')).http() });
      const next: bigint = await client.readContract({ address: CONTRACT_ADDRESS as any, abi: CONTRACT_ABI as any, functionName: 'nextGameId', args: [] }) as any;
      setCreatedId(String(next - 1n));
    } finally {
      setTxBusy(null);
    }
  };


  return (
    <div className="container">
      <header className="toolbar">
        <div style={{ fontWeight: 700 }}>FHE Poker</div>
        <ConnectButton />
      </header>

      {/* Game Rules */}
      <section className="panel">
        <h3>🎮 Game Rules</h3>
        <div className="row" style={{alignItems:'flex-start', margin: 0}}>
          <div style={{maxWidth: '100%'}}>
            <ul>
              <li><strong>Two-Player Game:</strong> Each game is designed for exactly 2 players.</li>
              <li><strong>Stakes & Costs:</strong> Game creator sets the stake. Joining costs 1x stake, continuing rounds costs 1x stake.</li>
              <li><strong>Card System:</strong> Players start with 2 encrypted cards. When both continue, each receives additional cards.</li>
              <li><strong>Winning Condition:</strong> At 5 cards each, the game moves to reveal phase. Player with higher hand sum wins the pot.</li>
              <li><strong>Folding:</strong> Fold anytime to concede and award the current pot to your opponent.</li>
              <li><strong>Privacy:</strong> All cards are encrypted on-chain. Use "Decrypt My Cards" to view your hand locally via Zama relayer.</li>
              <li><strong>Navigation:</strong> Create games here, browse all games in "All Games", manage your active games in "My Games".</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="tab-nav">
          <button className={tab === 'create' ? 'primary' : 'secondary'} onClick={()=>setTab('create')}>
            🎯 Create Game
          </button>
          <button className={tab === 'all' ? 'primary' : 'secondary'} onClick={()=>setTab('all')}>
            🌐 All Games
          </button>
          <button className={tab === 'mine' ? 'primary' : 'secondary'} onClick={()=>setTab('mine')}>
            👤 My Games
          </button>
        </div>
        {tab==='create' && (
          <div className="row">
            <div className="game-info">
              <div className="game-meta">Contract: {CONTRACT_ADDRESS || '(set after deploy)'}</div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
                <input
                  placeholder="Stake (ETH)"
                  value={createStakeEth}
                  onChange={e=>setCreateStakeEth(e.target.value)}
                />
                <button
                  className="primary"
                  onClick={createGame}
                  disabled={!isConnected || txBusy==='create'}
                >
                  {txBusy === 'create' ? '⏳ Creating...' : '✨ Create Game'}
                </button>
              </div>
              {createdId && (
                <div className="game-title" style={{ marginTop: '1rem', color: 'var(--success)' }}>
                  🎉 Created Game ID: {createdId}
                </div>
              )}
            </div>
          </div>
        )}

        {tab==='all' && (
          <AllGames address={address as any} />
        )}

        {tab==='mine' && (
          <MyGames address={address as any} />
        )}
      </section>
    </div>
  );
}

function AllGames({ address }: { address?: `0x${string}` }) {
  const [items, setItems] = useState<any[]>([]);
  const signerPromise = useEthersSigner();
  const [joining, setJoining] = useState<string>('');
  useEffect(() => { (async () => {
    const client = (await import('viem')).createPublicClient({ chain: (await import('wagmi/chains')).sepolia, transport: (await import('viem')).http() });
    const count: bigint = await client.readContract({ address: CONTRACT_ADDRESS as any, abi: CONTRACT_ABI as any, functionName: 'gameCount', args: [] }) as any;
    const list: any[] = [];
    for (let i=0n;i<count;i++) {
      const exists: boolean = await client.readContract({ address: CONTRACT_ADDRESS as any, abi: CONTRACT_ABI as any, functionName: 'gameExists', args: [i] }) as any;
      if (!exists) continue;
      const g: any = await client.readContract({ address: CONTRACT_ADDRESS as any, abi: CONTRACT_ABI as any, functionName: 'getGame', args: [i] });
      const players: any = await client.readContract({ address: CONTRACT_ADDRESS as any, abi: CONTRACT_ABI as any, functionName: 'getPlayers', args: [i] });
      list.push({ id: i, state: Number(g[0]), pot: g[1], winner: g[2], stake: g[3], p0: players[0], p1: players[1] });
    }
    setItems(list);
  })(); }, [address]);

  const getStateLabel = (state: number) => {
    const states = ['🆕 New', '🎮 Playing', '⏳ Waiting', '🏆 Finished'];
    return states[state] || '❓ Unknown';
  };

  const join = async (id: bigint, stake: bigint, p0: string, p1: string) => {
    const lower = (s: string) => (s||'').toLowerCase();
    if (!address || lower(address)===lower(p0) || lower(address)===lower(p1)) return;
    setJoining(id.toString());
    try {
      const signer = await signerPromise;
      if (!signer) throw new Error('No signer');
      const c = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const est = await (c as any).estimateGas.joinGame(id, { value: stake });
      let gasLimit = (est as bigint) * 2n;
      if (gasLimit < 200000n) gasLimit = 200000n;
      const tx = await (c as any).joinGame(id, { value: stake, gasLimit });
      await tx.wait();
      // refresh list quickly for this id
      const client = (await import('viem')).createPublicClient({ chain: (await import('wagmi/chains')).sepolia, transport: (await import('viem')).http() });
      const g: any = await client.readContract({ address: CONTRACT_ADDRESS as any, abi: CONTRACT_ABI as any, functionName: 'getGame', args: [id] });
      const players: any = await client.readContract({ address: CONTRACT_ADDRESS as any, abi: CONTRACT_ABI as any, functionName: 'getPlayers', args: [id] });
      setItems(prev => prev.map(x => x.id===id ? { id, state: Number(g[0]), pot: g[1], winner: g[2], stake: g[3], p0: players[0], p1: players[1] } : x));
    } finally {
      setJoining('');
    }
  };

  return (
    <div>
      <h3>🌐 All Games</h3>
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
          No games found. Create the first game! 🎯
        </div>
      ) : (
        items.map(x=> (
          <div key={String(x.id)} className="row" style={{justifyContent:'space-between'}}>
            <div className="game-info">
              <div className="game-title">🎲 Game #{x.id.toString()}</div>
              <div className="game-meta">
                {getStateLabel(x.state)} • 💰 Stake: {formatEther(x.stake)} ETH • 🏆 Pot: {formatEther(x.pot)} ETH
              </div>
              <div className="game-meta">
                👥 Players: {x.p0 ? `${x.p0.slice(0,6)}...${x.p0.slice(-4)}` : 'Empty'} vs {x.p1 ? `${x.p1.slice(0,6)}...${x.p1.slice(-4)}` : 'Empty'}
              </div>
            </div>
            <div>
              {(() => {
                const emptyAddr = '0x0000000000000000000000000000000000000000';
                const slotOpen = (x.p0 === emptyAddr) || (x.p1 === emptyAddr);
                const notEnded = x.state !== 3;
                const canJoin = !!address && slotOpen && notEnded;
                return (
                  <button
                    className="primary"
                    disabled={!canJoin || joining===x.id.toString()}
                    onClick={()=>join(x.id, x.stake, x.p0, x.p1)}
                  >
                    {joining===x.id.toString() ? '⏳ Joining...' : 'Join'}
                  </button>
                );
              })()}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function MyGames({ address }: { address?: `0x${string}` }) {
  const [items, setItems] = useState<any[]>([]);
  const [decrypting, setDecrypting] = useState<string>('');
  const { instance } = useZamaInstance();
  const signerPromise = useEthersSigner();
  useEffect(() => { if (!address) { setItems([]); return; } (async () => {
    const client = (await import('viem')).createPublicClient({ chain: (await import('wagmi/chains')).sepolia, transport: (await import('viem')).http() });
    const count: bigint = await client.readContract({ address: CONTRACT_ADDRESS as any, abi: CONTRACT_ABI as any, functionName: 'gameCount', args: [] }) as any;
    const list: any[] = [];
    for (let i=0n;i<count;i++) {
      const exists: boolean = await client.readContract({ address: CONTRACT_ADDRESS as any, abi: CONTRACT_ABI as any, functionName: 'gameExists', args: [i] }) as any;
      if (!exists) continue;
      const idx: bigint = await client.readContract({ address: CONTRACT_ADDRESS as any, abi: CONTRACT_ABI as any, functionName: 'playerIndex', args: [i, address] }) as any;
      if (Number(idx) < 0) continue;
      const g: any = await client.readContract({ address: CONTRACT_ADDRESS as any, abi: CONTRACT_ABI as any, functionName: 'getGame', args: [i] });
      const p: any = await client.readContract({ address: CONTRACT_ADDRESS as any, abi: CONTRACT_ABI as any, functionName: 'getPlayer', args: [i, Number(idx)] });
      list.push({ id: i, state: Number(g[0]), pot: g[1], winner: g[2], stake: g[3], idx: Number(idx), cardCount: Number(p[1]), cards: [] });
    }
    setItems(list);
  })(); }, [address]);

  const decryptCards = async (id: bigint, idx: number) => {
    if (!instance || !address) return;
    setDecrypting(id.toString());
    try {
      const client = (await import('viem')).createPublicClient({ chain: (await import('wagmi/chains')).sepolia, transport: (await import('viem')).http() });
      const p: any = await client.readContract({ address: CONTRACT_ADDRESS as any, abi: CONTRACT_ABI as any, functionName: 'getPlayer', args: [id, idx] });
      const count = Number(p[1]);
      const handles: `0x${string}`[] = [] as any;
      for (let i=0;i<count;i++) {
        const h = await client.readContract({ address: CONTRACT_ADDRESS as any, abi: CONTRACT_ABI as any, functionName: 'getCardAt', args: [id, idx, i] }) as any;
        handles.push(h);
      }
      console.log('decryptCards: gameId', id.toString(), 'idx', idx, 'handles', handles);
      const pairs = handles.map(h => ({ handle: h, contractAddress: CONTRACT_ADDRESS }));
      const keypair = instance.generateKeypair();
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = "10";
      const contractAddresses = [CONTRACT_ADDRESS];
      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
      const signer = await signerPromise;
      if (!signer) throw new Error('No signer');
      const signature = await signer.signTypedData(eip712.domain, { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification }, eip712.message);
      const result = await instance.userDecrypt(pairs, keypair.privateKey, keypair.publicKey, signature.replace('0x',''), contractAddresses, address, startTimeStamp, durationDays);
      console.log('decryptCards: raw result', result);
      const arr = Array.isArray(result)
        ? result
        : (Array.isArray((result as any)?.results) ? (result as any).results
          : Array.isArray((result as any)?.cleartexts) ? (result as any).cleartexts
          : Array.isArray((result as any)?.data) ? (result as any).data
          : Array.isArray((result as any)?.values) ? (result as any).values
          : [result]);
      console.log('decryptCards: normalized array', arr);
      const toNum = (x:any): number => {
        const t = typeof x;
        if (t === 'number') return x as number;
        if (t === 'bigint') return Number(x as bigint);
        if (t === 'string') {
          const s = x as string;
          const n = s.startsWith('0x') ? parseInt(s, 16) : parseInt(s, 10);
          return Number.isNaN(n) ? 0 : n;
        }
        try {
          const s = String(x);
          const n = s.startsWith('0x') ? parseInt(s, 16) : parseInt(s, 10);
          return Number.isNaN(n) ? 0 : n;
        } catch {
          return 0;
        }
      };
      const nums = (arr as any[]).map(toNum);
      console.log('decryptCards: parsed numbers', nums);
      setItems(prev => prev.map(g => g.id===id ? { ...g, cards: nums } : g));
    } finally {
      setDecrypting('');
    }
  };

  const getStateLabel = (state: number) => {
    const states = ['🆕 New', '🎮 Playing', '⏳ Waiting', '🏆 Finished'];
    return states[state] || '❓ Unknown';
  };

  return (
    <div>
      <h3>👤 My Games</h3>
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
          {address ? 'Loading your game...\nIf you have no games yet. Join or create one! 🎮' : 'Connect your wallet to see your games 🔗'}
        </div>
      ) : (
        items.map(x=> (
          <div key={String(x.id)} className="row" style={{alignItems:'flex-start', justifyContent:'space-between'}}>
            <div className="game-info">
              <div className="game-title">🎲 Game #{x.id.toString()}</div>
              <div className="game-meta">
                {getStateLabel(x.state)} • 💰 Stake: {formatEther(x.stake)} ETH • 🏆 Pot: {formatEther(x.pot)} ETH
              </div>
              <div className="game-meta">
                🎯 My Position: Player {x.idx + 1} • 🃏 Cards: {x.cards?.length ? x.cards.join(', ') : '🔒 encrypted'}
              </div>
            </div>
            <div>
              <button
                className="primary"
                onClick={()=>decryptCards(x.id, x.idx)}
                disabled={decrypting===x.id.toString()}
              >
                {decrypting === x.id.toString() ? '⏳ Decrypting...' : '🔓 Decrypt Cards'}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
