import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

export default function Navbar({ page, setPage }) {
  return (
    <nav className="border-b border-white/10 bg-black/40 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setPage('leaderboard')}>
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="font-semibold text-white text-base">Bags Creator Hub</span>
          <span className="text-xs px-2 py-0.5 rounded-full border border-white/20 text-white/50">Beta</span>
        </div>
        <div className="flex items-center gap-1">
          {[
            { id: 'leaderboard', label: 'Leaderboard' },
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'mytokens', label: 'My Tokens' },
            { id: 'launch', label: 'Launch Token' },
          ].map(item => (
            <button key={item.id} onClick={() => setPage(item.id)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                page === item.id
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}>
              {item.label}
            </button>
          ))}
        </div>
        <WalletMultiButton />
      </div>
    </nav>
  )
}
