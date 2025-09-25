import { useEffect, useMemo, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { Contract, formatEther } from 'ethers';
import '../App.css';

type PlayerInfo = { addr: `0x${string}`, cardCount: number, committed: boolean };

export function PokerApp() {
  const { address, isConnected } = useAccount();
  const { instance } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const [txBusy, setTxBusy] = useState<string | null>(null);
  const [createStakeEth, setCreateStakeEth] = useState<string>('0.0001');
  const [createdId, setCreatedId] = useState<string>('');
  const [tab, setTab] = useState<'create'|'all'|'mine'>('create');

  // No read/join/continue/fold here. Create page only.

  const write = async (fn: 'joinGame'|'continueGame'|'fold'|'settleRequest') => {
    if (gameIdNum === null) { alert('Enter a gameId'); return; }
    const signer = await signerPromise;
    if (!signer) throw new Error('No signer');
    const c = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    setTxBusy(fn);
    try {
      if (fn === 'joinGame' || fn === 'continueGame') {
        const s = stake as unknown as bigint;
        const tx = await (c as any)[fn](gameIdNum, { value: s });
        await tx.wait();
      } else {
        const tx = await (c as any)[fn](gameIdNum);
        await tx.wait();
      }
    } finally {
      setTxBusy(null);
    }
  };

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
      const next: bigint = await client.readContract({ address: CONTRACT_ADDRESS as any, abi: CONTRACT_ABI as any, functionName: 'nextGameId' }) as any;
      setCreatedId(String(next - 1n));
    } finally {
      setTxBusy(null);
    }
  };

  const renderCards = () => {
    if (myIndex === null) return null;
    const count = players[myIndex]?.cardCount || 0;
    return (
      <div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Array.from({ length: count }, (_, i) => (
            <div key={i} style={{ padding: 8, background: '#f1f5f9', borderRadius: 8 }}>
              Card {i+1}: {decryptedCards ? decryptedCards[i] : 'encrypted'}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <button onClick={decryptMyCards} disabled={!isConnected} className="primary">
            Decrypt My Cards
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="container">
      <header className="toolbar">
        <div style={{ fontWeight: 700 }}>FHE Poker</div>
        <ConnectButton />
      </header>

      {/* Game Rules */}
      <section className="panel">
        <div className="row" style={{alignItems:'flex-start'}}>
          <div style={{maxWidth: 860}}>
            <h3 style={{marginTop:0}}>Game Rules</h3>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
              <li>Each game has exactly 2 players.</li>
              <li>Creator sets the stake; joining a game costs 1x stake, continuing a round costs 1x stake.</li>
              <li>Both players start with 2 encrypted cards. When both click Continue, each gets one more card.</li>
              <li>At 5 cards each, the game moves to Reveal. On settlement, the player with the higher encrypted hand sum wins the entire pot. This is a demo rule for comparison.</li>
              <li>Fold to concede immediately and give the current pot to the opponent.</li>
              <li>Your cards are encrypted on-chain. Use “Decrypt My Cards” in “My Games” to view them locally via Zama relayer.</li>
              <li>Create page only creates a new game. Browse games in “All Games”. Manage and decrypt your hands in “My Games”.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="row" style={{gap:8}}>
          <button className="secondary" onClick={()=>setTab('create')}>Create</button>
          <button className="secondary" onClick={()=>setTab('all')}>All Games</button>
          <button className="secondary" onClick={()=>setTab('mine')}>My Games</button>
        </div>
        {tab==='create' && (
          <div className="row">
            <div>
              <div>Contract: {CONTRACT_ADDRESS || '(set after deploy)'}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <input placeholder="Stake (ETH)" value={createStakeEth} onChange={e=>setCreateStakeEth(e.target.value)} style={{ padding: 8, border: '1px solid #e2e8f0', borderRadius: 8, width: 160 }} />
                <button className="secondary" onClick={createGame} disabled={!isConnected || txBusy==='create'}>Create Game</button>
              </div>
              {createdId && (
                <div style={{ marginTop: 8 }}>Created Game ID: {createdId}</div>
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
  useEffect(() => { (async () => {
    const client = (await import('viem')).createPublicClient({ chain: (await import('wagmi/chains')).sepolia, transport: (await import('viem')).http() });
    const count: bigint = await client.readContract({ address: CONTRACT_ADDRESS as any, abi: CONTRACT_ABI as any, functionName: 'gameCount' }) as any;
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
  return (
    <div>
      <h3>All Games</h3>
      {items.map(x=> (
        <div key={String(x.id)} className="row" style={{justifyContent:'space-between'}}>
          <div>Game #{x.id.toString()} | State {x.state} | Stake {formatEther(x.stake)} | Pot {formatEther(x.pot)}</div>
          <div>Players: {x.p0} vs {x.p1}</div>
        </div>
      ))}
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
    const count: bigint = await client.readContract({ address: CONTRACT_ADDRESS as any, abi: CONTRACT_ABI as any, functionName: 'gameCount' }) as any;
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
      const nums = (result as any[]).map(x=>Number(x));
      setItems(prev => prev.map(g => g.id===id ? { ...g, cards: nums } : g));
    } finally {
      setDecrypting('');
    }
  };

  return (
    <div>
      <h3>My Games</h3>
      {items.map(x=> (
        <div key={String(x.id)} className="row" style={{alignItems:'flex-start', justifyContent:'space-between'}}>
          <div>
            <div>Game #{x.id.toString()} | State {x.state} | Stake {formatEther(x.stake)} | Pot {formatEther(x.pot)}</div>
            <div style={{marginTop:6}}>My index: {x.idx} | My cards: {x.cards?.length? x.cards.join(', ') : 'encrypted'}</div>
          </div>
          <div>
            <button className="primary" onClick={()=>decryptCards(x.id, x.idx)} disabled={decrypting===x.id.toString()}>Decrypt My Cards</button>
          </div>
        </div>
      ))}
    </div>
  );
}
