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
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: form })
  const data = await res.json()
  if (!data.success) throw new Error('Gagal upload gambar: ' + data.error?.message)
  return data.data.url
}

const inputStyle = {
  width: '100%', padding: '10px 14px',
  background: 'rgba(0,245,255,0.03)',
  border: '1px solid rgba(0,245,255,0.15)',
  borderRadius: 8, color: '#e2e8f0',
  fontFamily: 'Share Tech Mono', fontSize: 13,
  outline: 'none', transition: 'border 0.2s',
}

const labelStyle = {
  display: 'block', fontFamily: 'Orbitron', fontSize: 10,
  color: 'rgba(0,245,255,0.6)', marginBottom: 6, letterSpacing: '0.1em',
}

export default function LaunchToken({ setPage }) {
  const { publicKey, signTransaction } = useWallet()
  const [form, setForm] = useState({ name: '', symbol: '', description: '', twitter: '', website: '', initialBuy: '0.1' })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [step, setStep] = useState('form')
  const [stepMsg, setStepMsg] = useState('')
  const [stepNum, setStepNum] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleInput = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  function handleImage(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 500000) { setError('Gambar terlalu besar, max 500KB'); return }
    setError('')
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function handleLaunch() {
    if (!publicKey) return
    setStep('launching'); setError('')
    try {
      let imageUrl = ''
      if (imageFile) {
        setStepMsg('Upload gambar...'); setStepNum(1)
        imageUrl = await uploadToImgBB(imageFile)
      }

      setStepMsg('Upload metadata token...'); setStepNum(2)
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
      if (!tokenMint) throw new Error('Token mint tidak ditemukan')

      setStepMsg('Ambil config...'); setStepNum(3)
      const pools = await getBagsPools()
      const configKey = pools?.[0]?.dbcConfigKey
      if (!configKey) throw new Error('Config key tidak tersedia')

      setStepMsg('Buat transaksi...'); setStepNum(4)
      const initialBuyLamports = Math.floor(Number(form.initialBuy) * SOL_TO_LAMPORTS)
      const txBase58 = await createLaunchTransaction({ ipfs: tokenMetadata, tokenMint, wallet: publicKey.toString(), initialBuyLamports, configKey })

      setStepMsg('Sign di wallet kamu...'); setStepNum(4)
      const txBuffer = bs58.decode(txBase58)
      let tx
      try { tx = VersionedTransaction.deserialize(txBuffer) }
      catch { tx = Transaction.from(Buffer.from(txBuffer)) }

      const signed = await signTransaction(tx)
      const signedB58 = bs58.encode(signed.serialize())
      const signature = await sendTransaction(signedB58)

      saveTokenToHistory(tokenMint, form.name, form.symbol.toUpperCase(), imagePreview)
      setResult({ tokenMint, signature, name: form.name, symbol: form.symbol.toUpperCase() })
      setStep('done')
    } catch (e) {
      setError(e.message); setStep('form')
    }
  }

  if (!publicKey) return (
    <div style={{ maxWidth: 500, margin: '0 auto', padding: '5rem 1rem', textAlign: 'center', position: 'relative', zIndex: 1 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⬡</div>
      <h2 style={{ fontFamily: 'Orbitron', fontSize: 18, color: '#00f5ff', marginBottom: 8 }}>WALLET REQUIRED</h2>
      <p style={{ fontFamily: 'Share Tech Mono', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>Connect Phantom or Solflare to launch</p>
      <WalletMultiButton />
    </div>
  )

  if (step === 'done' && result) return (
    <div style={{ maxWidth: 500, margin: '0 auto', padding: '4rem 1rem', textAlign: 'center', position: 'relative', zIndex: 1 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>◎</div>
      <h2 style={{ fontFamily: 'Orbitron', fontSize: 20, color: '#00ff88', marginBottom: 8, letterSpacing: '0.05em' }}>TOKEN DEPLOYED</h2>
      <p style={{ fontFamily: 'Share Tech Mono', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>Successfully launched on Solana mainnet</p>
      <div className="neon-card" style={{ borderRadius: 12, padding: '1.25rem', textAlign: 'left', marginBottom: 24 }}>
        {[
          ['TOKEN', `${result.name} ($${result.symbol})`],
          ['MINT', result.tokenMint?.slice(0,20) + '...'],
        ].map(([k,v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontFamily: 'Orbitron', fontSize: 10, color: 'rgba(0,245,255,0.5)' }}>{k}</span>
            <span style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: '#e2e8f0' }}>{v}</span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <a href={`https://solscan.io/tx/${result.signature}`} target="_blank" rel="noopener noreferrer"
            className="btn-cyber" style={{ flex: 1, padding: '8px', borderRadius: 6, textAlign: 'center', textDecoration: 'none', fontSize: 10 }}>
            SOLSCAN →
          </a>
          <a href={`https://bags.fm/${result.tokenMint}`} target="_blank" rel="noopener noreferrer"
            className="btn-cyber btn-green" style={{ flex: 1, padding: '8px', borderRadius: 6, textAlign: 'center', textDecoration: 'none', fontSize: 10 }}>
            BAGS.FM →
          </a>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button onClick={() => { setStep('form'); setForm({ name:'', symbol:'', description:'', twitter:'', website:'', initialBuy:'0.1' }); setImageFile(null); setImagePreview('') }}
          className="btn-cyber" style={{ padding: '10px 20px', borderRadius: 8 }}>LAUNCH AGAIN</button>
        <button onClick={() => setPage('dashboard')}
          className="btn-cyber btn-green" style={{ padding: '10px 20px', borderRadius: 8 }}>ANALYTICS →</button>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '2rem 1rem', position: 'relative', zIndex: 1 }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'Orbitron', fontSize: 20, fontWeight: 700, color: '#00f5ff', letterSpacing: '0.05em' }}>◈ LAUNCH TOKEN</h1>
        <p style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'rgba(0,245,255,0.5)', marginTop: 4 }}>DEPLOY NEW TOKEN ON BAGS.FM — EARN 1% FOREVER</p>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(255,50,50,0.08)', border: '1px solid rgba(255,50,50,0.3)', color: '#ff6b6b', fontFamily: 'Share Tech Mono', fontSize: 11, marginBottom: 16, wordBreak: 'break-all' }}>
          ⚠ {error}
        </div>
      )}

      {step === 'launching' && (
        <div style={{ padding: '16px', borderRadius: 8, background: 'rgba(0,245,255,0.05)', border: '1px solid rgba(0,245,255,0.2)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 16, height: 16, border: '2px solid #00f5ff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontFamily: 'Share Tech Mono', fontSize: 12, color: '#00f5ff' }}>{stepMsg}</span>
          </div>
          <div style={{ height: 2, background: 'rgba(0,245,255,0.1)', borderRadius: 1 }}>
            <div style={{ height: '100%', background: '#00f5ff', borderRadius: 1, width: `${(stepNum / 4) * 100}%`, transition: 'width 0.5s' }} />
          </div>
        </div>
      )}

      <div className="neon-card" style={{ borderRadius: 12, padding: '1.5rem' }}>
        {/* Image */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={labelStyle}>TOKEN IMAGE <span style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'Share Tech Mono', fontSize: 9 }}>(MAX 500KB)</span></label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', border: '1px solid rgba(0,245,255,0.3)', background: 'rgba(0,245,255,0.03)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {imagePreview ? <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ color: 'rgba(0,245,255,0.3)', fontSize: 20 }}>◎</span>}
            </div>
            <label className="btn-cyber" style={{ padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>
              UPLOAD
              <input type="file" accept="image/*" onChange={handleImage} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* Name & Symbol */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1rem' }}>
          <div>
            <label style={labelStyle}>TOKEN NAME *</label>
            <input name="name" value={form.name} onChange={handleInput} placeholder="e.g. Einstein Sol" maxLength={32} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>SYMBOL *</label>
            <input name="symbol" value={form.symbol} onChange={handleInput} placeholder="e.g. ESOL" maxLength={10} style={{ ...inputStyle, textTransform: 'uppercase' }} />
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>DESCRIPTION *</label>
          <textarea name="description" value={form.description} onChange={handleInput} placeholder="Describe your token..." rows={3} maxLength={1000}
            style={{ ...inputStyle, resize: 'none' }} />
        </div>

        {/* Social */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1rem' }}>
          <div>
            <label style={labelStyle}>TWITTER</label>
            <input name="twitter" value={form.twitter} onChange={handleInput} placeholder="https://x.com/..." style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>WEBSITE</label>
            <input name="website" value={form.website} onChange={handleInput} placeholder="https://..." style={inputStyle} />
          </div>
        </div>

        {/* Initial Buy */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={labelStyle}>INITIAL BUY (SOL) *</label>
          <input name="initialBuy" type="number" step="0.001" min="0.001" value={form.initialBuy} onChange={handleInput} style={inputStyle} />
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Minimum 0.001 SOL</div>
        </div>

        <button
          onClick={handleLaunch}
          disabled={!form.name || !form.symbol || !form.description || step === 'launching'}
          className="btn-cyber btn-green"
          style={{ width: '100%', padding: '14px', borderRadius: 10, fontSize: 13, letterSpacing: '0.15em' }}
        >
          {step === 'launching' ? '◌ DEPLOYING...' : '◎ DEPLOY TOKEN TO SOLANA'}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
