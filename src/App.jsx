import { useState, useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare'
import { clusterApiUrl } from '@solana/web3.js'
import GalaxyBackground from './components/GalaxyBackground'
import Navbar from './components/Navbar'
import Leaderboard from './pages/Leaderboard'
import Dashboard from './pages/Dashboard'
import LaunchToken from './pages/LaunchToken'
import MyTokens from './pages/MyTokens'

function AppInner() {
  const [page, setPage] = useState('leaderboard')
  const [selectedToken, setSelectedToken] = useState('')

  return (
    <div style={{ minHeight: '100vh', background: '#030712', position: 'relative' }}>
      <GalaxyBackground />
      <div className="scan-line" />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Navbar page={page} setPage={setPage} />
        {page === 'leaderboard' && <Leaderboard setPage={setPage} setSelectedToken={setSelectedToken} />}
        {page === 'dashboard' && <Dashboard selectedToken={selectedToken} setSelectedToken={setSelectedToken} />}
        {page === 'launch' && <LaunchToken setPage={setPage} />}
        {page === 'mytokens' && <MyTokens setPage={setPage} setSelectedToken={setSelectedToken} />}
      </div>
    </div>
  )
}

export default function App() {
  const endpoint = useMemo(() => clusterApiUrl('mainnet-beta'), [])
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], [])
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <AppInner />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
