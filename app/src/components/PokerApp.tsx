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

  const [gameId, setGameId] = useState<string>('');
  const [myIndex, setMyIndex] = useState<number | null>(null);
  const [decryptedCards, setDecryptedCards] = useState<number[] | null>(null);
  const [txBusy, setTxBusy] = useState<string | null>(null);
  const [createStakeEth, setCreateStakeEth] = useState<string>('0.0001');

  const gameIdNum = gameId ? BigInt(gameId) : null;
  const { data: gameInfo } = useReadContract({
    address: CONTRACT_ADDRESS as any,
    abi: CONTRACT_ABI,
    functionName: 'getGame',
    args: gameIdNum !== null ? [gameIdNum] : undefined,
    query: { enabled: gameIdNum !== null }
  });
  const { data: stake } = useReadContract({
    address: CONTRACT_ADDRESS as any, abi: CONTRACT_ABI, functionName: 'getStake',
    args: gameIdNum !== null ? [gameIdNum] : undefined, query: { enabled: gameIdNum !== null }
  });
  const { data: p0 } = useReadContract({ address: CONTRACT_ADDRESS as any, abi: CONTRACT_ABI, functionName: 'getPlayer', args: gameIdNum !== null ? [gameIdNum, 0] : undefined, query: { enabled: gameIdNum !== null } });
  const { data: p1 } = useReadContract({ address: CONTRACT_ADDRESS as any, abi: CONTRACT_ABI, functionName: 'getPlayer', args: gameIdNum !== null ? [gameIdNum, 1] : undefined, query: { enabled: gameIdNum !== null } });

  const players: PlayerInfo[] = useMemo(() => {
    const a: PlayerInfo = p0 ? { addr: p0[0], cardCount: Number(p0[1]), committed: Boolean(p0[2]) } : (null as any);
    const b: PlayerInfo = p1 ? { addr: p1[0], cardCount: Number(p1[1]), committed: Boolean(p1[2]) } : (null as any);
    return [a, b].filter(Boolean) as PlayerInfo[];
  }, [p0, p1]);

  useEffect(() => {
    if (!address) { setMyIndex(null); return; }
    if (players.length === 2) {
      if (players[0].addr.toLowerCase() === address.toLowerCase()) setMyIndex(0);
      else if (players[1].addr.toLowerCase() === address.toLowerCase()) setMyIndex(1);
      else setMyIndex(null);
    } else if (players.length === 1) {
      setMyIndex(players[0].addr.toLowerCase() === address.toLowerCase() ? 0 : null);
    }
  }, [address, players]);

  const readMyCardHandles = async (): Promise<`0x${string}`[]> => {
    if (myIndex === null || gameIdNum === null) return [];
    const count = players[myIndex].cardCount;
    const client = (await import('viem')).createPublicClient({
      chain: (await import('wagmi/chains')).sepolia,
      transport: (await import('viem')).http(),
    });
    const calls = Array.from({ length: count }, (_, i) => client.readContract({
      address: CONTRACT_ADDRESS as any,
      abi: CONTRACT_ABI as any,
      functionName: 'getCardAt',
      args: [gameIdNum!, myIndex, i],
    }) as Promise<`0x${string}`>);
    return Promise.all(calls);
  };

  const decryptMyCards = async () => {
    if (!instance || myIndex === null || !address) return;
    const handles = await readMyCardHandles();
    if (handles.length === 0) return;

    // Build decryption request
    const pairs = handles.map(h => ({ handle: h, contractAddress: CONTRACT_ADDRESS }));
    const keypair = instance.generateKeypair();
    const startTimeStamp = Math.floor(Date.now() / 1000).toString();
    const durationDays = "10";
    const contractAddresses = [CONTRACT_ADDRESS];
    const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
    const signer = await signerPromise;
    if (!signer) throw new Error('No signer');
    const signature = await signer.signTypedData(
      eip712.domain,
      { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
      eip712.message
    );
    const result = await instance.userDecrypt(
      pairs,
      keypair.privateKey,
      keypair.publicKey,
      signature.replace('0x',''),
      contractAddresses,
      address,
      startTimeStamp,
      durationDays
    );
    const values: number[] = result.map((x: any) => Number(x));
    setDecryptedCards(values);
  };

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
      setGameId(String(next - 1n));
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

      <section className="panel">
        <div className="row">
          <div>
            <div>Contract: {CONTRACT_ADDRESS || '(set after deploy)'}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <input placeholder="Game ID" value={gameId} onChange={e=>setGameId(e.target.value)} style={{ padding: 8, border: '1px solid #e2e8f0', borderRadius: 8 }} />
              <span style={{ color: '#475569' }}>or</span>
              <input placeholder="Stake (ETH)" value={createStakeEth} onChange={e=>setCreateStakeEth(e.target.value)} style={{ padding: 8, border: '1px solid #e2e8f0', borderRadius: 8, width: 120 }} />
              <button className="secondary" onClick={createGame} disabled={!isConnected || txBusy==='create'}>Create Game</button>
            </div>
            <div style={{ marginTop: 8 }}>Stake: {stake ? formatEther(stake as any) : '-' } ETH</div>
            <div>State: {gameInfo ? (gameInfo as any)[0].toString() : '-'}</div>
            <div>Pot: {gameInfo ? formatEther((gameInfo as any)[1]) : '-' } ETH</div>
          </div>
        </div>

        <div className="row" style={{ gap: 12 }}>
          <button className="primary" onClick={() => write('joinGame')} disabled={!isConnected || !stake || !!myIndex || !gameId || txBusy=== 'joinGame'}>
            Join ({stake ? formatEther(stake as any) : '-' } ETH)
          </button>
          <button className="primary" onClick={() => write('continueGame')} disabled={!isConnected || !stake || myIndex===null || (players[myIndex||0]?.cardCount??0)>=5 || (gameInfo ? Number((gameInfo as any)[0]) !== 1 : true) || txBusy==='continueGame'}>
            Continue ({stake ? formatEther(stake as any) : '-' } ETH)
          </button>
          <button className="danger" onClick={() => write('fold')} disabled={!isConnected || myIndex===null || (gameInfo ? Number((gameInfo as any)[0]) !== 1 : true) || txBusy==='fold'}>
            Fold
          </button>
          <button className="secondary" onClick={() => write('settleRequest')} disabled={!isConnected || (gameInfo ? Number((gameInfo as any)[0]) !== 2 : true) || txBusy==='settleRequest'}>
            Reveal & Settle
          </button>
        </div>

        <div className="row">
          {renderCards()}
        </div>
      </section>
    </div>
  );
}
