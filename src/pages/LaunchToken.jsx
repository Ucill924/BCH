import { useState } from 'react'
import { Buffer } from 'buffer'
import bs58 from 'bs58'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { createTokenInfo, createLaunchTransaction, sendTransaction, getBagsPools } from '../services/bagsApi'
import { VersionedTransaction, Transaction } from '@solana/web3.js'
import { saveTokenToHistory } from './MyTokens'

const SOL_TO_LAMPORTS = 1_000_000_000
const IMGBB_API_KEY = '8be3cfa2c9a1b53c82039a958ab9894e'

async function uploadToImgBB(file) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const form = new FormData()
  form.append('image', base64)
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: 'POST',
    body: form,
  })
  const data = await res.json()
  if (!data.success) throw new Error('Gagal upload gambar: ' + data.error?.message)
  return data.data.url
}

export default function LaunchToken({ setPage }) {
  const { publicKey, signTransaction } = useWallet()
  const [form, setForm] = useState({
    name: '', symbol: '', description: '', twitter: '', website: '', initialBuy: '0.1',
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [step, setStep] = useState('form')
  const [stepMsg, setStepMsg] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  function handleInput(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })) }

  function handleImage(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 500000) {
      setError('Gambar terlalu besar, maksimal 500KB')
      return
    }
    setError('')
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function handleLaunch() {
    if (!publicKey) return
    setStep('launching')
    setError('')

    try {
      // Step 1: Upload gambar ke ImgBB
      let imageUrl = ''
      if (imageFile) {
        setStepMsg('1/4 — Upload gambar...')
        imageUrl = await uploadToImgBB(imageFile)
      }

      // Step 2: Upload metadata ke Bags API
      setStepMsg('2/4 — Upload metadata token...')
      const tokenPayload = {
        name: form.name,
        symbol: form.symbol.toUpperCase(),
        description: form.description || '-',
        ...(imageUrl && { imageUrl }),
        ...(form.twitter && { twitter: form.twitter }),
        ...(form.website && { website: form.website }),
  }

const info = await createTokenInfo(tokenPayload)
      const { tokenMint, tokenMetadata } = info
      if (!tokenMint) throw new Error('Token mint tidak ditemukan di response')

      // Step 3: Ambil config key
      setStepMsg('3/4 — Ambil config...')
      const pools = await getBagsPools()
      const configKey = pools?.[0]?.dbcConfigKey
      if (!configKey) throw new Error('Config key tidak tersedia')

      // Step 4: Buat dan sign transaksi
      setStepMsg('4/4 — Sign dengan wallet kamu...')
      const initialBuyLamports = Math.floor(Number(form.initialBuy) * SOL_TO_LAMPORTS)
      const txBase58 = await createLaunchTransaction({
        ipfs: tokenMetadata,
        tokenMint,
        wallet: publicKey.toString(),
        initialBuyLamports,
        configKey,
      })

      // Response adalah Base58 — decode dulu sebelum deserialize
      const txBuffer = bs58.decode(txBase58)
      let tx
      try {
        tx = VersionedTransaction.deserialize(txBuffer)
      } catch {
        tx = Transaction.from(Buffer.from(txBuffer))
      }

      // Sign dan kirim
      const signed = await signTransaction(tx)
      const signedB64 = Buffer.from(signed.serialize()).toString('base64')
      const signature = await sendTransaction(signedB64)

      setResult({ tokenMint, signature, name: form.name, symbol: form.symbol.toUpperCase() })
      saveTokenToHistory(tokenMint, form.name, form.symbol.toUpperCase(), imagePreview)
      setStep('done')

    } catch (e) {
      setError(e.message)
      setStep('form')
    }
  }

  if (!publicKey) return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <div className="text-6xl mb-4">👛</div>
      <h2 className="text-xl font-semibold text-white mb-2">Connect wallet dulu</h2>
      <p className="text-white/50 mb-6 text-sm">Butuh wallet Solana (Phantom/Solflare)</p>
      <WalletMultiButton />
    </div>
  )

  if (step === 'done' && result) return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <div className="text-6xl mb-4">🎉</div>
      <h2 className="text-2xl font-bold text-white mb-2">Token berhasil di-launch!</h2>
      <div className="p-5 rounded-xl bg-white/5 border border-white/10 text-left space-y-3 mb-8">
        <div className="flex justify-between">
          <span className="text-white/50 text-sm">Token</span>
          <span className="text-white font-medium">{result.name} (${result.symbol})</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50 text-sm">Mint</span>
          <span className="text-white/70 text-xs font-mono">{result.tokenMint?.slice(0,16)}...</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50 text-sm">Solscan</span>
          <a href={`https://solscan.io/tx/${result.signature}`} target="_blank" rel="noopener noreferrer"
            className="text-emerald-400 text-xs hover:underline">Lihat transaksi →</a>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50 text-sm">Bags.fm</span>
          <a href={`https://bags.fm/${result.tokenMint}`} target="_blank" rel="noopener noreferrer"
            className="text-emerald-400 text-xs hover:underline">Lihat di Bags →</a>
        </div>
      </div>
      <div className="flex gap-3 justify-center">
        <button onClick={() => {
          setStep('form')
          setForm({ name:'', symbol:'', description:'', twitter:'', website:'', initialBuy:'0.1' })
          setImageFile(null)
          setImagePreview('')
        }} className="px-5 py-2.5 rounded-xl border border-white/20 text-white/70 text-sm hover:bg-white/5">
          Launch lagi
        </button>
        <button onClick={() => setPage('dashboard')}
          className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600">
          Lihat Dashboard →
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">🚀 Launch Token</h1>
        <p className="text-white/50 text-sm mt-1">Buat token baru di Bags.fm</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-6">⚠️ {error}</div>
      )}
      {step === 'launching' && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm mb-6 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          {stepMsg}
        </div>
      )}

      <div className="space-y-5">
        <div>
          <label className="block text-sm text-white/60 mb-2">Gambar Token <span className="text-white/30">(maks 500KB)</span></label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
              {imagePreview
                ? <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                : <span className="text-white/20 text-2xl">+</span>
              }
            </div>
            <label className="cursor-pointer px-4 py-2 rounded-lg border border-white/20 text-white/60 text-sm hover:bg-white/5">
              Pilih gambar
              <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-white/60 mb-2">Nama Token *</label>
            <input name="name" value={form.name} onChange={handleInput} placeholder="Einstein Sol" maxLength={32}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">Simbol *</label>
            <input name="symbol" value={form.symbol} onChange={handleInput} placeholder="EIS" maxLength={10}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-emerald-500/50" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-2">Deskripsi *</label>
          <textarea name="description" value={form.description} onChange={handleInput}
            placeholder="Ceritakan tentang token kamu..." rows={3} maxLength={1000}
            className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-emerald-500/50 resize-none" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-white/60 mb-2">Twitter (opsional)</label>
            <input name="twitter" value={form.twitter} onChange={handleInput} placeholder="https://x.com/..."
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">Website (opsional)</label>
            <input name="website" value={form.website} onChange={handleInput} placeholder="https://..."
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-emerald-500/50" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-2">Initial Buy (SOL) *</label>
          <input name="initialBuy" type="number" step="0.001" min="0.001" value={form.initialBuy} onChange={handleInput}
            className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-emerald-500/50" />
          <p className="text-xs text-white/30 mt-1">Minimum 0.001 SOL</p>
        </div>

        <button
          onClick={handleLaunch}
          disabled={!form.name || !form.symbol || !form.description || step === 'launching'}
          className="w-full py-3 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {step === 'launching' ? '⏳ Launching...' : '🚀 Launch Token'}
        </button>
      </div>
    </div>
  )
}
