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
  try { return JSON.parse(localStorage.getItem('launched_tokens') || '[]') }
  catch { return [] }
}

const s = {
  label: { display: 'block', fontFamily: 'Orbitron', fontSize: 9, color: 'rgba(0,245,255,0.6)', marginBottom: 5, letterSpacing: '0.1em' },
  input: { width: '100%', padding: '9px 12px', background: 'rgba(0,245,255,0.03)', border: '1px solid rgba(0,245,255,0.15)', borderRadius: 6, color: '#e2e8f0', fontFamily: 'Share Tech Mono', fontSize: 12, outline: 'none' },
}

export default function MyTokens({ setPage, setSelectedToken }) {
  const { publicKey } = useWallet()
  const [tokens, setTokens] = useState([])
  const [fees, setFees] = useState({})
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addMint, setAddMint] = useState('')
  const [addName, setAddName] = useState('')
  const [addSymbol, setAddSymbol] = useState('')

  useEffect(() => {
    const history = getTokenHistory()
    setTokens(history)
    if (history.length > 0) loadFees(history)
  }, [])

  async function loadFees(tokenList) {
    setLoading(true)
    const results = {}
    await Promise.all(tokenList.map(async t => {
      try { results[t.tokenMint] = await getTokenLifetimeFees(t.tokenMint) }
      catch { results[t.tokenMint] = '0' }
    }))
    setFees(results)
    setLoading(false)
  }

  function addManual() {
    if (!addMint) return
    saveTokenToHistory(addMint.trim(), addName || 'Unknown', addSymbol || '???', '')
    const updated = getTokenHistory()
    setTokens(updated)
    loadFees(updated)
    setAddMint(''); setAddName(''); setAddSymbol(''); setShowAdd(false)
  }

  function removeToken(tokenMint) {
    const updated = tokens.filter(t => t.tokenMint !== tokenMint)
    setTokens(updated)
    localStorage.setItem('launched_tokens', JSON.stringify(updated))
  }

  if (!publicKey) return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '5rem 1rem', textAlign: 'center', position: 'relative', zIndex: 1 }}>
      <div style={{ fontSize: 40, marginBottom: 16, color: '#00f5ff' }}>◈</div>
      <h2 style={{ fontFamily: 'Orbitron', fontSize: 16, color: '#00f5ff', marginBottom: 8 }}>CONNECT WALLET</h2>
      <WalletMultiButton />
    </div>
  )

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem', position: 'relative', zIndex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Orbitron', fontSize: 20, fontWeight: 700, color: '#00f5ff', letterSpacing: '0.05em' }}>◈ MY TOKENS</h1>
          <p style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'rgba(0,245,255,0.5)', marginTop: 4 }}>TOKENS LAUNCHED VIA THIS TERMINAL</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-cyber" style={{ padding: '8px 14px', borderRadius: 6, fontSize: 10 }}
            onClick={() => setShowAdd(!showAdd)}>+ ADD TOKEN</button>
          <button className="btn-cyber btn-green" style={{ padding: '8px 14px', borderRadius: 6, fontSize: 10 }}
            onClick={() => setPage('launch')}>◎ LAUNCH NEW</button>
        </div>
      </div>

      {/* Add token manual form */}
      {showAdd && (
        <div className="neon-card" style={{ borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: 'rgba(0,245,255,0.7)', marginBottom: 12, letterSpacing: '0.1em' }}>
            ◈ ADD TOKEN MANUALLY
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={s.label}>TOKEN MINT ADDRESS *</label>
              <input value={addMint} onChange={e => setAddMint(e.target.value)} placeholder="Base58 address..." style={s.input} />
            </div>
            <div>
              <label style={s.label}>NAME</label>
              <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="My Token" style={s.input} />
            </div>
            <div>
              <label style={s.label}>SYMBOL</label>
              <input value={addSymbol} onChange={e => setAddSymbol(e.target.value)} placeholder="MTK" style={s.input} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-cyber btn-green" style={{ padding: '8px 16px', borderRadius: 6, fontSize: 10 }}
              onClick={addManual} disabled={!addMint}>ADD TO HISTORY</button>
            <button className="btn-cyber" style={{ padding: '8px 16px', borderRadius: 6, fontSize: 10 }}
              onClick={() => setShowAdd(false)}>CANCEL</button>
          </div>
        </div>
      )}

      {tokens.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '5rem 1rem', color: 'rgba(255,255,255,0.2)' }}>
          <div style={{ fontSize: 40, marginBottom: 12, color: 'rgba(0,245,255,0.3)' }}>◎</div>
          <p style={{ fontFamily: 'Share Tech Mono', fontSize: 12, marginBottom: 16 }}>No tokens in history</p>
          <p style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'rgba(0,245,255,0.3)' }}>Launch a token or add one manually</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tokens.map(token => (
            <div key={token.tokenMint} className="neon-card" style={{ borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(0,245,255,0.2)', background: 'rgba(0,245,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {token.image
                  ? <img src={token.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
                  : <span style={{ fontFamily: 'Orbitron', fontSize: 12, color: '#00f5ff' }}>{token.symbol?.slice(0,2)}</span>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontFamily: 'Orbitron', fontSize: 13, color: '#e2e8f0' }}>{token.name}</span>
                  <span style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'rgba(0,245,255,0.5)' }}>${token.symbol}</span>
                </div>
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{shortAddress(token.tokenMint)}</div>
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>
                  {new Date(token.launchedAt).toLocaleDateString('id-ID')}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginRight: 12 }}>
                {loading
                  ? <div style={{ width: 60, height: 14, background: 'rgba(255,255,255,0.05)', borderRadius: 3 }} />
                  : <div style={{ fontFamily: 'Orbitron', fontSize: 12, color: '#00f5ff' }}>{formatSol(fees[token.tokenMint] || 0)}</div>
                }
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>fees earned</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="btn-cyber" style={{ padding: '5px 10px', borderRadius: 5, fontSize: 9 }}
                  onClick={() => { setSelectedToken(token.tokenMint); setPage('dashboard') }}>ANALYTICS</button>
                <a href={`https://bags.fm/${token.tokenMint}`} target="_blank" rel="noopener noreferrer"
                  className="btn-cyber btn-green" style={{ padding: '5px 10px', borderRadius: 5, fontSize: 9, textDecoration: 'none' }}>BAGS.FM</a>
                <button onClick={() => removeToken(token.tokenMint)}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,50,50,0.4)', cursor: 'pointer', fontSize: 14, padding: '4px 6px' }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tokens.length > 0 && (
        <p style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'rgba(255,255,255,0.15)', textAlign: 'center', marginTop: '1.5rem' }}>
          {tokens.length} TOKENS — STORED LOCALLY IN BROWSER
        </p>
      )}
    </div>
  )
}
