import { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import {
  getTokenLifetimeFees, getTokenClaimStats,
  getTokenClaimEvents, formatSol, lamportsToSol
} from '../services/bagsApi'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function Dashboard({ selectedToken, setSelectedToken }) {
  const { publicKey } = useWallet()
  const [activeToken, setActiveToken] = useState(null)
  const [stats, setStats] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchMint, setSearchMint] = useState(selectedToken || '')

  useEffect(() => {
    if (selectedToken) {
      setSearchMint(selectedToken)
      loadTokenData(selectedToken)
    }
  }, [selectedToken])

  async function loadTokenData(mint) {
    if (!mint) return
    setLoading(true)
    setError('')
    setStats(null)
    setEvents([])
    try {
      const [fees, claimStats, claimEventsRaw] = await Promise.all([
        getTokenLifetimeFees(mint),
        getTokenClaimStats(mint).catch(() => []),
        getTokenClaimEvents(mint).catch(() => ({ events: [] })),
      ])
      setActiveToken(mint)
      const totalClaimed = Array.isArray(claimStats)
        ? claimStats.reduce((sum, c) => sum + Number(c.totalClaimed || 0), 0)
        : 0
      setStats({ fees, totalClaimed })
      setEvents(claimEventsRaw?.events || [])
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const chartData = (() => {
    const days = {}
    const now = Date.now()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86400000)
      const key = d.toLocaleDateString('id-ID', { weekday: 'short' })
      days[key] = { day: key, fees: 0 }
    }
    events.forEach(e => {
      const d = new Date(Number(e.timestamp) * 1000)
      const key = d.toLocaleDateString('id-ID', { weekday: 'short' })
      if (days[key]) days[key].fees += lamportsToSol(e.amount || 0)
    })
    return Object.values(days)
  })()

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">📊 Dashboard</h1>
          <p className="text-white/50 text-sm mt-1">Analytics token di Bags.fm</p>
        </div>
        {!publicKey && <WalletMultiButton />}
      </div>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="Masukkan token mint address..."
          value={searchMint}
          onChange={e => setSearchMint(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && loadTokenData(searchMint)}
          className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-emerald-500/50 font-mono"
        />
        <button
          onClick={() => loadTokenData(searchMint)}
          disabled={loading || !searchMint}
          className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
        >
          {loading ? '...' : 'Cek'}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-6">
          ⚠️ {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/40 text-sm">Memuat data...</p>
        </div>
      )}

      {stats && !loading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total fee earned', value: formatSol(stats.fees || 0), sub: 'Sejak launch', color: 'text-emerald-400' },
              { label: 'Total claimed', value: formatSol(stats.totalClaimed || 0), sub: 'Sudah dicairkan', color: 'text-purple-400' },
              { label: 'Jumlah event', value: events.length, sub: 'Total claim events', color: 'text-amber-400' },
              { label: 'Token mint', value: activeToken?.slice(0,6) + '...', sub: activeToken?.slice(-6), color: 'text-white/60' },
            ].map(c => (
              <div key={c.label} className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-xs text-white/40 mb-2">{c.label}</div>
                <div className={`text-xl font-semibold ${c.color}`}>{c.value}</div>
                <div className="text-xs text-white/30 mt-1">{c.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-white/5 border border-white/10">
              <h3 className="text-sm font-medium text-white/60 mb-4 uppercase tracking-wide">Fee 7 Hari Terakhir</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="day" tick={{ fill: '#ffffff40', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#ffffff40', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#fff' }}
                    formatter={v => [v.toFixed(4) + ' SOL', 'Fee']}
                  />
                  <Bar dataKey="fees" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={i === chartData.length - 1 ? '#1D9E75' : '#1D9E7560'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="p-5 rounded-xl bg-white/5 border border-white/10">
              <h3 className="text-sm font-medium text-white/60 mb-4 uppercase tracking-wide">Aktivitas Terbaru</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {events.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-8">Belum ada aktivitas</p>
                ) : (
                  events.slice(0, 10).map((e, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0 bg-emerald-400" />
                      <span className="text-sm text-white/70 flex-1 truncate">
                        {e.wallet ? e.wallet.slice(0, 8) + '...' : 'Claim event'}
                      </span>
                      <span className="text-sm font-medium text-emerald-400">
                        {formatSol(e.amount || 0)}
                      </span>
                      <span className="text-xs text-white/30 flex-shrink-0">
                        {e.timestamp ? new Date(Number(e.timestamp) * 1000).toLocaleDateString('id-ID') : '-'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-4">
            <span className="text-white/40 text-sm flex-shrink-0">Token Mint</span>
            <span className="text-white/70 text-xs font-mono truncate">{activeToken}</span>
            <a
              href={`https://bags.fm/${activeToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 text-xs hover:underline flex-shrink-0"
            >
              Lihat di Bags →
            </a>
          </div>
        </>
      )}

      {!stats && !loading && !error && (
        <div className="text-center py-20 text-white/30">
          <div className="text-5xl mb-4">📊</div>
          <p>Klik token di Leaderboard atau masukkan token mint address</p>
        </div>
      )}
    </div>
  )
}
