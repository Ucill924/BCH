import { useEffect, useState } from 'react'
import { getTokenFeed, getTokenLifetimeFees, formatSol, shortAddress } from '../services/bagsApi'

export default function Leaderboard({ setPage, setSelectedToken }) {
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadFeed() }, [])

  async function loadFeed() {
    setLoading(true)
    setError('')
    try {
      const feed = await getTokenFeed()
      const top = feed.slice(0, 20)
      const withFees = await Promise.all(
        top.map(async (token) => {
          try {
            const fees = await getTokenLifetimeFees(token.tokenMint)
            return { ...token, lifetimeFees: fees }
          } catch {
            return { ...token, lifetimeFees: '0' }
          }
        })
      )
      withFees.sort((a, b) => Number(b.lifetimeFees) - Number(a.lifetimeFees))
      setTokens(withFees)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  function openDashboard(token) {
    setSelectedToken(token.tokenMint)
    setPage('dashboard')
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">🏆 Leaderboard</h1>
          <p className="text-white/50 text-sm mt-1">Token terpopuler di Bags.fm hari ini</p>
        </div>
        <button onClick={loadFeed} disabled={loading}
          className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm hover:bg-emerald-500/30 transition-all disabled:opacity-50">
          {loading ? 'Loading...' : '↻ Refresh'}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-6">
          Error: {error}
        </div>
      )}

      {loading && tokens.length === 0 ? (
        <div className="grid gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {tokens.map((token, index) => (
            <div key={token.tokenMint} onClick={() => openDashboard(token)}
              className="group flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 hover:border-emerald-500/30 transition-all cursor-pointer">
              <div className={`w-8 text-center font-bold text-lg ${
                index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-white/30'
              }`}>{index + 1}</div>
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                {token.image
                  ? <img src={token.image} alt={token.name} className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />
                  : <span className="text-emerald-400 font-bold text-sm">{token.symbol?.slice(0, 2) || '??'}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{token.name || 'Unknown'}</span>
                  <span className="text-xs text-white/40">${token.symbol}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    token.status === 'LAUNCHED'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-white/5 text-white/40 border-white/10'
                  }`}>{token.status || 'PRE_LAUNCH'}</span>
                </div>
                <div className="text-xs text-white/30 mt-0.5 font-mono truncate">{shortAddress(token.tokenMint)}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-emerald-400 font-semibold">{formatSol(token.lifetimeFees || 0)}</div>
                <div className="text-xs text-white/30">lifetime fees</div>
              </div>
              <div className="text-white/20 group-hover:text-emerald-400 transition-colors text-lg">→</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
