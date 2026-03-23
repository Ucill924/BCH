import { useEffect, useState } from 'react'
import { Buffer } from 'buffer'
import bs58 from 'bs58'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { VersionedTransaction, Transaction } from '@solana/web3.js'
import {
  getTokenLifetimeFees, getTokenClaimStats,
  getTokenClaimEvents, formatSol, lamportsToSol
} from '../services/bagsApi'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const PROXY = '/api/bags-proxy'

async function getClaimablePositions(wallet) {
  const q = new URLSearchParams({ path: '/token-launch/claimable-positions', wallet })
  const res = await fetch(`${PROXY}?${q}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error)
  return data.response || []
}

async function getClaimTxs(feeClaimer, tokenMint) {
  const q = new URLSearchParams({ path: '/token-launch/claim-txs/v3' })
  const res = await fetch(`${PROXY}?${q}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feeClaimer, tokenMint }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error)
  return data.response || []
}

async function sendTx(transaction) {
  const q = new URLSearchParams({ path: '/solana/send-transaction' })
  const res = await fetch(`${PROXY}?${q}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error)
  return data.response
}

export default function Dashboard({ selectedToken, setSelectedToken }) {
  const { publicKey, signTransaction } = useWallet()
  const [activeToken, setActiveToken] = useState(null)
  const [stats, setStats] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchMint, setSearchMint] = useState(selectedToken || '')

  // Claim state
  const [claimPositions, setClaimPositions] = useState([])
  const [claimLoading, setClaimLoading] = useState(false)
  const [claimMsg, setClaimMsg] = useState('')
  const [claimSuccess, setClaimSuccess] = useState('')

  useEffect(() => {
    if (selectedToken) { setSearchMint(selectedToken); loadTokenData(selectedToken) }
  }, [selectedToken])

  useEffect(() => {
    if (publicKey) loadClaimablePositions()
  }, [publicKey])

  async function loadClaimablePositions() {
    if (!publicKey) return
    try {
      const positions = await getClaimablePositions(publicKey.toString())
      setClaimPositions(positions)
    } catch (e) { console.error(e) }
  }

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
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  async function handleClaim(position) {
    if (!publicKey || !signTransaction) return
    setClaimLoading(true)
    setClaimMsg('Membuat transaksi claim...')
    setClaimSuccess('')
    try {
      const txs = await getClaimTxs(publicKey.toString(), position.baseMint)
      if (!txs.length) throw new Error('Tidak ada transaksi untuk di-claim')

      const signatures = []
      for (let i = 0; i < txs.length; i++) {
        setClaimMsg(`Sign transaksi ${i + 1}/${txs.length} di Phantom...`)
        const txData = txs[i]
        const txBuffer = bs58.decode(txData.tx)
        let tx
        try { tx = VersionedTransaction.deserialize(txBuffer) }
        catch { tx = Transaction.from(Buffer.from(txBuffer)) }

        const signed = await signTransaction(tx)
        const signedB64 = Buffer.from(signed.serialize()).toString('base64')
        const sig = await sendTx(signedB64)
        signatures.push(sig)
      }

      setClaimSuccess(`Berhasil claim! TX: ${signatures[0]?.slice(0, 20)}...`)
      setClaimMsg('')
      loadClaimablePositions()
      if (activeToken) loadTokenData(activeToken)
    } catch (e) {
      setClaimMsg('')
      setError('Claim gagal: ' + e.message)
    }
    setClaimLoading(false)
  }

  const totalClaimable = claimPositions.reduce(
    (sum, p) => sum + (p.totalClaimableLamportsUserShare || 0), 0
  )

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
          <p className="text-white/50 text-sm mt-1">Analytics & claim fees token kamu</p>
        </div>
        {!publicKey && <WalletMultiButton />}
      </div>

      {/* Claim Banner - muncul kalau ada fee yang bisa di-claim */}
      {publicKey && totalClaimable > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-emerald-400 font-semibold text-lg">
                💰 {formatSol(totalClaimable)} siap di-claim!
              </div>
              <div className="text-emerald-400/60 text-sm mt-0.5">
                Dari {claimPositions.length} posisi token
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {claimPositions.map((pos, i) => (
                <button
                  key={i}
                  onClick={() => handleClaim(pos)}
                  disabled={claimLoading}
                  className="px-5 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {claimLoading
                    ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />{claimMsg}</>
                    : <>Claim {formatSol(pos.totalClaimableLamportsUserShare)} →</>
                  }
                </button>
              ))}
            </div>
          </div>
          {claimSuccess && (
            <div className="mt-3 text-emerald-300 text-sm">✅ {claimSuccess}</div>
          )}
        </div>
      )}

      {publicKey && totalClaimable === 0 && claimPositions.length === 0 && (
        <div className="mb-6 p-3 rounded-xl bg-white/3 border border-white/10 flex items-center justify-between">
          <span className="text-white/40 text-sm">Tidak ada fee yang bisa di-claim saat ini</span>
          <button onClick={loadClaimablePositions} className="text-xs text-emerald-400 hover:text-emerald-300">
            ↻ Cek ulang
          </button>
        </div>
      )}

      {/* Search */}
      <div className="flex gap-2 mb-6">
        <input type="text" placeholder="Masukkan token mint address..."
          value={searchMint} onChange={e => setSearchMint(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && loadTokenData(searchMint)}
          className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-emerald-500/50 font-mono" />
        <button onClick={() => loadTokenData(searchMint)} disabled={loading || !searchMint}
          className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50">
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
              { label: 'Bisa di-claim', value: formatSol(totalClaimable), sub: 'Dari semua posisi', color: 'text-blue-400' },
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
                  <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#fff' }} formatter={v => [v.toFixed(4) + ' SOL', 'Fee']} />
                  <Bar dataKey="fees" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={i === chartData.length - 1 ? '#1D9E75' : '#1D9E7560'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="p-5 rounded-xl bg-white/5 border border-white/10">
              <h3 className="text-sm font-medium text-white/60 mb-4 uppercase tracking-wide">Aktivitas Terbaru</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {events.length === 0
                  ? <p className="text-white/30 text-sm text-center py-8">Belum ada aktivitas</p>
                  : events.slice(0, 10).map((e, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0 bg-emerald-400" />
                      <span className="text-sm text-white/70 flex-1 truncate">
                        {e.wallet ? e.wallet.slice(0, 8) + '...' : 'Claim event'}
                      </span>
                      <span className="text-sm font-medium text-emerald-400">{formatSol(e.amount || 0)}</span>
                      <span className="text-xs text-white/30 flex-shrink-0">
                        {e.timestamp ? new Date(Number(e.timestamp) * 1000).toLocaleDateString('id-ID') : '-'}
                      </span>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-4">
            <span className="text-white/40 text-sm flex-shrink-0">Token Mint</span>
            <span className="text-white/70 text-xs font-mono truncate">{activeToken}</span>
            <a href={`https://bags.fm/${activeToken}`} target="_blank" rel="noopener noreferrer"
              className="text-emerald-400 text-xs hover:underline flex-shrink-0">Lihat di Bags →</a>
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
