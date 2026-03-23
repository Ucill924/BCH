import { useEffect, useState } from 'react'
import { getTokenFeed, getTokenLifetimeFees, formatSol, shortAddress, lamportsToSol } from '../services/bagsApi'

const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_KEY || ''
const PROXY = '/api/bags-proxy'

async function getTradeQuote(tokenMint, amountSol) {
  const lamports = Math.floor(amountSol * 1e9)
  const q = new URLSearchParams({ path: '/trade/quote', tokenMint, amount: lamports, side: 'buy' })
  const res = await fetch(`${PROXY}?${q}`)
  const data = await res.json()
  return data.success ? data.response : null
}

async function createSwap(tokenMint, wallet, amountSol) {
  const lamports = Math.floor(amountSol * 1e9)
  const q = new URLSearchParams({ path: '/trade/swap' })
  const res = await fetch(`${PROXY}?${q}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenMint, wallet, amountIn: lamports, side: 'buy' }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error)
  return data.response
}

async function aiResearch(token) {
  const prompt = `Analyze this Solana meme token on Bags.fm and give a brief research report:
Token: ${token.name} ($${token.symbol})
Description: ${token.description || 'N/A'}
Lifetime Fees: ${lamportsToSol(token.lifetimeFees || 0).toFixed(4)} SOL
Status: ${token.status}

Give: 1) Quick summary 2) Risk level (Low/Med/High) 3) Buy/Skip recommendation with reason. Keep it under 150 words. Be direct and crypto-native.`

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
    },
    body: JSON.stringify({
      model: 'google/gemini-flash-1.5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
    }),
  })
  const data = await res.json()
  return data.choices?.[0]?.message?.content || 'AI analysis unavailable'
}

export default function Leaderboard({ setPage, setSelectedToken }) {
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [aiResult, setAiResult] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [buyAmount, setBuyAmount] = useState('0.01')
  const [buyLoading, setBuyLoading] = useState(false)
  const [quote, setQuote] = useState(null)

  useEffect(() => { loadFeed() }, [])

  async function loadFeed() {
    setLoading(true)
    setError('')
    try {
      const feed = await getTokenFeed()
      const top = feed.slice(0, 20)
      const withFees = await Promise.all(
        top.map(async (t) => {
          try { return { ...t, lifetimeFees: await getTokenLifetimeFees(t.tokenMint) } }
          catch { return { ...t, lifetimeFees: '0' } }
        })
      )
      withFees.sort((a, b) => Number(b.lifetimeFees) - Number(a.lifetimeFees))
      setTokens(withFees)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  async function handleAIResearch(token) {
    setSelected(token)
    setAiResult('')
    setAiLoading(true)
    setQuote(null)
    try {
      const result = await aiResearch(token)
      setAiResult(result)
    } catch (e) { setAiResult('AI research failed: ' + e.message) }
    setAiLoading(false)
  }

  async function handleGetQuote(token) {
    try {
      const q = await getTradeQuote(token.tokenMint, parseFloat(buyAmount))
      setQuote(q)
    } catch (e) { console.error(e) }
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1rem', position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <h1 style={{ fontFamily: 'Orbitron', fontSize: 22, fontWeight: 700, color: '#00f5ff', letterSpacing: '0.05em' }}>
              ◈ TOKEN RADAR
            </h1>
            <p style={{ fontFamily: 'Share Tech Mono', fontSize: 12, color: 'rgba(0,245,255,0.5)', marginTop: 4 }}>
              LIVE FEED FROM BAGS.FM — SORTED BY LIFETIME FEES
            </p>
          </div>
          <button onClick={loadFeed} disabled={loading} className="btn-cyber" style={{ padding: '8px 16px', borderRadius: 6 }}>
            {loading ? '◌ SCANNING...' : '◎ REFRESH'}
          </button>
        </div>
        {/* Live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88' }} />
          <span style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: '#00ff88' }}>LIVE</span>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(255,50,50,0.1)', border: '1px solid rgba(255,50,50,0.3)', color: '#ff6b6b', fontFamily: 'Share Tech Mono', fontSize: 12, marginBottom: 16 }}>
          ⚠ {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 16 }}>
        {/* Token list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading && !tokens.length ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ height: 72, borderRadius: 8, background: 'rgba(0,245,255,0.03)', border: '1px solid rgba(0,245,255,0.08)', animation: 'pulse 1.5s infinite' }} />
            ))
          ) : tokens.map((token, idx) => (
            <div key={token.tokenMint}
              className="neon-card"
              style={{
                borderRadius: 10, padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
                cursor: 'pointer',
                border: selected?.tokenMint === token.tokenMint ? '1px solid rgba(0,245,255,0.4)' : '1px solid rgba(0,245,255,0.08)',
                boxShadow: selected?.tokenMint === token.tokenMint ? '0 0 20px rgba(0,245,255,0.1)' : 'none',
                transition: 'all 0.2s',
              }}
              onClick={() => { setSelectedToken(token.tokenMint); setPage('dashboard') }}
            >
              {/* Rank */}
              <div style={{ width: 32, textAlign: 'center', fontFamily: 'Orbitron', fontSize: 14, fontWeight: 700,
                color: idx === 0 ? '#ffd700' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : 'rgba(255,255,255,0.2)' }}>
                {idx + 1}
              </div>

              {/* Avatar */}
              <div style={{ width: 42, height: 42, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(0,245,255,0.2)', background: 'rgba(0,245,255,0.05)' }}>
                {token.image
                  ? <img src={token.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron', fontSize: 12, color: '#00f5ff' }}>
                      {token.symbol?.slice(0, 2)}
                    </div>
                }
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontFamily: 'Orbitron', fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{token.name}</span>
                  <span style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'rgba(0,245,255,0.6)' }}>${token.symbol}</span>
                  <span style={{ fontFamily: 'Share Tech Mono', fontSize: 10, padding: '1px 6px', borderRadius: 4,
                    background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)', color: '#00ff88' }}>
                    {token.status || 'ACTIVE'}
                  </span>
                </div>
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                  {shortAddress(token.tokenMint)}
                </div>
              </div>

              {/* Fees */}
              <div style={{ textAlign: 'right', flexShrink: 0, marginRight: 8 }}>
                <div style={{ fontFamily: 'Orbitron', fontSize: 13, fontWeight: 600, color: '#00f5ff' }}>
                  {formatSol(token.lifetimeFees || 0)}
                </div>
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>lifetime fees</div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                <button
                  className="btn-cyber btn-purple"
                  style={{ padding: '5px 10px', borderRadius: 6, fontSize: 9 }}
                  onClick={() => handleAIResearch(token)}
                >
                  🤖 AI
                </button>
                <button
                  className="btn-cyber btn-green"
                  style={{ padding: '5px 10px', borderRadius: 6, fontSize: 9 }}
                  onClick={() => { setSelected(token); setAiResult('') }}
                >
                  BUY
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Side panel - AI Research / Buy */}
        {selected && (
          <div className="neon-card" style={{ borderRadius: 12, padding: '1.25rem', height: 'fit-content', position: 'sticky', top: 80 }}>
            {/* Token header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(0,245,255,0.1)' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(0,245,255,0.3)', background: 'rgba(0,245,255,0.05)' }}>
                {selected.image && <img src={selected.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div>
                <div style={{ fontFamily: 'Orbitron', fontSize: 13, color: '#e2e8f0' }}>{selected.name}</div>
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: '#00f5ff' }}>${selected.symbol}</div>
              </div>
              <button onClick={() => { setSelected(null); setAiResult(''); setQuote(null) }}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>

            {/* AI Research */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: 'rgba(0,245,255,0.7)', marginBottom: 8, letterSpacing: '0.1em' }}>
                ◈ AI RESEARCH
              </div>
              {aiLoading ? (
                <div style={{ padding: '1rem', background: 'rgba(123,47,255,0.05)', borderRadius: 8, border: '1px solid rgba(123,47,255,0.2)' }}>
                  <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'rgba(167,139,250,0.8)' }}>
                    ◌ Analyzing token data...
                  </div>
                  <div style={{ height: 2, background: 'rgba(123,47,255,0.2)', borderRadius: 1, marginTop: 8, overflow: 'hidden' }}>
                    <div className="load-bar" style={{ height: '100%', background: '#7b2fff', borderRadius: 1 }} />
                  </div>
                </div>
              ) : aiResult ? (
                <div style={{ padding: '1rem', background: 'rgba(123,47,255,0.05)', borderRadius: 8, border: '1px solid rgba(123,47,255,0.2)', fontFamily: 'Share Tech Mono', fontSize: 11, color: 'rgba(220,200,255,0.9)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {aiResult}
                </div>
              ) : (
                <button
                  className="btn-cyber btn-purple"
                  style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 11 }}
                  onClick={() => handleAIResearch(selected)}
                >
                  🤖 ANALYZE WITH AI
                </button>
              )}
            </div>

            {/* Buy section */}
            <div>
              <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: 'rgba(0,255,136,0.7)', marginBottom: 8, letterSpacing: '0.1em' }}>
                ◈ BUY TOKEN
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 4 }}>AMOUNT (SOL)</label>
                <input
                  type="number"
                  value={buyAmount}
                  onChange={e => setBuyAmount(e.target.value)}
                  step="0.001"
                  min="0.001"
                  style={{
                    width: '100%', padding: '8px 12px',
                    background: 'rgba(0,255,136,0.03)',
                    border: '1px solid rgba(0,255,136,0.2)',
                    borderRadius: 6, color: '#00ff88',
                    fontFamily: 'Share Tech Mono', fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['0.01', '0.05', '0.1', '0.5'].map(amt => (
                  <button key={amt} onClick={() => setBuyAmount(amt)}
                    style={{ flex: 1, padding: '4px', background: buyAmount === amt ? 'rgba(0,255,136,0.15)' : 'rgba(0,255,136,0.03)',
                      border: '1px solid rgba(0,255,136,0.2)', borderRadius: 4, color: '#00ff88',
                      fontFamily: 'Share Tech Mono', fontSize: 10, cursor: 'pointer' }}>
                    {amt}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: 6, fontFamily: 'Share Tech Mono', fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: '0.75rem' }}>
                ⚠ Buying on mainnet — make sure you're ready
              </div>
              <a
                href={`https://bags.fm/${selected.tokenMint}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-cyber btn-green"
                style={{ display: 'block', width: '100%', padding: '10px', borderRadius: 8, fontSize: 11, textAlign: 'center', textDecoration: 'none' }}
              >
                ◎ BUY ON BAGS.FM →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
