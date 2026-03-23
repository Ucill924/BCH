const PROXY = '/api/bags-proxy'

async function get(path, params = {}) {
  const q = new URLSearchParams({ path, ...params })
  const res = await fetch(`${PROXY}?${q}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'API error')
  return data.response
}

async function post(path, body, isFormData = false) {
  const q = new URLSearchParams({ path })
  const res = await fetch(`${PROXY}?${q}`, {
    method: 'POST',
    headers: isFormData ? {} : { 'Content-Type': 'application/json' },
    body: isFormData ? body : JSON.stringify(body),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'API error')
  return data.response
}

// Token feed
export const getTokenFeed = () => get('/token-launch/feed')

// Lifetime fees
export const getTokenLifetimeFees = (tokenMint) =>
  get('/token-launch/lifetime-fees', { tokenMint })

// Claim stats - returns array of claimers
export const getTokenClaimStats = (tokenMint) =>
  get('/token-launch/claim-stats', { tokenMint })

// Claim events - endpoint yang benar
export const getTokenClaimEvents = (tokenMint) =>
  get('/fee-share/token/claim-events', { tokenMint, limit: '20' })

// Token creators - endpoint v3 yang benar
export const getTokenCreators = (tokenMint) =>
  get('/token-launch/creator/v3', { tokenMint })

// Pools
export const getBagsPools = () => get('/solana/bags/pools')
export const getPoolByTokenMint = (tokenMint) =>
  get('/solana/bags/pools/token-mint', { tokenMint })

// Launch
export const createTokenInfo = (formData) =>
  post('/token-launch/create-token-info', formData, true)
export const createLaunchTransaction = (body) =>
  post('/token-launch/create-launch-transaction', body)
export const sendTransaction = (transaction) =>
  post('/solana/send-transaction', { transaction })

export function lamportsToSol(lamports) { return Number(lamports) / 1_000_000_000 }
export function formatSol(lamports) { return lamportsToSol(lamports).toFixed(4) + ' SOL' }
export function shortAddress(address) {
  if (!address) return ''
  return address.slice(0, 4) + '...' + address.slice(-4)
}
