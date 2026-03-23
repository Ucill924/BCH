import { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { getTokenLifetimeFees, formatSol, shortAddress } from '../services/bagsApi'

export function saveTokenToHistory(tokenMint, name, symbol, image) {
  try {
    const existing = JSON.parse(localStorage.getItem('launched_tokens') || '[]')
    const updated = [
      { tokenMint, name, symbol, image, launchedAt: Date.now() },
      ...existing.filter(t => t.tokenMint !== tokenMint),
    ].slice(0, 50)
    localStorage.setItem('launched_tokens', JSON.stringify(updated))
  } catch (e) { console.error(e) }
}

export function getTokenHistory() {
  try {
    return JSON.parse(localStorage.getItem('launched_tokens') || '[]')
  } catch { return [] }
}

export default function MyTokens({ setPage, setSelectedToken }) {
  const { publicKey } = useWallet()
  const [tokens, setTokens] = useState([])
  const [fees, setFees] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const history = getTokenHistory()
    setTokens(history)
    if (history.length > 0) loadFees(history)
  }, [])

  async function loadFees(tokenList) {
    setLoading(true)
    const results = {}
    await Promise.all(
      tokenList.map(async (t) => {
        try {
          const fee = await getTokenLifetimeFees(t.tokenMint)
          results[t.tokenMint] = fee
        } catch { results[t.tokenMint] = '0' }
      })
    )
    setFees(results)
    setLoading(false)
  }

  function openDashboard(tokenMint) {
    setSelectedToken(tokenMint)
    setPage('dashboard')
  }

  function removeToken(tokenMint) {
    const updated = tokens.filter(t => t.tokenMint !== tokenMint)
    setTokens(updated)
    localStorage.setItem('launched_tokens', JSON.stringify(updated))
  }

  if (!publicKey) return (
    <div className="max-w-6xl mx-auto px-4 py-20 text-center">
      <div className="text-6xl mb-4">👛</div>
      <h2 className="text-xl font-semibold text-white mb-2">Connect wallet dulu</h2>
      <WalletMultiButton />
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">🗂️ My Tokens</h1>
          <p className="text-white/50 text-sm mt-1">Token yang pernah kamu launch via app ini</p>
        </div>
        <button
          onClick={() => setPage('launch')}
          className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600"
        >
          + Launch Token Baru
        </button>
      </div>

      {tokens.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <div className="text-5xl mb-4">🚀</div>
          <p className="mb-4">Belum ada token yang di-launch</p>
          <button
            onClick={() => setPage('launch')}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600"
          >
            Launch Token Pertamamu →
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {tokens.map((token) => (
            <div key={token.tokenMint}
              className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/30 transition-all group">
              {/* Image */}
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                {token.image
                  ? <img src={token.image} alt={token.name} className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />
                  : <span className="text-emerald-400 font-bold text-sm">{token.symbol?.slice(0,2)}</span>
                }
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-white">{token.name}</span>
                  <span className="text-xs text-white/40">${token.symbol}</span>
                </div>
                <div className="text-xs text-white/30 font-mono">{shortAddress(token.tokenMint)}</div>
                <div className="text-xs text-white/20 mt-0.5">
                  {new Date(token.launchedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>

              {/* Fee */}
              <div className="text-right flex-shrink-0">
                {loading ? (
                  <div className="w-16 h-4 bg-white/10 rounded animate-pulse" />
                ) : (
                  <div className="text-emerald-400 font-semibold">{formatSol(fees[token.tokenMint] || 0)}</div>
                )}
                <div className="text-xs text-white/30">lifetime fees</div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => openDashboard(token.tokenMint)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs hover:bg-emerald-500/30 transition-colors"
                >
                  Dashboard
                </button>
                <a
                  href={`https://bags.fm/${token.tokenMint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 text-xs hover:bg-white/10 transition-colors"
                >
                  Bags.fm
                </a>
                <button
                  onClick={() => removeToken(token.tokenMint)}
                  className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tokens.length > 0 && (
        <p className="text-xs text-white/20 text-center mt-6">
          History disimpan di browser kamu · {tokens.length} token
        </p>
      )}
    </div>
  )
}
