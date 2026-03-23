import { useEffect, useState } from 'react'
import { getTokenFeed, getTokenLifetimeFees, formatSol, lamportsToSol } from '../services/bagsApi'

const PROXY = '/api/bags-proxy'

async function getTradeQuote(tokenMint) {
  try {
    const SOL_MINT = 'So11111111111111111111111111111111111111112'
    const q = new URLSearchParams({
      path: '/trade/quote',
      inputMint: SOL_MINT,
      outputMint: tokenMint,
      amount: 1000000, // 0.001 SOL
      slippageMode: 'auto',
    })
    const res = await fetch(`${PROXY}?${q}`)
    const data = await res.json()
    return data.success ? data.response : null
  } catch { return null }
}

function getMomentumColor(fees) {
  const sol = lamportsToSol(fees || 0)
  if (sol > 1) return { color: '#00ff88', label: '🔥 HOT', bg: 'rgba(0,255,136,0.1)', border: 'rgba(0,255,136,0.3)' }
  if (sol > 0.1) return { color: '#00f5ff', label: '📈 RISING', bg: 'rgba(0,245,255,0.08)', border: 'rgba(0,245,255,0.25)' }
  if (sol > 0.01) return { color: '#a78bfa', label: '⚡ ACTIVE', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)' }
  return { color: 'rgba(255,255,255,0.4)', label: '🆕 NEW', bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.1)' }
}

export default function Trending({ setPage, setSelectedToken }) {
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all') // all | hot | new | graduated
  const [autoRefresh, setAutoRefresh] = useState(false)

  useEffect(() => {
    loadTrending()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(loadTrending, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  async function loadTrending() {
    setLoading(true)
    try {
      const feed = await getTokenFeed()
      // Show more tokens on trending - up to 30
      const all = feed.slice(0, 30)
      setTokens(all.map(t => ({ ...t, lifetimeFees: '0', loadingFees: true })))

      // Fetch fees in batches
      const results = [...all]
      for (let i = 0; i < all.length; i += 3) {
        const batch = all.slice(i, i + 3)
        await Promise.all(batch.map(async (t, bi) => {
          try {
            const fees = await getTokenLifetimeFees(t.tokenMint)
            results[i + bi] = { ...t, lifetimeFees: fees, loadingFees: false }
          } catch {
            results[i + bi] = { ...t, lifetimeFees: '0', loadingFees: false }
          }
        }))
        setTokens([...results])
        if (i + 3 < all.length) await new Promise(r => setTimeout(r, 300))
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const filtered = tokens.filter(t => {
    if (filter === 'hot') return lamportsToSol(t.lifetimeFees || 0) > 0.1
    if (filter === 'new') return lamportsToSol(t.lifetimeFees || 0) < 0.01
    if (filter === 'graduated') return t.status === 'GRADUATED'
    return true
  })

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem 1rem', position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Orbitron', fontSize: 20, fontWeight: 700, color: '#00f5ff', letterSpacing: '0.05em' }}>
            🔥 TRENDING TOKENS
          </h1>
          <p style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'rgba(0,245,255,0.5)', marginTop: 4 }}>
            LIVE TOKEN FEED FROM BAGS.FM — {tokens.length} TOKENS
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Auto refresh toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{
                width: 32, height: 18, borderRadius: 9, cursor: 'pointer',
                background: autoRefresh ? '#00ff88' : 'rgba(255,255,255,0.1)',
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: 2, left: autoRefresh ? 14 : 2,
                width: 14, height: 14, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s',
              }} />
            </div>
            <span style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: autoRefresh ? '#00ff88' : 'rgba(255,255,255,0.3)' }}>
              AUTO
            </span>
          </div>
          <button onClick={loadTrending} disabled={loading} className="btn-cyber"
            style={{ padding: '7px 14px', borderRadius: 6, fontSize: 10 }}>
            {loading ? '◌ LOADING...' : '◎ REFRESH'}
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: '1.5rem' }}>
        {[
          { id: 'all', label: '◈ ALL', count: tokens.length },
          { id: 'hot', label: '🔥 HOT', count: tokens.filter(t => lamportsToSol(t.lifetimeFees || 0) > 0.1).length },
          { id: 'new', label: '🆕 NEW', count: tokens.filter(t => lamportsToSol(t.lifetimeFees || 0) < 0.01).length },
          { id: 'graduated', label: '🎓 GRADUATED', count: tokens.filter(t => t.status === 'GRADUATED').length },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={filter === f.id ? 'btn-cyber btn-green' : 'btn-cyber'}
            style={{ padding: '6px 14px', borderRadius: 20, fontSize: 10 }}>
            {f.label} <span style={{ opacity: 0.6, marginLeft: 4 }}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Token grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 12,
      }}>
        {filtered.map(token => {
          const momentum = getMomentumColor(token.lifetimeFees)
          return (
            <div
              key={token.tokenMint}
              onClick={() => { setSelectedToken(token.tokenMint); setPage('dashboard') }}
              style={{
                borderRadius: 12, padding: '1rem',
                background: momentum.bg,
                border: `1px solid ${momentum.border}`,
                cursor: 'pointer', transition: 'all 0.2s',
                position: 'relative', overflow: 'hidden',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {/* Momentum badge */}
              <div style={{
                position: 'absolute', top: 10, right: 10,
                fontFamily: 'Share Tech Mono', fontSize: 9,
                color: momentum.color, letterSpacing: '0.05em',
              }}>
                {momentum.label}
              </div>

              {/* Token image + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  border: `1px solid ${momentum.border}`,
                  background: 'rgba(0,0,0,0.3)',
                  overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {token.image
                    ? <img src={token.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
                    : <span style={{ fontFamily: 'Orbitron', fontSize: 12, color: momentum.color }}>{token.symbol?.slice(0,2)}</span>
                  }
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'Orbitron', fontSize: 12, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {token.name}
                  </div>
                  <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: momentum.color }}>
                    ${token.symbol}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: 6 }}>
                  <div style={{ fontFamily: 'Orbitron', fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>FEES</div>
                  <div style={{ fontFamily: 'Orbitron', fontSize: 11, color: momentum.color }}>
                    {token.loadingFees
                      ? <span style={{ opacity: 0.4 }}>...</span>
                      : formatSol(token.lifetimeFees || 0)
                    }
                  </div>
                </div>
                <div style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: 6 }}>
                  <div style={{ fontFamily: 'Orbitron', fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>STATUS</div>
                  <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: token.status === 'GRADUATED' ? '#ffd700' : 'rgba(255,255,255,0.5)' }}>
                    {token.status || 'ACTIVE'}
                  </div>
                </div>
              </div>

              {/* Description */}
              {token.description && (
                <div style={{
                  marginTop: 10, fontFamily: 'Share Tech Mono', fontSize: 9,
                  color: 'rgba(255,255,255,0.35)', lineHeight: 1.5,
                  overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>
                  {token.description}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }} onClick={e => e.stopPropagation()}>
                <a
                  href={`https://bags.fm/${token.tokenMint}`}
                  target="_blank" rel="noopener noreferrer"
                  className="btn-cyber btn-green"
                  style={{ flex: 1, padding: '6px', borderRadius: 6, fontSize: 9, textAlign: 'center', textDecoration: 'none' }}
                >
                  BUY
                </a>
                <button
                  className="btn-cyber"
                  style={{ flex: 1, padding: '6px', borderRadius: 6, fontSize: 9 }}
                  onClick={() => { setSelectedToken(token.tokenMint); setPage('dashboard') }}
                >
                  CHART
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'Share Tech Mono', fontSize: 12 }}>
          No tokens found for this filter
        </div>
      )}
    </div>
  )
}
