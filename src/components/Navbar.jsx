import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

const NAV = [
  { id: 'leaderboard', label: 'RADAR' },
  { id: 'dashboard', label: 'ANALYTICS' },
  { id: 'mytokens', label: 'MY TOKENS' },
  { id: 'launch', label: 'LAUNCH' },
]

export default function Navbar({ page, setPage }) {
  return (
    <nav style={{
      borderBottom: '1px solid rgba(0,245,255,0.1)',
      background: 'rgba(3,7,18,0.8)',
      backdropFilter: 'blur(20px)',
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo */}
        <div
          onClick={() => setPage('leaderboard')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 6,
            border: '1px solid rgba(0,245,255,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,245,255,0.05)',
            boxShadow: '0 0 15px rgba(0,245,255,0.2)',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <polygon points="8,1 15,5 15,11 8,15 1,11 1,5" stroke="#00f5ff" strokeWidth="1" fill="rgba(0,245,255,0.1)"/>
              <circle cx="8" cy="8" r="2" fill="#00f5ff"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: 'Orbitron', fontSize: 13, fontWeight: 700, color: '#00f5ff', letterSpacing: '0.1em' }}>
              BAGS.HUB
            </div>
            <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'rgba(0,245,255,0.5)', letterSpacing: '0.2em' }}>
              CREATOR TERMINAL v2.0
            </div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ display: 'flex', gap: 4 }}>
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              style={{
                padding: '6px 14px',
                background: page === item.id ? 'rgba(0,245,255,0.1)' : 'transparent',
                border: page === item.id ? '1px solid rgba(0,245,255,0.4)' : '1px solid transparent',
                borderRadius: 6,
                color: page === item.id ? '#00f5ff' : 'rgba(255,255,255,0.4)',
                fontFamily: 'Orbitron',
                fontSize: 10,
                letterSpacing: '0.1em',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: page === item.id ? '0 0 10px rgba(0,245,255,0.1)' : 'none',
              }}
              onMouseEnter={e => { if (page !== item.id) e.target.style.color = 'rgba(0,245,255,0.7)' }}
              onMouseLeave={e => { if (page !== item.id) e.target.style.color = 'rgba(255,255,255,0.4)' }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <WalletMultiButton />
      </div>
    </nav>
  )
}
