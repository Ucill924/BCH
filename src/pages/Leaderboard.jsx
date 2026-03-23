import { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { VersionedTransaction, Transaction } from '@solana/web3.js'
import { Buffer } from 'buffer'
import bs58 from 'bs58'
import { getTokenFeed, getTokenLifetimeFees, formatSol, shortAddress, lamportsToSol } from '../services/bagsApi'

const PROXY = '/api/bags-proxy'
const SOL_MINT = 'So11111111111111111111111111111111111111112'
const BCH_TOKEN_MINT = 'C22JrdRJBsT7PRHw75mx3TNmbQ976rqBq2qAiHcoBAGS'
const BCH_TOKEN = {
  name: 'Bags Creator Hub',
  symbol: 'BCH',
  image: '/logo.png',
  tokenMint: BCH_TOKEN_MINT,
  description: 'The ultimate creator terminal for Bags.fm — launch tokens, track fees, AI research & swap in one place.',
  status: 'PRE_GRAD',
  lifetimeFees: '0',
}

async function getQuote(tokenMint, amountLamports) {
  const q = new URLSearchParams({ path: '/trade/quote', inputMint: SOL_MINT, outputMint: tokenMint, amount: amountLamports, slippageMode: 'auto' })
  const res = await fetch(`${PROXY}?${q}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error)
  return data.response
}

async function createSwap(quoteResponse, userPublicKey) {
  const q = new URLSearchParams({ path: '/trade/swap' })
  const res = await fetch(`${PROXY}?${q}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quoteResponse, userPublicKey }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error)
  return data.response
}

async function sendTx(transaction) {
  const q = new URLSearchParams({ path: '/solana/send-transaction' })
  const res = await fetch(`${PROXY}?${q}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error)
  return data.response
}

async function fetchSingleToken(tokenMint) {
  // Coba ambil dari feed dulu, kalau tidak ada pakai lifetime fees saja
  try {
    const fees = await getTokenLifetimeFees(tokenMint)
    return { tokenMint, lifetimeFees: fees, name: 'Unknown', symbol: '???', status: 'ACTIVE' }
  } catch {
    throw new Error('Token not found')
  }
}

export default function Leaderboard({ setPage, setSelectedToken }) {
  const { publicKey, signTransaction } = useWallet()
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [mode, setMode] = useState('buy')
  const [aiResult, setAiResult] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [buyAmount, setBuyAmount] = useState('0.01')
  const [quote, setQuote] = useState(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [swapLoading, setSwapLoading] = useState(false)
  const [swapMsg, setSwapMsg] = useState('')
  const [swapSuccess, setSwapSuccess] = useState('')
  const [searchMint, setSearchMint] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [bchFees, setBchFees] = useState('0')

  useEffect(() => {
    loadFeed()
    loadBCHFees()
  }, [])

  async function loadBCHFees() {
    try {
      const fees = await getTokenLifetimeFees(BCH_TOKEN_MINT)
      setBchFees(fees)
    } catch {}
  }

  async function loadFeed() {
    setLoading(true); setError('')
    try {
      const feed = await getTokenFeed()
      const top = feed.slice(0, 15)
      setTokens(top.map(t => ({ ...t, lifetimeFees: '0' })))
      const results = [...top]
      for (let i = 0; i < top.length; i += 3) {
        const batch = top.slice(i, i + 3)
        await Promise.all(batch.map(async (t, bi) => {
          try {
            const fees = await getTokenLifetimeFees(t.tokenMint)
            results[i + bi] = { ...t, lifetimeFees: fees }
          } catch { results[i + bi] = { ...t, lifetimeFees: '0' } }
        }))
        setTokens([...results])
        if (i + 3 < top.length) await new Promise(r => setTimeout(r, 300))
      }
      results.sort((a, b) => Number(b.lifetimeFees) - Number(a.lifetimeFees))
      setTokens([...results])
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  async function handleSearch() {
    if (!searchMint.trim()) return
    setSearchLoading(true)
    try {
      const fees = await getTokenLifetimeFees(searchMint.trim())
      // Find in current list or create basic entry
      const existing = tokens.find(t => t.tokenMint === searchMint.trim())
      const token = existing || { tokenMint: searchMint.trim(), name: 'Token', symbol: '???', status: 'ACTIVE', lifetimeFees: fees }
      setSelectedToken(searchMint.trim())
      setPage('dashboard')
    } catch (e) {
      setError('Token not found: ' + e.message)
    }
    setSearchLoading(false)
  }

  async function handleAI(token) {
    setSelected(token); setMode('ai'); setAiResult(''); setSwapSuccess(''); setQuote(null)
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai-research', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      setAiResult(data.result || data.error || 'No result')
    } catch (e) { setAiResult('Error: ' + e.message) }
    setAiLoading(false)
  }

  async function handleGetQuote() {
    if (!selected) return
    setQuoteLoading(true); setQuote(null)
    try {
      const lamports = Math.floor(parseFloat(buyAmount) * 1e9)
      const q = await getQuote(selected.tokenMint, lamports)
      setQuote(q)
    } catch (e) { setSwapMsg('Quote error: ' + e.message) }
    setQuoteLoading(false)
  }

  async function handleSwap() {
    if (!quote || !publicKey || !signTransaction) return
    setSwapLoading(true); setSwapMsg('Creating swap tx...'); setSwapSuccess('')
    try {
      const swapData = await createSwap(quote, publicKey.toString())
      setSwapMsg('Sign in Phantom...')
      const txBuffer = bs58.decode(swapData.swapTransaction)
      let tx
      try { tx = VersionedTransaction.deserialize(txBuffer) }
      catch { tx = Transaction.from(Buffer.from(txBuffer)) }
      const signed = await signTransaction(tx)
      const signedB58 = bs58.encode(signed.serialize())
      setSwapMsg('Sending...')
      const sig = await sendTx(signedB58)
      setSwapSuccess(`✅ Swap success! TX: ${sig?.slice(0,16)}...`)
      setSwapMsg(''); setQuote(null)
    } catch (e) { setSwapMsg(''); setError('Swap failed: ' + e.message) }
    setSwapLoading(false)
  }

  const s = {
    label: { fontFamily: 'Orbitron', fontSize: 9, color: 'rgba(0,245,255,0.6)', letterSpacing: '0.1em', marginBottom: 6, display: 'block' },
    input: { width: '100%', padding: '9px 12px', background: 'rgba(0,255,136,0.03)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 6, color: '#00ff88', fontFamily: 'Share Tech Mono', fontSize: 13, outline: 'none' },
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem 1rem', position: 'relative', zIndex: 1 }}>

      {/* BCH PROMO BANNER */}
      <div style={{
        marginBottom: '1.5rem', padding: '1rem 1.5rem',
        background: 'linear-gradient(135deg, rgba(0,245,255,0.08), rgba(123,47,255,0.08))',
        border: '1px solid rgba(0,245,255,0.25)',
        borderRadius: 12,
        display: 'flex', alignItems: 'center', gap: 16,
        flexWrap: 'wrap',
      }}>
        <img src="/logo.png" alt="BCH" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', border: '1px solid rgba(0,245,255,0.3)' }} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: 'Orbitron', fontSize: 14, fontWeight: 700, color: '#00f5ff' }}>Bags Creator Hub</span>
            <span style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'rgba(0,245,255,0.6)' }}>$BCH</span>
            <span style={{ fontFamily: 'Share Tech Mono', fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)', color: '#00ff88' }}>FEATURED</span>
          </div>
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
            The ultimate creator terminal for Bags.fm — launch tokens, track fees, AI research & swap in one place.
          </div>
          <div style={{ marginTop: 4, fontFamily: 'Share Tech Mono', fontSize: 10, color: '#00f5ff' }}>
            Lifetime Fees: {formatSol(bchFees)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            className="btn-cyber btn-purple"
            style={{ padding: '8px 14px', borderRadius: 8, fontSize: 10 }}
            onClick={() => handleAI({ ...BCH_TOKEN, lifetimeFees: bchFees })}
          >🤖 AI ANALYSIS</button>
          <button
            className="btn-cyber btn-green"
            style={{ padding: '8px 14px', borderRadius: 8, fontSize: 10 }}
            onClick={() => { setSelected({ ...BCH_TOKEN, lifetimeFees: bchFees }); setMode('buy'); setAiResult(''); setSwapSuccess(''); setQuote(null) }}
          >◎ BUY $BCH</button>
        </div>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Orbitron', fontSize: 20, fontWeight: 700, color: '#00f5ff', letterSpacing: '0.05em' }}>◈ TOKEN RADAR</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 6px #00ff88' }} />
            <span style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: '#00ff88' }}>LIVE — SORTED BY LIFETIME FEES</span>
          </div>
        </div>
        <button onClick={loadFeed} disabled={loading} className="btn-cyber" style={{ padding: '8px 16px', borderRadius: 6, fontSize: 10 }}>
          {loading ? '◌ SCANNING...' : '◎ REFRESH'}
        </button>
      </div>

      {/* Search by contract */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: 8 }}>
        <input
          type="text"
          placeholder="Search by contract address (mint)..."
          value={searchMint}
          onChange={e => setSearchMint(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          style={{
            flex: 1, padding: '9px 14px',
            background: 'rgba(0,245,255,0.03)',
            border: '1px solid rgba(0,245,255,0.15)',
            borderRadius: 8, color: '#e2e8f0',
            fontFamily: 'Share Tech Mono', fontSize: 12, outline: 'none',
          }}
        />
        <button
          onClick={handleSearch}
          disabled={searchLoading || !searchMint}
          className="btn-cyber"
          style={{ padding: '9px 16px', borderRadius: 8, fontSize: 10 }}
        >
          {searchLoading ? '◌' : '⌕ SEARCH'}
        </button>
      </div>

      {error && <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,50,50,0.08)', border: '1px solid rgba(255,50,50,0.3)', color: '#ff6b6b', fontFamily: 'Share Tech Mono', fontSize: 11, marginBottom: 12 }}>⚠ {error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: 16 }}>
        {/* Token list */}
        <div>
          {loading && !tokens.length ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ height: 68, borderRadius: 8, background: 'rgba(0,245,255,0.03)', border: '1px solid rgba(0,245,255,0.06)', marginBottom: 8 }} />
            ))
          ) : tokens.map((token, idx) => (
            <div key={token.tokenMint} style={{
              borderRadius: 10, padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
              transition: 'all 0.2s', marginBottom: 8,
              background: selected?.tokenMint === token.tokenMint ? 'rgba(0,245,255,0.05)' : 'rgba(0,245,255,0.02)',
              border: selected?.tokenMint === token.tokenMint ? '1px solid rgba(0,245,255,0.35)' : '1px solid rgba(0,245,255,0.08)',
            }}
              onClick={() => { setSelectedToken(token.tokenMint); setPage('dashboard') }}
            >
              <div style={{ width: 28, textAlign: 'center', fontFamily: 'Orbitron', fontSize: 13, fontWeight: 700,
                color: idx === 0 ? '#ffd700' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : 'rgba(255,255,255,0.2)' }}>
                {idx + 1}
              </div>
              <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(0,245,255,0.15)', background: 'rgba(0,245,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {token.image
                  ? <img src={token.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
                  : <span style={{ fontFamily: 'Orbitron', fontSize: 11, color: '#00f5ff' }}>{token.symbol?.slice(0,2)}</span>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontFamily: 'Orbitron', fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{token.name}</span>
                  <span style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'rgba(0,245,255,0.5)' }}>${token.symbol}</span>
                  <span style={{ fontFamily: 'Share Tech Mono', fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.15)', color: '#00ff88' }}>
                    {token.status || 'ACTIVE'}
                  </span>
                </div>
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>{shortAddress(token.tokenMint)}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginRight: 8 }}>
                <div style={{ fontFamily: 'Orbitron', fontSize: 12, fontWeight: 600, color: '#00f5ff' }}>{formatSol(token.lifetimeFees || 0)}</div>
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>lifetime fees</div>
              </div>
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                <button className="btn-cyber btn-purple" style={{ padding: '5px 8px', borderRadius: 5, fontSize: 9 }}
                  onClick={() => handleAI(token)}>🤖 AI</button>
                <button className="btn-cyber btn-green" style={{ padding: '5px 8px', borderRadius: 5, fontSize: 9 }}
                  onClick={() => { setSelected(token); setMode('buy'); setAiResult(''); setSwapSuccess(''); setQuote(null) }}>BUY</button>
              </div>
            </div>
          ))}
        </div>

        {/* Side panel */}
        {selected && (
          <div className="neon-card" style={{ borderRadius: 12, padding: '1.25rem', height: 'fit-content', position: 'sticky', top: 80 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(0,245,255,0.1)' }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(0,245,255,0.3)', background: 'rgba(0,245,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {selected.image && <img src={selected.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Orbitron', fontSize: 12, color: '#e2e8f0' }}>{selected.name}</div>
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: '#00f5ff' }}>${selected.symbol}</div>
              </div>
              <button onClick={() => { setSelected(null); setAiResult(''); setQuote(null); setSwapSuccess('') }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: '1rem' }}>
              <button onClick={() => setMode('ai')} className={mode === 'ai' ? 'btn-cyber btn-purple' : 'btn-cyber'}
                style={{ flex: 1, padding: '7px', borderRadius: 6, fontSize: 10 }}>🤖 AI RESEARCH</button>
              <button onClick={() => setMode('buy')} className={mode === 'buy' ? 'btn-cyber btn-green' : 'btn-cyber'}
                style={{ flex: 1, padding: '7px', borderRadius: 6, fontSize: 10 }}>◎ BUY</button>
            </div>

            {mode === 'ai' && (
              <div>
                {aiLoading ? (
                  <div style={{ padding: '1rem', background: 'rgba(123,47,255,0.05)', borderRadius: 8, border: '1px solid rgba(123,47,255,0.2)' }}>
                    <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'rgba(167,139,250,0.8)', marginBottom: 8 }}>◌ Analyzing with AI...</div>
                    <div style={{ height: 2, background: 'rgba(123,47,255,0.15)', borderRadius: 1, overflow: 'hidden' }}>
                      <div className="load-bar" style={{ height: '100%', background: '#7b2fff', borderRadius: 1 }} />
                    </div>
                  </div>
                ) : aiResult ? (
                  <div style={{ padding: '1rem', background: 'rgba(123,47,255,0.05)', borderRadius: 8, border: '1px solid rgba(123,47,255,0.2)', fontFamily: 'Share Tech Mono', fontSize: 11, color: 'rgba(220,200,255,0.9)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {aiResult}
                  </div>
                ) : (
                  <button className="btn-cyber btn-purple" style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 11 }}
                    onClick={() => handleAI(selected)}>🤖 ANALYZE WITH AI →</button>
                )}
              </div>
            )}

            {mode === 'buy' && (
              <div>
                {!publicKey ? (
                  <div style={{ textAlign: 'center', padding: '1rem' }}>
                    <p style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>Connect wallet to swap</p>
                    <WalletMultiButton />
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: 10 }}>
                      <label style={s.label}>AMOUNT (SOL)</label>
                      <input type="number" value={buyAmount} onChange={e => { setBuyAmount(e.target.value); setQuote(null) }}
                        step="0.001" min="0.001" style={s.input} />
                    </div>
                    <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
                      {['0.01','0.05','0.1','0.5'].map(a => (
                        <button key={a} onClick={() => { setBuyAmount(a); setQuote(null) }}
                          style={{ flex: 1, padding: '4px', background: buyAmount === a ? 'rgba(0,255,136,0.15)' : 'rgba(0,255,136,0.03)',
                            border: '1px solid rgba(0,255,136,0.2)', borderRadius: 4, color: '#00ff88',
                            fontFamily: 'Share Tech Mono', fontSize: 10, cursor: 'pointer' }}>
                          {a}
                        </button>
                      ))}
                    </div>
                    {quote && (
                      <div style={{ padding: '10px 12px', background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: 8, marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>You receive</span>
                          <span style={{ fontFamily: 'Orbitron', fontSize: 11, color: '#00ff88' }}>
                            {(Number(quote.outAmount) / 1e6).toLocaleString()} {selected.symbol}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Price impact</span>
                          <span style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: parseFloat(quote.priceImpactPct) > 5 ? '#ff6b6b' : '#00ff88' }}>
                            {parseFloat(quote.priceImpactPct || 0).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    )}
                    {swapMsg && (
                      <div style={{ padding: '8px 12px', background: 'rgba(0,245,255,0.05)', border: '1px solid rgba(0,245,255,0.2)', borderRadius: 6, marginBottom: 10, fontFamily: 'Share Tech Mono', fontSize: 11, color: '#00f5ff', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 12, height: 12, border: '2px solid #00f5ff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                        {swapMsg}
                      </div>
                    )}
                    {swapSuccess && (
                      <div style={{ padding: '8px 12px', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: 6, marginBottom: 10, fontFamily: 'Share Tech Mono', fontSize: 11, color: '#00ff88' }}>
                        {swapSuccess}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {!quote ? (
                        <button className="btn-cyber" style={{ padding: '10px', borderRadius: 8, fontSize: 11 }}
                          onClick={handleGetQuote} disabled={quoteLoading}>
                          {quoteLoading ? '◌ Getting quote...' : '◎ GET QUOTE'}
                        </button>
                      ) : (
                        <button className="btn-cyber btn-green" style={{ padding: '10px', borderRadius: 8, fontSize: 11 }}
                          onClick={handleSwap} disabled={swapLoading}>
                          {swapLoading ? '◌ Swapping...' : `◎ SWAP ${buyAmount} SOL → ${selected.symbol}`}
                        </button>
                      )}
                      <button className="btn-cyber" style={{ padding: '8px', borderRadius: 6, fontSize: 10 }}
                        onClick={() => setQuote(null)}>RESET</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
